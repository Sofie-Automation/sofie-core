import Koa from 'koa'
import cors from '@koa/cors'
import KoaRouter from '@koa/router'
import { WebApp } from 'meteor/webapp'
import { Meteor } from 'meteor/meteor'
import { getRandomString } from '@sofie-automation/corelib/dist/lib'
import _ from 'underscore'
import { public_dir } from '../../lib'
import staticServe from 'koa-static'
import { logger } from '../../logging'
import { PackageInfo } from '../../coreSystem'
import { profiler } from '../profiler'

declare module 'http' {
	interface IncomingMessage {
		// Meteor http routing performs this addition
		body?: object | string
	}
}

const rootRouter = new KoaRouter()
const boundRouterPaths: string[] = []

Meteor.startup(() => {
	const koaApp = new Koa()

	koaApp.use(async (ctx, next) => {
		// Strange - sometimes a JSON body gets parsed by Koa before here (eg for a POST call?).
		if (typeof ctx.req.body === 'object') {
			ctx.disableBodyParser = true
			if (Array.isArray(ctx.req.body)) {
				ctx.request.body = [...ctx.req.body]
			} else {
				ctx.request.body = { ...ctx.req.body }
			}
		}
		await next()
	})
	koaApp.use(
		cors({
			// Allow anything
			origin(ctx) {
				return ctx.get('Origin') || '*'
			},
		})
	)

	// Expose the API at the url
	WebApp.rawHandlers.use((req, res) => {
		const transaction = profiler.startTransaction(`${req.method}:${req.url}`, 'http.incoming')
		if (transaction) {
			transaction.setLabel('url', `${req.url}`)
			transaction.setLabel('method', `${req.method}`)

			res.on('finish', () => {
				// When the end of the request is sent to the client, submit the apm transaction
				let route = req.originalUrl
				if (req.originalUrl && req.url && req.originalUrl.endsWith(req.url.slice(1)) && req.url.length > 1) {
					route = req.originalUrl.slice(0, -1 * (req.url.length - 1))
				}

				if (route && route.endsWith('/')) {
					route = route.slice(0, -1)
				}

				if (route) {
					transaction.name = `${req.method}:${route}`
					transaction.setLabel('route', `${route}`)
				}

				transaction.end()
			})
		}

		const callback = Meteor.bindEnvironment(koaApp.callback())
		callback(req, res).catch(() => res.end())
	})

	// serve the webui through koa
	// This is to avoid meteor injecting anything into the served html
	const webuiServer = staticServe(public_dir)
	koaApp.use(webuiServer)
	logger.debug(`Serving static files from ${public_dir}`)

	// Serve the meteor runtime config
	rootRouter.get('/meteor-runtime-config.js', async (ctx) => {
		const versionExtended: string = PackageInfo.versionExtended || PackageInfo.version // package version

		ctx.body = `window.__meteor_runtime_config__ = (${JSON.stringify({
			// @ts-expect-error missing types for internal meteor detail
			...__meteor_runtime_config__,
			sofieVersionExtended: versionExtended,
		})})`
	})

	koaApp.use(rootRouter.routes()).use(rootRouter.allowedMethods())

	koaApp.use(async (ctx, next) => {
		if (ctx.method !== 'GET') return next()

		// Don't use the fallback for certain paths
		if (ctx.path.startsWith('/assets/')) return next()

		// Don't use the fallback for anything handled by another router
		// This does not feel efficient, but koa doesn't appear to have any shared state between the router handlers
		for (const bindPath of boundRouterPaths) {
			if (ctx.path.startsWith(bindPath)) return next()
		}

		// fallback to the root file
		ctx.path = '/'
		return webuiServer(ctx, next)
	})
})

export function bindKoaRouter(koaRouter: KoaRouter, bindPath: string): void {
	// Track this path as having a router
	let bindPathFull = bindPath
	if (!bindPathFull.endsWith('/')) bindPathFull += '/'
	boundRouterPaths.push(bindPathFull)

	rootRouter.use(bindPath, koaRouter.routes()).use(bindPath, koaRouter.allowedMethods())
}

const REVERSE_PROXY_COUNT = process.env.HTTP_FORWARDED_COUNT ? parseInt(process.env.HTTP_FORWARDED_COUNT) : 0

// X-Forwarded-For (a de-facto standard) has the following syntax by convention
// X-Forwarded-For: 203.0.113.195, 2001:db8:85a3:8d3:1319:8a2e:370:7348
// X-Forwarded-For: 203.0.113.195,2001:db8:85a3:8d3:1319:8a2e:370:7348,198.51.100.178
function getClientAddrFromXForwarded(headerVal: undefined | string | string[]): string | undefined {
	if (headerVal === undefined) return undefined
	if (typeof headerVal !== 'string') {
		headerVal = _.last(headerVal) as string
	}
	const remoteAddresses = headerVal.split(',')
	return remoteAddresses[remoteAddresses.length - REVERSE_PROXY_COUNT]?.trim() ?? remoteAddresses[0]?.trim()
}

// Forwarded uses the following syntax:
// Forwarded: for=192.0.2.60;proto=http;by=203.0.113.43
// Forwarded: for=192.0.2.43, for="[2001:db8:cafe::17]"
function getClientAddrFromForwarded(forwardedVal: string | undefined): string | undefined {
	if (forwardedVal === undefined) return undefined
	const allProxies = forwardedVal.split(',')
	const proxyInfo = allProxies[allProxies.length - REVERSE_PROXY_COUNT] ?? allProxies[0]
	const directives = proxyInfo?.trim().split(';')
	for (const directive of directives) {
		let match: RegExpMatchArray | null
		if ((match = directive.trim().match(/^for=("\[)?([\w.:])+(\]")?/))) {
			return match[2]
		}
	}
	return undefined
}

export const makeMeteorConnectionFromKoa = (
	ctx: Koa.ParameterizedContext<
		Koa.DefaultState,
		Koa.DefaultContext & KoaRouter.RouterParamContext<Koa.DefaultState, Koa.DefaultContext>,
		unknown
	>
): Meteor.Connection => {
	return {
		id: getRandomString(),
		close: () => {
			/* no-op */
		},
		onClose: () => {
			/* no-op */
		},
		clientAddress:
			// This replicates Meteor behavior which uses the HTTP_FORWARDED_COUNT to extract the "world-facing"
			// IP address of the Client User Agent
			getClientAddrFromForwarded(ctx.req.headers.forwarded) ||
			getClientAddrFromXForwarded(ctx.req.headers['x-forwarded-for']) ||
			ctx.req.socket.remoteAddress ||
			'unknown',
		httpHeaders: ctx.req.headers as Record<string, string>,
	}
}
