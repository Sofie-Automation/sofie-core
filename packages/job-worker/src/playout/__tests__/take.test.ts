import { PieceLifespan } from '@sofie-automation/blueprints-integration'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
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
import { getCurrentTime } from '../../lib/index.js'

jest.mock('../../blueprints/postProcess')
import { postProcessPieces } from '../../blueprints/postProcess.js'
const { postProcessPieces: postProcessPiecesOrig } = jest.requireActual('../../blueprints/postProcess')
;(postProcessPieces as jest.Mock).mockImplementation(postProcessPiecesOrig)

describe('take', () => {
	test('performTakeToNextedPart queues part after take with insertBeforeId', async () => {
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
				unprotectString(targetPart._id)
			)

			expect(partToQueueAfterTake.insertBeforeId).toEqual(targetPart._id)

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
})
