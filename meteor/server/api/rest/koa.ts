import Koa from 'koa'
import cors from '@koa/cors'
import KoaRouter from '@koa/router'
import KoaMount from 'koa-mount'
import { WebApp } from 'meteor/webapp'
import { Meteor } from 'meteor/meteor'
import { getRandomString } from '@sofie-automation/corelib/dist/lib'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'
import { getRootSubpath, public_dir } from '../../lib'
import { getClientAddress } from '../../lib/clientAddress'
import { STANDALONE_DDP_SERVER_PATH } from '../../ddp-server/config'
import staticServe from 'koa-static'
import { logger } from '../../logging'
import { PackageInfo } from '../../coreSystem'
import { profiler } from '../profiler'
import fs from 'fs/promises'
import type { IExtendedSettings } from '@sofie-automation/meteor-lib/dist/Settings'
import { ENABLE_HEADER_AUTH } from '../../security/auth'

declare module 'http' {
	interface IncomingMessage {
		// Meteor http routing performs this addition
		body?: object | string
	}
}

const rootRouter = new KoaRouter()
const boundRouterPaths: string[] = []

export function startKoaServer(): void {
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
	WebApp.rawConnectHandlers.use((req, res) => {
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
	const webuiServer = staticServe(public_dir, {
		index: false, // Performed manually
	})
	koaApp.use(KoaMount(getRootSubpath() || '/', webuiServer))
	logger.debug(`Serving static files from ${public_dir}`)

	if (Meteor.isDevelopment) {
		// Serve the meteor runtime config. In production, this gets baked into the html
		rootRouter.get(getRootSubpath() + '/meteor-runtime-config.js', async (ctx) => {
			ctx.body = getExtendedMeteorRuntimeConfig()
		})
	}

	koaApp.use(rootRouter.routes()).use(rootRouter.allowedMethods())

	koaApp.use(async (ctx, next) => {
		if (ctx.method !== 'GET') return next()

		// Ensure the path is scoped to the root subpath
		const rootSubpath = getRootSubpath()
		if (!ctx.path.startsWith(rootSubpath)) return next()

		// Don't use the fallback for certain paths
		if (ctx.path.startsWith(rootSubpath + '/assets/')) return next()

		// Don't use the fallback for anything handled by another router
		// This does not feel efficient, but koa doesn't appear to have any shared state between the router handlers
		for (const bindPath of boundRouterPaths) {
			if (ctx.path.startsWith(bindPath)) return next()
		}

		// fallback to serving html
		return serveIndexHtml(ctx, next)
	})
}

function getExtendedMeteorRuntimeConfig() {
	const versionExtended: string = PackageInfo.versionExtended || PackageInfo.version // package version

	return `window.__meteor_runtime_config__ = (${JSON.stringify({
		// @ts-expect-error missing types for internal meteor detail
		...__meteor_runtime_config__,
		...({
			sofieVersionExtended: versionExtended,
			enableHeaderAuth: ENABLE_HEADER_AUTH,
		} satisfies IExtendedSettings),
		DDP_DEFAULT_CONNECTION_URL: STANDALONE_DDP_SERVER_PATH,
	})})`
}

async function serveIndexHtml(ctx: Koa.ParameterizedContext, next: Koa.Next) {
	try {
		// Read the file
		const indexFileBuffer = await fs.readFile(public_dir + '/index.html', 'utf8')
		const indexFileStr = indexFileBuffer.toString()

		const rootPath = getRootSubpath()

		// Perform various runtime modifications, to ensure paths have the correct absolute prefix
		let modifiedFile = indexFileStr
		modifiedFile = modifiedFile.replace(
			// Replace the http load with injected js, to avoid risk of issues where this load fails and the app gets confused
			'<script type="text/javascript" src="/meteor-runtime-config.js"></script>',
			`<script type="text/javascript">${getExtendedMeteorRuntimeConfig()}</script>`
		)
		modifiedFile = modifiedFile.replaceAll('href="/', `href="${rootPath}/`)
		modifiedFile = modifiedFile.replaceAll('href="./', `href="${rootPath}/`)
		modifiedFile = modifiedFile.replaceAll('src="./', `src="${rootPath}/`)

		ctx.body = modifiedFile
	} catch (e: unknown) {
		logger.error(`error in serveIndexHtml: ${stringifyError(e)}`)
		return next()
	}
}

export function bindKoaRouter(koaRouter: KoaRouter, bindPath: string): void {
	const bindPathWithPrefix = getRootSubpath() + bindPath

	// Track this path as having a router
	let bindPathFull = bindPathWithPrefix
	if (!bindPathFull.endsWith('/')) bindPathFull += '/'
	boundRouterPaths.push(bindPathFull)

	rootRouter.use(bindPathWithPrefix, koaRouter.routes()).use(bindPathWithPrefix, koaRouter.allowedMethods())
}

export const makeMeteorConnectionFromKoa = (
	ctx: Koa.ParameterizedContext<Koa.DefaultState, Koa.DefaultContext, unknown>
): Meteor.Connection => {
	return {
		id: getRandomString(),
		close: () => {
			/* no-op */
		},
		onClose: () => {
			/* no-op */
		},
		clientAddress: getClientAddress(ctx.req.headers, ctx.req.socket.remoteAddress),
		httpHeaders: ctx.req.headers as Record<string, string>,
	}
}
