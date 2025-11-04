import '../../../../__mocks__/_extendJest'
import { setupDefaultStudioEnvironment } from '../../../../__mocks__/helpers/database'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import {
	TriggerType,
	ClientActions,
	PlayoutActions,
	IBlueprintTriggeredActions,
} from '@sofie-automation/blueprints-integration'
import { MigrationContextSystem } from '../migrationContext'
import { applyAndValidateOverrides } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { CoreSystem, TriggeredActions } from '../../../collections'

describe('Test blueprint migrationContext', () => {
	beforeAll(async () => {
		await setupDefaultStudioEnvironment()
	})

	describe('MigrationContextSystem', () => {
		async function getContext() {
			const coreSystem = await CoreSystem.findOneAsync({})
			expect(coreSystem).toBeTruthy()
			return new MigrationContextSystem()
		}
		async function getSystemTriggeredActions(): Promise<IBlueprintTriggeredActions[]> {
			const systemTriggeredActions = await TriggeredActions.findFetchAsync({
				showStyleBaseId: null,
			})
			expect(systemTriggeredActions).toHaveLength(3)
			return systemTriggeredActions.map((doc) =>
				literal<IBlueprintTriggeredActions>({
					_id: unprotectString(doc._id),
					_rank: doc._rank,
					name: doc.name,
					triggers: applyAndValidateOverrides(doc.triggersWithOverrides).obj,
					actions: applyAndValidateOverrides(doc.actionsWithOverrides).obj,
				})
			)
		}
		describe('triggeredActions', () => {
			test('getAllTriggeredActions: return all triggeredActions', async () => {
				const ctx = await getContext()

				// default studio environment should have 3 core-level actions
				expect(await ctx.getAllTriggeredActions()).toHaveLength(3)
			})
			test('getTriggeredAction: no id', async () => {
				const ctx = await getContext()

				await expect(ctx.getTriggeredAction('')).rejects.toThrowMeteor(
					500,
					'Triggered actions Id "" is invalid'
				)
			})
			test('getTriggeredAction: missing id', async () => {
				const ctx = await getContext()

				expect(await ctx.getTriggeredAction('abc')).toBeFalsy()
			})
			test('getTriggeredAction: existing id', async () => {
				const ctx = await getContext()

				const existingTriggeredActions = (await getSystemTriggeredActions())[0]
				expect(existingTriggeredActions).toBeTruthy()
				expect(await ctx.getTriggeredAction(existingTriggeredActions._id)).toMatchObject(
					existingTriggeredActions
				)
			})
			test('setTriggeredAction: set undefined', async () => {
				const ctx = await getContext()

				await expect(ctx.setTriggeredAction(undefined as any)).rejects.toThrow(/Match error/)
			})
			test('setTriggeredAction: set without id', async () => {
				const ctx = await getContext()

				await expect(
					ctx.setTriggeredAction({
						_rank: 0,
						actions: [],
						triggers: [],
					} as any)
				).rejects.toThrow(/Match error/)
			})
			test('setTriggeredAction: set without actions', async () => {
				const ctx = await getContext()

				await expect(
					ctx.setTriggeredAction({
						_id: 'test1',
						_rank: 0,
						triggers: [],
					} as any)
				).rejects.toThrow(/Match error/)
			})
			test('setTriggeredAction: set with null as name', async () => {
				const ctx = await getContext()

				await expect(
					ctx.setTriggeredAction({
						_id: 'test1',
						_rank: 0,
						actions: [],
						triggers: [],
						name: null,
					} as any)
				).rejects.toThrow(/Match error/)
			})
			test('setTriggeredAction: set non-existing id', async () => {
				const ctx = await getContext()

				const blueprintLocalId = 'test0'

				await ctx.setTriggeredAction({
					_id: blueprintLocalId,
					_rank: 1001,
					actions: {
						'0': {
							action: ClientActions.shelf,
							filterChain: [
								{
									object: 'view',
								},
							],
							state: 'toggle',
						},
					},
					triggers: {
						'0': {
							type: TriggerType.hotkey,
							keys: 'Digit1',
						},
					},
				})
				const insertedTriggeredAction = await ctx.getTriggeredAction(blueprintLocalId)
				expect(insertedTriggeredAction).toBeTruthy()
				// the actual id in the database should not be the same as the one provided
				// in the setTriggeredAction method
				expect(insertedTriggeredAction?._id !== blueprintLocalId).toBe(true)
			})
			test('setTriggeredAction: set existing id', async () => {
				const ctx = await getContext()

				const oldCoreAction = await ctx.getTriggeredAction('mockTriggeredAction_core0')
				expect(oldCoreAction).toBeTruthy()
				expect(oldCoreAction?.actions[0].action).toBe(PlayoutActions.adlib)

				await ctx.setTriggeredAction({
					_id: 'mockTriggeredAction_core0',
					_rank: 0,
					actions: {
						'0': {
							action: PlayoutActions.activateRundownPlaylist,
							rehearsal: false,
							filterChain: [
								{
									object: 'view',
								},
							],
						},
					},
					triggers: {
						'0': {
							type: TriggerType.hotkey,
							keys: 'Control+Shift+Enter',
						},
					},
				})

				const newCoreAction = await ctx.getTriggeredAction('mockTriggeredAction_core0')
				expect(newCoreAction).toBeTruthy()
				expect(newCoreAction?.actions[0].action).toBe(PlayoutActions.activateRundownPlaylist)
			})
			test('removeTriggeredAction: remove empty id', async () => {
				const ctx = await getContext()

				await expect(ctx.removeTriggeredAction('')).rejects.toThrowMeteor(
					500,
					'Triggered actions Id "" is invalid'
				)
			})
			test('removeTriggeredAction: remove existing id', async () => {
				const ctx = await getContext()

				const oldCoreAction = await ctx.getTriggeredAction('mockTriggeredAction_core0')
				expect(oldCoreAction).toBeTruthy()

				await ctx.removeTriggeredAction('mockTriggeredAction_core0')
				expect(await ctx.getTriggeredAction('mockTriggeredAction_core0')).toBeFalsy()
			})
		})
	})
})
