import { PieceLifespan } from '@sofie-automation/blueprints-integration'
import { wrapDefaultObject } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import {
	PeripheralDeviceCategory,
	PeripheralDeviceType,
	PERIPHERAL_SUBTYPE_PROCESS,
} from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'
import { MockJobContext, setupDefaultJobEnvironment } from '../../__mocks__/context.js'
import {
	setupDefaultRundownPlaylist,
	setupMockPeripheralDevice,
	setupMockShowStyleCompound,
} from '../../__mocks__/presetCollections.js'
import { handleActivateRundownPlaylist } from '../activePlaylistJobs.js'
import { performTakeToNextedPart, handleTakeNextPart } from '../take.js'
import { runJobWithPlayoutModel } from '../lock.js'
import { PartAndPieceInstanceActionService } from '../../blueprints/context/services/PartAndPieceInstanceActionService.js'
import { OnTakeContext } from '../../blueprints/context/OnTakeContext.js'
import { WatchedPackagesHelper } from '../../blueprints/context/watchedPackages.js'
import { getCurrentTime } from '../../lib/index.js'

jest.mock('../../blueprints/postProcess')
import { postProcessPieces } from '../../blueprints/postProcess.js'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { RundownId, RundownPlaylistId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { UserErrorMessage } from '@sofie-automation/corelib/dist/error'
const { postProcessPieces: postProcessPiecesOrig } = jest.requireActual('../../blueprints/postProcess')
;(postProcessPieces as jest.Mock).mockImplementation(postProcessPiecesOrig)

describe('take', () => {
	async function setupTakenPlaylist(
		beforeActivate?: (context: MockJobContext, rundownId: RundownId) => Promise<void>
	) {
		const context: MockJobContext = setupDefaultJobEnvironment()

		context.setStudio({
			...context.rawStudio,
			settingsWithOverrides: wrapDefaultObject({
				...context.studio.settings,
				minimumTakeSpan: 0,
			}),
		})

		jest.spyOn(context, 'queueEventJob').mockImplementation(async () => Promise.resolve())

		await setupMockShowStyleCompound(context)
		await setupMockPeripheralDevice(
			context,
			PeripheralDeviceCategory.PLAYOUT,
			PeripheralDeviceType.PLAYOUT,
			PERIPHERAL_SUBTYPE_PROCESS
		)

		const { rundownId, playlistId } = await setupDefaultRundownPlaylist(context)

		if (beforeActivate) await beforeActivate(context, rundownId)

		await handleActivateRundownPlaylist(context, { playlistId, rehearsal: false })
		await handleTakeNextPart(context, { playlistId, fromPartInstanceId: null })

		return { context, rundownId, playlistId }
	}

	test('performTakeToNextedPart queues part after take with insert before target', async () => {
		const { context, rundownId, playlistId } = await setupTakenPlaylist()

		const targetPart = await context.mockCollections.Parts.findOne({
			externalId: 'MOCK_PART_1_1',
			rundownId,
		})
		expect(targetPart).toBeTruthy()
		if (!targetPart) throw new Error('targetPart not found')

		await runJobWithPlayoutModel(context, { playlistId }, null, async (playoutModel) => {
			const currentPartInstance = playoutModel.currentPartInstance
			expect(currentPartInstance).toBeTruthy()
			if (!currentPartInstance) throw new Error('currentPartInstance not found')

			const showStyle = await context.getShowStyleCompound(
				playoutModel.rundowns[0].rundown.showStyleVariantId,
				playoutModel.rundowns[0].rundown.showStyleBaseId
			)
			const service = new PartAndPieceInstanceActionService(context, playoutModel, showStyle)

			const partToQueueAfterTake = service.prepareQueueablePartAndPieces(
				{ externalId: 'after_take', title: 'After take part' },
				[
					{
						name: 'after take piece',
						sourceLayerId: 'sl0',
						outputLayerId: 'o0',
						externalId: '-',
						enable: { start: 0 },
						lifespan: PieceLifespan.WithinPart,
						content: {
							timelineObjects: [],
						},
					},
				],
				currentPartInstance,
				{ targetPartId: unprotectString(targetPart._id) }
			)

			expect(partToQueueAfterTake.target?.targetPartId).toEqual(unprotectString(targetPart._id))
			expect(partToQueueAfterTake.target?.after).toBeFalsy()

			await performTakeToNextedPart(context, playoutModel, getCurrentTime(), partToQueueAfterTake)

			const nextPartInstanceId = playoutModel.playlist.nextPartInfo?.partInstanceId
			expect(nextPartInstanceId).toBeTruthy()
			if (!nextPartInstanceId) throw new Error('nextPartInstanceId not found')

			const queuedPartInstance = playoutModel.getPartInstance(nextPartInstanceId)
			expect(queuedPartInstance).toBeTruthy()
			if (!queuedPartInstance) throw new Error('queuedPartInstance not found')

			expect(queuedPartInstance.partInstance.segmentId).toEqual(targetPart.segmentId)
			expect(queuedPartInstance.partInstance.part._rank).toBeLessThan(targetPart._rank)
			expect(queuedPartInstance.partInstance.part.title).toEqual('After take part')
		})
	})

	test('performTakeToNextedPart queues part after take with insert after target', async () => {
		const { context, rundownId, playlistId } = await setupTakenPlaylist()

		const targetPart = await context.mockCollections.Parts.findOne({
			externalId: 'MOCK_PART_1_0',
			rundownId,
		})
		expect(targetPart).toBeTruthy()
		if (!targetPart) throw new Error('targetPart not found')

		const partAfterTarget = await context.mockCollections.Parts.findOne({
			externalId: 'MOCK_PART_1_1',
			rundownId,
		})
		expect(partAfterTarget).toBeTruthy()
		if (!partAfterTarget) throw new Error('partAfterTarget not found')

		await runJobWithPlayoutModel(context, { playlistId }, null, async (playoutModel) => {
			const currentPartInstance = playoutModel.currentPartInstance
			expect(currentPartInstance).toBeTruthy()
			if (!currentPartInstance) throw new Error('currentPartInstance not found')

			const showStyle = await context.getShowStyleCompound(
				playoutModel.rundowns[0].rundown.showStyleVariantId,
				playoutModel.rundowns[0].rundown.showStyleBaseId
			)
			const service = new PartAndPieceInstanceActionService(context, playoutModel, showStyle)

			const partToQueueAfterTake = service.prepareQueueablePartAndPieces(
				{ externalId: 'after_take', title: 'After take part' },
				[
					{
						name: 'after take piece',
						sourceLayerId: 'sl0',
						outputLayerId: 'o0',
						externalId: '-',
						enable: { start: 0 },
						lifespan: PieceLifespan.WithinPart,
						content: {
							timelineObjects: [],
						},
					},
				],
				currentPartInstance,
				{ targetPartId: unprotectString(targetPart._id), after: true }
			)

			expect(partToQueueAfterTake.target?.targetPartId).toEqual(unprotectString(targetPart._id))
			expect(partToQueueAfterTake.target?.after).toEqual(true)

			await performTakeToNextedPart(context, playoutModel, getCurrentTime(), partToQueueAfterTake)

			const nextPartInstanceId = playoutModel.playlist.nextPartInfo?.partInstanceId
			expect(nextPartInstanceId).toBeTruthy()
			if (!nextPartInstanceId) throw new Error('nextPartInstanceId not found')

			const queuedPartInstance = playoutModel.getPartInstance(nextPartInstanceId)
			expect(queuedPartInstance).toBeTruthy()
			if (!queuedPartInstance) throw new Error('queuedPartInstance not found')

			expect(queuedPartInstance.partInstance.part._rank).toBeGreaterThan(targetPart._rank)
			expect(queuedPartInstance.partInstance.part._rank).toBeLessThan(partAfterTarget._rank)
			expect(queuedPartInstance.partInstance.part.title).toEqual('After take part')
		})
	})

	test('performTakeToNextedPart queues omitted-target part using next part rundown and segment', async () => {
		const { context, playlistId } = await setupTakenPlaylist()

		const playlist = await context.mockCollections.RundownPlaylists.findOne(playlistId)
		if (!playlist?.currentPartInfo?.partInstanceId) throw new Error('currentPartInstance not found')

		await handleTakeNextPart(context, {
			playlistId,
			fromPartInstanceId: playlist.currentPartInfo.partInstanceId,
		})

		await runJobWithPlayoutModel(context, { playlistId }, null, async (playoutModel) => {
			const currentPartInstance = playoutModel.currentPartInstance
			const nextPartInstance = playoutModel.nextPartInstance
			expect(currentPartInstance).toBeTruthy()
			expect(nextPartInstance).toBeTruthy()
			if (!currentPartInstance || !nextPartInstance) throw new Error('partInstances not found')
			expect(currentPartInstance.partInstance.segmentId).not.toEqual(nextPartInstance.partInstance.segmentId)

			const takenSegmentId = nextPartInstance.partInstance.segmentId
			const takenRundownId = nextPartInstance.partInstance.rundownId

			const showStyle = await context.getShowStyleCompound(
				playoutModel.rundowns[0].rundown.showStyleVariantId,
				playoutModel.rundowns[0].rundown.showStyleBaseId
			)
			const onTakeContext = new OnTakeContext(
				{ name: 'test', identifier: 'test' },
				context,
				playoutModel,
				showStyle,
				WatchedPackagesHelper.empty(context),
				new PartAndPieceInstanceActionService(context, playoutModel, showStyle)
			)

			;(postProcessPieces as jest.Mock).mockClear()
			onTakeContext.queuePartAfterTake({ externalId: 'after_take', title: 'After take part' }, [
				{
					name: 'after take piece',
					sourceLayerId: 'sl0',
					outputLayerId: 'o0',
					externalId: '-',
					enable: { start: 0 },
					lifespan: PieceLifespan.WithinPart,
					content: {
						timelineObjects: [],
					},
				},
			])

			expect(postProcessPieces).toHaveBeenCalledTimes(1)
			expect(postProcessPieces).toHaveBeenCalledWith(
				expect.anything(),
				expect.any(Array),
				expect.anything(),
				takenRundownId,
				takenSegmentId,
				expect.anything(),
				false
			)

			await performTakeToNextedPart(context, playoutModel, getCurrentTime(), onTakeContext.partToQueueAfterTake)

			const nextPartInstanceId = playoutModel.playlist.nextPartInfo?.partInstanceId
			expect(nextPartInstanceId).toBeTruthy()
			if (!nextPartInstanceId) throw new Error('nextPartInstanceId not found')

			const queuedPartInstance = playoutModel.getPartInstance(nextPartInstanceId)
			expect(queuedPartInstance).toBeTruthy()
			if (!queuedPartInstance) throw new Error('queuedPartInstance not found')

			expect(queuedPartInstance.partInstance.segmentId).toEqual(takenSegmentId)
			expect(queuedPartInstance.partInstance.rundownId).toEqual(takenRundownId)
			expect(queuedPartInstance.pieceInstances[0].pieceInstance.rundownId).toEqual(takenRundownId)
			expect(queuedPartInstance.partInstance.part.title).toEqual('After take part')
		})
	})
	describe('transition take block', () => {
		const inTransition = {
			blockTakeDuration: 5000,
			previousPartKeepaliveDuration: 0,
			partContentDelayDuration: 0,
		}

		/** Setup the playlist with part0 on air, and part1 taken into, with the given properties set on part0 and part1 */
		async function setupTakenIntoSecondPart(part0Props: Partial<DBPart>, part1Props: Partial<DBPart>) {
			const { context, rundownId, playlistId } = await setupTakenPlaylist(async (context, rundownId) => {
				await context.mockCollections.Parts.update(
					{ rundownId, externalId: 'MOCK_PART_0_0' },
					{ $set: part0Props }
				)
				await context.mockCollections.Parts.update(
					{ rundownId, externalId: 'MOCK_PART_0_1' },
					{ $set: part1Props }
				)
			})

			await takeNext(context, playlistId)

			// Playback of the part has started
			const playlist = await context.mockCollections.RundownPlaylists.findOne(playlistId)
			const currentPartInstanceId = playlist?.currentPartInfo?.partInstanceId
			if (!currentPartInstanceId) throw new Error('currentPartInstanceId not found')
			await context.mockCollections.PartInstances.update(currentPartInstanceId, {
				$set: { 'timings.plannedStartedPlayback': getCurrentTime() },
			})

			return { context, rundownId, playlistId }
		}

		async function takeNext(context: MockJobContext, playlistId: RundownPlaylistId) {
			const playlist = await context.mockCollections.RundownPlaylists.findOne(playlistId)
			return handleTakeNextPart(context, {
				playlistId,
				fromPartInstanceId: playlist?.currentPartInfo?.partInstanceId ?? null,
			})
		}

		test('blocked by the inTransition', async () => {
			const { context, playlistId } = await setupTakenIntoSecondPart({}, { inTransition })

			await expect(takeNext(context, playlistId)).rejects.toMatchUserError(UserErrorMessage.TakeDuringTransition)
		})

		test('blocked by an exclusive outTransition', async () => {
			const { context, playlistId } = await setupTakenIntoSecondPart(
				{
					outTransition: {
						type: 'exclusive',
						blockTakeDuration: 5000,
						partKeepaliveDuration: 0,
						nextPartContentDelayDuration: 0,
					},
				},
				{}
			)

			await expect(takeNext(context, playlistId)).rejects.toMatchUserError(UserErrorMessage.TakeDuringTransition)
		})

		test('not blocked when an exclusive outTransition overrides the inTransition', async () => {
			const { context, playlistId } = await setupTakenIntoSecondPart(
				{
					outTransition: {
						type: 'exclusive',
						blockTakeDuration: 0,
						partKeepaliveDuration: 0,
						nextPartContentDelayDuration: 0,
					},
				},
				{ inTransition }
			)

			await expect(takeNext(context, playlistId)).resolves.toBeTruthy()
		})

		test('not blocked when the additive outTransition disables the inTransition', async () => {
			const { context, playlistId } = await setupTakenIntoSecondPart(
				{ outTransition: { type: 'additive', duration: 0, disableNextInTransition: true } },
				{ inTransition }
			)

			await expect(takeNext(context, playlistId)).resolves.toBeTruthy()
		})

		test('fallback for timings without blockTakeDuration', async () => {
			const { context, playlistId } = await setupTakenIntoSecondPart({}, { inTransition })

			// Simulate timings which were stored before blockTakeDuration was added
			const playlist = await context.mockCollections.RundownPlaylists.findOne(playlistId)
			const currentPartInstanceId = playlist?.currentPartInfo?.partInstanceId
			if (!currentPartInstanceId) throw new Error('currentPartInstanceId not found')
			await context.mockCollections.PartInstances.update(currentPartInstanceId, {
				$unset: { 'partPlayoutTimings.blockTakeDuration': 1, 'partPlayoutTimings.transitionSource': 1 },
			})
			const partInstance = await context.mockCollections.PartInstances.findOne(currentPartInstanceId)
			expect(partInstance?.partPlayoutTimings).toBeTruthy()
			expect(partInstance?.partPlayoutTimings?.blockTakeDuration).toBeUndefined()

			await expect(takeNext(context, playlistId)).rejects.toMatchUserError(UserErrorMessage.TakeDuringTransition)
		})
	})
})
