import { z } from 'zod'
import { check } from '../lib/check'
import { NewRundownLayoutsAPI } from '@sofie-automation/meteor-lib/dist/api/rundownLayouts'
import {
	RundownLayoutType,
	RundownLayoutBase,
	CustomizableRegions,
} from '@sofie-automation/meteor-lib/dist/collections/RundownLayouts'
import { literal, getRandomId } from '@sofie-automation/corelib/dist/lib'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { logger } from '../logging'
import { MethodContext, MethodContextAPI } from './methodContext'
import { fetchShowStyleBaseLight } from '../optimizations'
import { BlueprintId, RundownLayoutId, ShowStyleBaseId, UserId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { RundownLayouts } from '../collections'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'
import { UserPermissions } from '@sofie-automation/meteor-lib/dist/userPermissions'
import { assertConnectionHasOneOfPermissions } from '../security/auth'
import { SofieError } from '@sofie-automation/corelib/dist/error'

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

		check(showStyleBaseId, z.string())

		try {
			const showStyleBase = await fetchShowStyleBaseLight(showStyleBaseId)
			if (!showStyleBase) throw new SofieError(404, `ShowStylebase "${showStyleBaseId}" not found`)

			if (ctx.request.type !== 'application/json')
				throw new SofieError(400, 'Restore Shelf Layout: Invalid content-type')

			const body = ctx.request.body
			if (!body) throw new SofieError(400, 'Restore Shelf Layout: Missing request body')
			if (typeof body !== 'object' || Object.keys(body as any).length === 0)
				throw new SofieError(400, 'Restore Shelf Layout: Invalid request body')

			const layout = body as RundownLayoutBase
			check(layout._id, z.string().optional())
			check(layout.name, z.string())
			check(layout.type, z.string())

			layout._id = layout._id || getRandomId()
			layout.showStyleBaseId = showStyleBase._id

			await RundownLayouts.replaceAsync(layout)

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

	check(layoutId, z.string())

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
	check(name, z.string())
	check(type, z.string())
	check(showStyleBaseId, z.string())
	check(regionId, z.string())

	assertConnectionHasOneOfPermissions(context.connection, ...PERMISSIONS_FOR_MANAGE_RUNDOWN_LAYOUTS)

	return createRundownLayout(name, type, showStyleBaseId, regionId, undefined, undefined)
}
async function apiRemoveRundownLayout(context: MethodContext, id: RundownLayoutId) {
	check(id, z.string())

	assertConnectionHasOneOfPermissions(context.connection, ...PERMISSIONS_FOR_MANAGE_RUNDOWN_LAYOUTS)

	const rundownLayout = await RundownLayouts.findOneAsync(id)
	if (!rundownLayout) throw new SofieError(404, `RundownLayout "${id}" not found`)

	await removeRundownLayout(id)
}

export class ServerRundownLayoutsAPI extends MethodContextAPI implements NewRundownLayoutsAPI {
	async createRundownLayout(
		name: string,
		type: RundownLayoutType,
		showStyleBaseId: ShowStyleBaseId,
		regionId: CustomizableRegions
	): Promise<RundownLayoutId> {
		return apiCreateRundownLayout(this, name, type, showStyleBaseId, regionId)
	}
	async removeRundownLayout(rundownLayoutId: RundownLayoutId): Promise<void> {
		return apiRemoveRundownLayout(this, rundownLayoutId)
	}
}
