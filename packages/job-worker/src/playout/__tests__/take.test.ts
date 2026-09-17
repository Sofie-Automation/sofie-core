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
const { postProcessPieces: postProcessPiecesOrig } = jest.requireActual('../../blueprints/postProcess')
;(postProcessPieces as jest.Mock).mockImplementation(postProcessPiecesOrig)

describe('take', () => {
	async function setupTakenPlaylist() {
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
})
