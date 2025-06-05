import _ from 'underscore'
import { logger } from '../../logging'
import { Meteor } from 'meteor/meteor'
import { BlueprintManifestSet } from '@sofie-automation/blueprints-integration'
import { check, Match } from '../../lib/check'
import { retrieveBlueprintAsset, uploadBlueprint, uploadBlueprintAsset } from './api'
import { protectString } from '../../lib/tempLib'
import path from 'path'
import { BlueprintId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'

const BLUEPRINT_ASSET_MAX_AGE = 15 * 24 * 3600 // 15 days, in seconds

export const blueprintsRouter = new KoaRouter()

blueprintsRouter.post(
	'/restore/:blueprintId',
	bodyParser({
		enableTypes: ['text'],
		textLimit: '200mb',
		extendTypes: {
			// interpret as text
			text: ['text/javascript'],
		},
	}),
	async (ctx) => {
		ctx.response.type = 'text/plain'
		logger.debug(`Blueprint Upload: ${ctx.socket.remoteAddress} POST "${ctx.url}"`)

		try {
			const blueprintId = ctx.params.blueprintId
			const force = ctx.query['force'] === '1' || ctx.query['force'] === 'true'

			const blueprintNames = ctx.query['name']
			const blueprintName: string | undefined = Array.isArray(blueprintNames) ? blueprintNames[0] : blueprintNames

			check(blueprintId, String)
			check(blueprintName, Match.Maybe(String))

			const body = ctx.request.body || ctx.req.body
			if (!body) throw new Meteor.Error(400, 'Restore Blueprint: Missing request body')
			if (typeof body !== 'string' || body.length < 10)
				throw new Meteor.Error(400, 'Restore Blueprint: Invalid request body')

			await uploadBlueprint(ctx, protectString<BlueprintId>(blueprintId), body, blueprintName, force)

			ctx.response.status = 200
			ctx.body = ''
		} catch (e) {
			ctx.response.status = 500
			ctx.body = e + ''
			logger.error('Blueprint restore failed: ' + e)
		}
	}
)
blueprintsRouter.post(
	'/restore',
	bodyParser({
		jsonLimit: '200mb',
	}),
	async (ctx) => {
		ctx.response.type = 'text/plain'
		logger.debug(`Blueprint Upload: ${ctx.socket.remoteAddress} POST "${ctx.url}"`)

		try {
			const body = ctx.request.body
			if (!body) throw new Meteor.Error(400, 'Restore Blueprint: Missing request body')
			if (typeof body !== 'object' || Object.keys(body as any).length === 0)
				throw new Meteor.Error(400, 'Restore Blueprint: Invalid request body')

			const collection = body as BlueprintManifestSet

			const isBlueprintManifestSet = (obj: string | object): obj is BlueprintManifestSet =>
				typeof obj === 'object' && 'blueprints' in obj
			if (!isBlueprintManifestSet(collection))
				throw new Meteor.Error(400, 'Restore Blueprint: Malformed request body')

			if (!Meteor.isTest) logger.info(`Got blueprint collection. ${Object.keys(body).length} blueprints`)

			const errors: any[] = []
			for (const id of _.keys(collection.blueprints)) {
				try {
					await uploadBlueprint(ctx, protectString<BlueprintId>(id), collection.blueprints[id], id)
				} catch (e) {
					logger.error('Blueprint restore failed: ' + e)
					errors.push(e)
				}
			}
			if (collection.assets) {
				for (const id of _.keys(collection.assets)) {
					try {
						await uploadBlueprintAsset(ctx, id, collection.assets[id])
					} catch (e) {
						logger.error('Blueprint assets upload failed: ' + e)
						errors.push(e)
					}
				}
			}

			// Report errors
			if (errors.length > 0) {
				ctx.response.status = 500
				let content = 'Errors were encountered: \n'
				for (const e of errors) {
					content += e + '\n'
				}

				ctx.body = content
			} else {
				ctx.response.status = 200
				ctx.body = ''
			}
		} catch (e) {
			ctx.response.status = 500
			ctx.body = e + ''
			logger.error('Blueprint restore failed: ' + e)
		}
	}
)

// TODO - should these be based on blueprintId?
blueprintsRouter.post(
	'/assets',
	bodyParser({
		jsonLimit: '50mb',
	}),
	async (ctx) => {
		ctx.response.type = 'text/plain'
		logger.debug(`Blueprint Asset: ${ctx.socket.remoteAddress} POST "${ctx.url}"`)

		try {
			const body = ctx.request.body
			if (!body) throw new Meteor.Error(400, 'Upload Blueprint assets: Missing request body')
			if (typeof body !== 'object' || Object.keys(body as any).length === 0)
				throw new Meteor.Error(400, 'Upload Blueprint assets: Invalid request body')

			const collection = body as Record<string, string>

			if (!Meteor.isTest) logger.info(`Got blueprint assets. ${Object.keys(collection).length} assets`)

			const errors: any[] = []
			for (const id of _.keys(collection)) {
				try {
					await uploadBlueprintAsset(ctx, id, collection[id])
				} catch (e) {
					logger.error('Blueprint assets upload failed: ' + e)
					errors.push(e)
				}
			}

			// Report errors
			if (errors.length > 0) {
				ctx.response.status = 500
				let content = 'Errors were encountered: \n'
				for (const e of errors) {
					content += e + '\n'
				}
				ctx.body = content
			} else {
				ctx.response.status = 200
				ctx.body = ''
			}
		} catch (e) {
			ctx.response.status = 500
			ctx.body = e + ''
			logger.error('Blueprint assets upload failed: ' + e)
		}
	}
)

blueprintsRouter.get('/assets/(.*)', async (ctx) => {
	logger.debug(`Blueprint Asset: ${ctx.socket.remoteAddress} GET "${ctx.url}"`)
	// TODO - some sort of user verification
	// for now just check it's a png to prevent snapshots being downloaded

	const filePath = ctx.params[0]
	if (filePath.match(/\.(png|svg|gif)?$/)) {
		try {
			const dataStream = retrieveBlueprintAsset(ctx, filePath)
			const extension = path.extname(filePath)
			if (extension === '.svg') {
				ctx.response.type = 'image/svg+xml'
			} else if (extension === '.png') {
				ctx.response.type = 'image/png'
			} else if (extension === '.gif') {
				ctx.response.type = 'image/gif'
			}
			// assets are supposed to have a unique ID/file name, if the asset changes, so must the filename
			ctx.set('Cache-Control', `public, max-age=${BLUEPRINT_ASSET_MAX_AGE}, immutable`)
			ctx.statusCode = 200
			ctx.body = dataStream
		} catch {
			ctx.statusCode = 404 // Probably
		}
	} else {
		ctx.statusCode = 403
	}
})
