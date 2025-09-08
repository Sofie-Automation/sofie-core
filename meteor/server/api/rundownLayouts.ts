import { Meteor } from 'meteor/meteor'
import { check, Match } from '../lib/check'
import { registerClassToMeteorMethods } from '../methods'
import { NewRundownLayoutsAPI, RundownLayoutsAPIMethods } from '@sofie-automation/meteor-lib/dist/api/rundownLayouts'
import {
	RundownLayoutType,
	RundownLayoutBase,
	CustomizableRegions,
} from '@sofie-automation/meteor-lib/dist/collections/RundownLayouts'
import { literal, getRandomId, protectString } from '../lib/tempLib'
import { logger } from '../logging'
import { MethodContext, MethodContextAPI } from './methodContext'
import { fetchShowStyleBaseLight } from '../optimizations'
import { BlueprintId, RundownLayoutId, ShowStyleBaseId, UserId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { RundownLayouts } from '../collections'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'
import { UserPermissions } from '@sofie-automation/meteor-lib/dist/userPermissions'
import { assertConnectionHasOneOfPermissions } from '../security/auth'

const PERMISSIONS_FOR_MANAGE_RUNDOWN_LAYOUTS: Array<keyof UserPermissions> = ['configure']

export async function createRundownLayout(
	name: string,
	type: RundownLayoutType,
	showStyleBaseId: ShowStyleBaseId,
	regionId: CustomizableRegions,
	blueprintId: BlueprintId | undefined,
	userId?: UserId
): Promise<RundownLayoutId> {
	const id: RundownLayoutId = getRandomId()
	await RundownLayouts.insertAsync(
		literal<RundownLayoutBase>({
			_id: id,
			name,
			showStyleBaseId,
			blueprintId,
			type,
			userId,
			icon: '',
			iconColor: '#ffffff',
			regionId,
			isDefaultLayout: false,
		})
	)
	return id
}

export async function removeRundownLayout(layoutId: RundownLayoutId): Promise<void> {
	await RundownLayouts.removeAsync(layoutId)
}

export const shelfLayoutsRouter = new KoaRouter()

shelfLayoutsRouter.post(
	'/upload/:showStyleBaseId',
	bodyParser({
		jsonLimit: '50mb', // Arbitrary limit
	}),
	async (ctx) => {
		ctx.response.type = 'text/plain'

		assertConnectionHasOneOfPermissions(ctx, ...PERMISSIONS_FOR_MANAGE_RUNDOWN_LAYOUTS)

		const showStyleBaseId: ShowStyleBaseId = protectString(ctx.params.showStyleBaseId)

		check(showStyleBaseId, String)

		try {
			const showStyleBase = await fetchShowStyleBaseLight(showStyleBaseId)
			if (!showStyleBase) throw new Meteor.Error(404, `ShowStylebase "${showStyleBaseId}" not found`)

			if (ctx.request.type !== 'application/json')
				throw new Meteor.Error(400, 'Restore Shelf Layout: Invalid content-type')

			const body = ctx.request.body
			if (!body) throw new Meteor.Error(400, 'Restore Shelf Layout: Missing request body')
			if (typeof body !== 'object' || Object.keys(body as any).length === 0)
				throw new Meteor.Error(400, 'Restore Shelf Layout: Invalid request body')

			const layout = body as RundownLayoutBase
			check(layout._id, Match.Optional(String))
			check(layout.name, String)
			check(layout.type, String)

			layout.showStyleBaseId = showStyleBase._id

			await RundownLayouts.upsertAsync(layout._id, layout)

			ctx.response.status = 200
			ctx.body = ''
		} catch (e) {
			ctx.response.status = 500
			ctx.body = e + ''
			logger.error('Shelf Layout restore failed: ' + e)
		}
	}
)

shelfLayoutsRouter.get('/download/:id', async (ctx) => {
	const layoutId: RundownLayoutId = protectString(ctx.params.id)

	check(layoutId, String)

	const layout = await RundownLayouts.findOneAsync(layoutId)
	if (!layout) {
		ctx.response.status = 404
		ctx.body = 'Shelf Layout not found'
		return
	}

	try {
		ctx.response.type = 'application/json'
		ctx.attachment(`${encodeURIComponent(layout.name)}.json`)
		ctx.response.status = 200
		ctx.body = JSON.stringify(layout, undefined, 2)
	} catch (e) {
		ctx.response.status = 500
		ctx.body = e + ''
		logger.error('Shelf layout restore failed: ' + e)
	}
})

/** Add RundownLayout into showStyleBase */
async function apiCreateRundownLayout(
	context: MethodContext,
	name: string,
	type: RundownLayoutType,
	showStyleBaseId: ShowStyleBaseId,
	regionId: CustomizableRegions
) {
	check(name, String)
	check(type, String)
	check(showStyleBaseId, String)
	check(regionId, String)

	assertConnectionHasOneOfPermissions(context.connection, ...PERMISSIONS_FOR_MANAGE_RUNDOWN_LAYOUTS)

	return createRundownLayout(name, type, showStyleBaseId, regionId, undefined, undefined)
}
async function apiRemoveRundownLayout(context: MethodContext, id: RundownLayoutId) {
	check(id, String)

	assertConnectionHasOneOfPermissions(context.connection, ...PERMISSIONS_FOR_MANAGE_RUNDOWN_LAYOUTS)

	const rundownLayout = await RundownLayouts.findOneAsync(id)
	if (!rundownLayout) throw new Meteor.Error(404, `RundownLayout "${id}" not found`)

	await removeRundownLayout(id)
}

class ServerRundownLayoutsAPI extends MethodContextAPI implements NewRundownLayoutsAPI {
	async createRundownLayout(
		name: string,
		type: RundownLayoutType,
		showStyleBaseId: ShowStyleBaseId,
		regionId: CustomizableRegions
	) {
		return apiCreateRundownLayout(this, name, type, showStyleBaseId, regionId)
	}
	async removeRundownLayout(rundownLayoutId: RundownLayoutId) {
		return apiRemoveRundownLayout(this, rundownLayoutId)
	}
}
registerClassToMeteorMethods(RundownLayoutsAPIMethods, ServerRundownLayoutsAPI, false)
