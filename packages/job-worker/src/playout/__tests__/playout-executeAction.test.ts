import { RundownPlaylistId, AdLibActionId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { UserErrorMessage } from '@sofie-automation/corelib/dist/error'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { MockJobContext, setupDefaultJobEnvironment } from '../../__mocks__/context.js'
import { setupDefaultRundownPlaylist, setupMockShowStyleCompound } from '../../__mocks__/presetCollections.js'
import { handleTakeNextPart } from '../take.js'
import { handleExecuteAdlibAction } from '../adlibAction.js'
import { handleActivateRundownPlaylist } from '../activePlaylistJobs.js'
import { ActionExecutionContext } from '../../blueprints/context/adlibActions.js'
import { ActionPartChange } from '../../blueprints/context/services/PartAndPieceInstanceActionService.js'
import * as Infinites from '../../playout/infinites.js'
import * as TakeApi from '../../playout/take.js'

const syncPlayheadInfinitesForNextPartInstanceMock = jest.spyOn(Infinites, 'syncPlayheadInfinitesForNextPartInstance')
const takeNextPartMock = jest.spyOn(TakeApi, 'performTakeToNextedPart')

jest.mock('../timeline/generate')
import { updateTimeline } from '../timeline/generate.js'
type TupdateTimeline = jest.MockedFunction<typeof updateTimeline>
const updateTimelineMock = updateTimeline as TupdateTimeline

describe('Playout API', () => {
	describe('executeAction', () => {
		let context: MockJobContext
		let playlistId: RundownPlaylistId

		beforeEach(async () => {
			context = setupDefaultJobEnvironment()

			await setupMockShowStyleCompound(context)

			const { playlistId: playlistId0 } = await setupDefaultRundownPlaylist(context)
			playlistId = playlistId0

			await handleActivateRundownPlaylist(context, {
				playlistId: playlistId,
				rehearsal: true,
			})
			await handleTakeNextPart(context, {
				playlistId: playlistId,
				fromPartInstanceId: null,
			})

			syncPlayheadInfinitesForNextPartInstanceMock.mockClear()
			updateTimelineMock.mockClear()
			takeNextPartMock.mockClear()
		})

		test('throws errors', async () => {
			const actionDocId: AdLibActionId = protectString('action-id')
			const actionId = 'some-action'
			const userData = { blobby: true }

			await expect(
				handleExecuteAdlibAction(context, {
					playlistId: playlistId,
					actionDocId: actionDocId,
					actionId: actionId,
					userData: userData,
				})
			).rejects.toMatchUserError(UserErrorMessage.ActionsNotSupported)

			context.updateShowStyleBlueprint({
				executeAction: async () => {
					throw new Error('action execution threw')
				},
			})

			await expect(
				handleExecuteAdlibAction(context, {
					playlistId,
					actionDocId,
					actionId,
					userData,
				})
			).rejects.toMatchUserError(UserErrorMessage.InternalError)

			expect(syncPlayheadInfinitesForNextPartInstanceMock).toHaveBeenCalledTimes(0)
			expect(updateTimelineMock).toHaveBeenCalledTimes(0)
		})

		test('no changes', async () => {
			context.updateShowStyleBlueprint({
				executeAction: async (context0) => {
					const context = context0 as ActionExecutionContext
					if (context.nextPartState !== ActionPartChange.NONE) throw new Error('nextPartState started wrong')
					if (context.currentPartState !== ActionPartChange.NONE)
						throw new Error('nextPartState started wrong')
				},
			})

			const actionDocId: AdLibActionId = protectString('action-id')
			const actionId = 'some-action'
			const userData = { blobby: true }
			await handleExecuteAdlibAction(context, {
				playlistId,
				actionDocId,
				actionId,
				userData,
			})

			expect(syncPlayheadInfinitesForNextPartInstanceMock).toHaveBeenCalledTimes(0)
			expect(updateTimelineMock).toHaveBeenCalledTimes(0)
		})

		test('safe next part', async () => {
			context.updateShowStyleBlueprint({
				executeAction: async (context0) => {
					const context = context0 as ActionExecutionContext
					if (context.nextPartState !== ActionPartChange.NONE) throw new Error('nextPartState started wrong')
					if (context.currentPartState !== ActionPartChange.NONE)
						throw new Error('nextPartState started wrong')

					// @ts-ignore
					context.partAndPieceInstanceService.nextPartState = ActionPartChange.SAFE_CHANGE
				},
			})

			const actionDocId: AdLibActionId = protectString('action-id')
			const actionId = 'some-action'
			const userData = { blobby: true }
			await handleExecuteAdlibAction(context, {
				playlistId,
				actionDocId,
				actionId,
				userData,
			})

			expect(syncPlayheadInfinitesForNextPartInstanceMock).toHaveBeenCalledTimes(1)
			expect(updateTimelineMock).toHaveBeenCalledTimes(1)
		})

		test('safe current part', async () => {
			context.updateShowStyleBlueprint({
				executeAction: async (context0) => {
					const context = context0 as ActionExecutionContext
					if (context.nextPartState !== ActionPartChange.NONE) throw new Error('nextPartState started wrong')
					if (context.currentPartState !== ActionPartChange.NONE)
						throw new Error('nextPartState started wrong')

					// @ts-ignore
					context.partAndPieceInstanceService.nextPartState = ActionPartChange.SAFE_CHANGE
				},
			})

			const actionDocId: AdLibActionId = protectString('action-id')
			const actionId = 'some-action'
			const userData = { blobby: true }
			await handleExecuteAdlibAction(context, {
				playlistId,
				actionDocId,
				actionId,
				userData,
			})

			expect(syncPlayheadInfinitesForNextPartInstanceMock).toHaveBeenCalledTimes(1)
			expect(updateTimelineMock).toHaveBeenCalledTimes(1)
		})

		test('take after execute (true)', async () => {
			takeNextPartMock.mockImplementationOnce(async () => Promise.resolve())

			context.updateShowStyleBlueprint({
				executeAction: async (context) => {
					await context.takeAfterExecuteAction(true)
				},
			})

			const actionDocId: AdLibActionId = protectString('action-id')
			const actionId = 'some-action'
			const userData = { blobby: true }
			await handleExecuteAdlibAction(context, {
				playlistId,
				actionDocId,
				actionId,
				userData,
			})

			expect(takeNextPartMock).toHaveBeenCalledTimes(1)
		})

		test('take after execute (false)', async () => {
			takeNextPartMock.mockImplementationOnce(async () => Promise.resolve())

			context.updateShowStyleBlueprint({
				executeAction: async (context) => {
					await context.takeAfterExecuteAction(false)
				},
			})

			const actionDocId: AdLibActionId = protectString('action-id')
			const actionId = 'some-action'
			const userData = { blobby: true }
			await handleExecuteAdlibAction(context, {
				playlistId,
				actionDocId,
				actionId,
				userData,
			})

			expect(takeNextPartMock).toHaveBeenCalledTimes(0)
		})

		test('rejectRequest returns error message', async () => {
			const errorMessage = 'This action is not allowed right now'

			context.updateShowStyleBlueprint({
				executeAction: async (context) => {
					context.rejectRequest(errorMessage)
				},
			})

			const actionDocId: AdLibActionId = protectString('action-id')
			const actionId = 'some-action'
			const userData = { blobby: true }
			const result = await handleExecuteAdlibAction(context, {
				playlistId,
				actionDocId,
				actionId,
				userData,
			})

			expect(result.errorMessage).toBe(errorMessage)
			expect(result.taken).toBeFalsy()
		})
	})
})
