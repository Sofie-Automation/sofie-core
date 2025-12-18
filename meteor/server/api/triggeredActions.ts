import { Meteor } from 'meteor/meteor'
import { check, Match } from '../lib/check'
import { registerClassToMeteorMethods, ReplaceOptionalWithNullInMethodArguments } from '../methods'
import { literal, getRandomId, Complete } from '@sofie-automation/corelib/dist/lib'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { logger } from '../logging'
import { MethodContext, MethodContextAPI } from './methodContext'
import { DBTriggeredActions, TriggeredActionsObj } from '@sofie-automation/meteor-lib/dist/collections/TriggeredActions'
import {
	CreateTriggeredActionsContent,
	NewTriggeredActionsAPI,
	TriggeredActionsAPIMethods,
} from '@sofie-automation/meteor-lib/dist/api/triggeredActions'
import { fetchShowStyleBaseLight } from '../optimizations'
import {
	convertObjectIntoOverrides,
	wrapDefaultObject,
} from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { ShowStyleBaseId, TriggeredActionId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { TriggeredActions } from '../collections'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'
import { UserPermissions } from '@sofie-automation/meteor-lib/dist/userPermissions'
import { assertConnectionHasOneOfPermissions } from '../security/auth'

const PERMISSIONS_FOR_TRIGGERED_ACTIONS: Array<keyof UserPermissions> = ['configure']

export async function createTriggeredActions(
	showStyleBaseId: ShowStyleBaseId | null,
	base?: CreateTriggeredActionsContent
): Promise<TriggeredActionId> {
	const id: TriggeredActionId = getRandomId()
	await TriggeredActions.insertAsync(
		literal<Complete<TriggeredActionsObj>>({
			_id: id,
			_rank: base?._rank ?? 0,
			name: base?.name,
			showStyleBaseId,
			blueprintUniqueId: null,
			// User source objects should be formed purely of overrides
			actionsWithOverrides: convertObjectIntoOverrides(base?.actions),
			triggersWithOverrides: convertObjectIntoOverrides(base?.triggers),

			styleClassNames: base?.styleClassNames,
		})
	)
	return id
}

export async function removeTriggeredActions(triggeredActionId: TriggeredActionId): Promise<void> {
	await TriggeredActions.removeAsync(triggeredActionId)
}

export const actionTriggersRouter = new KoaRouter()

actionTriggersRouter.post(
	'/upload/:showStyleBaseId',
	bodyParser({
		jsonLimit: '50mb', // Arbitrary limit
	}),
	async (ctx) => {
		ctx.response.type = 'text/plain'

		assertConnectionHasOneOfPermissions(ctx, ...PERMISSIONS_FOR_TRIGGERED_ACTIONS)

		const showStyleBaseId: ShowStyleBaseId | undefined = protectString<ShowStyleBaseId>(ctx.params.showStyleBaseId)

		check(showStyleBaseId, Match.Optional(String))

		const replace = !!ctx.query['replace']

		try {
			if (showStyleBaseId !== undefined) {
				const showStyleBase = await fetchShowStyleBaseLight(showStyleBaseId)
				if (!showStyleBase) {
					throw new Meteor.Error(
						404,
						`Restore Action Triggers: ShowStyle "${showStyleBaseId}" could not be found`
					)
				}
			}

			if (ctx.request.type !== 'application/json')
				throw new Meteor.Error(400, 'Restore Action Triggers: Invalid content-type')

			const body = ctx.request.body
			if (!body) throw new Meteor.Error(400, 'Restore Action Triggers: Missing request body')
			if (typeof body !== 'object' || Object.keys(body as any).length === 0)
				throw new Meteor.Error(400, 'Restore Action Triggers: Invalid request body')

			const triggeredActions = body as DBTriggeredActions[]
			check(triggeredActions, Array)

			// set new showStyleBaseId
			for (const triggeredActionsObj of triggeredActions) {
				const compatObj = triggeredActionsObj as any
				if ('triggers' in compatObj) {
					triggeredActionsObj.triggersWithOverrides = wrapDefaultObject(compatObj.triggers)
					delete compatObj.triggers
				}
				if ('actions' in compatObj) {
					triggeredActionsObj.actionsWithOverrides = wrapDefaultObject(compatObj.actions)
					delete compatObj.actions
				}

				check(triggeredActionsObj._id, String)
				check(triggeredActionsObj.name, Match.Optional(Match.OneOf(String, Object)))
				check(triggeredActionsObj.triggersWithOverrides, Object)
				check(triggeredActionsObj.actionsWithOverrides, Object)
				triggeredActionsObj.showStyleBaseId = showStyleBaseId ?? null
			}

			if (replace) {
				await TriggeredActions.removeAsync({
					showStyleBaseId: showStyleBaseId ?? null,
				})
			}

			// TODO - should we clear `blueprintUniqueId`, to avoid blueprints getting them confused with data they own?

			await TriggeredActions.upsertManyAsync(triggeredActions)

			ctx.response.status = 200
			ctx.body = ''
		} catch (e) {
			ctx.response.status = 500
			ctx.body = e + ''
			logger.error('Triggered Actions restore failed: ' + e)
		}
	}
)

actionTriggersRouter.get('/download/:showStyleBaseId', async (ctx) => {
	const showStyleBaseId: ShowStyleBaseId | undefined = protectString(ctx.params.showStyleBaseId)

	check(showStyleBaseId, Match.Maybe(String))

	const triggeredActions = await TriggeredActions.findFetchAsync({
		showStyleBaseId: showStyleBaseId === undefined ? null : showStyleBaseId,
	})
	if (triggeredActions.length === 0) {
		ctx.response.status = 404
		ctx.body = `Action Triggers not found for showstyle "${showStyleBaseId}"`
		return
	}

	try {
		ctx.response.type = 'application/json'
		ctx.attachment(`${showStyleBaseId ?? 'system-wide'}.json`)
		ctx.body = JSON.stringify(triggeredActions, undefined, 2)

		ctx.response.status = 200
	} catch (e) {
		ctx.response.status = 500
		ctx.body = e + ''
		logger.error('Action Triggers export failed: ' + e)
	}
})

/** Add RundownLayout into showStyleBase */
async function apiCreateTriggeredActions(
	context: MethodContext,
	showStyleBaseId: ShowStyleBaseId | null,
	base: CreateTriggeredActionsContent | null
) {
	check(showStyleBaseId, Match.Maybe(String))
	check(base, Match.Maybe(Object))

	assertConnectionHasOneOfPermissions(context.connection, ...PERMISSIONS_FOR_TRIGGERED_ACTIONS)

	return createTriggeredActions(showStyleBaseId, base || undefined)
}
async function apiRemoveTriggeredActions(context: MethodContext, id: TriggeredActionId) {
	check(id, String)

	assertConnectionHasOneOfPermissions(context.connection, ...PERMISSIONS_FOR_TRIGGERED_ACTIONS)

	await removeTriggeredActions(id)
}

class ServerTriggeredActionsAPI
	extends MethodContextAPI
	implements ReplaceOptionalWithNullInMethodArguments<NewTriggeredActionsAPI>
{
	async createTriggeredActions(showStyleBaseId: ShowStyleBaseId | null, base: CreateTriggeredActionsContent | null) {
		return apiCreateTriggeredActions(this, showStyleBaseId, base)
	}
	async removeTriggeredActions(triggeredActionId: TriggeredActionId) {
		return apiRemoveTriggeredActions(this, triggeredActionId)
	}
}
registerClassToMeteorMethods(TriggeredActionsAPIMethods, ServerTriggeredActionsAPI, false)
