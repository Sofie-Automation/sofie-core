import {
	makeMockHandlers,
	makeMockLogger,
	makeMockSubscriber,
	makeTestPlaylist,
	makeTestShowStyleBase,
} from './utils.js'
import { ShowStyleBaseExt } from '../../collections/showStyleBaseHandler.js'
import { protectString } from '@sofie-automation/server-core-integration/dist'
import { PartialDeep } from 'type-fest'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { SelectedPieceInstances } from '../../collections/pieceInstancesHandler.js'
import { PieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { ActivePiecesTopic } from '../activePiecesTopic.js'
import { ActivePiecesEvent } from '@sofie-automation/live-status-gateway-api'

describe('ActivePiecesTopic', () => {
	it('provides active pieces', async () => {
		const handlers = makeMockHandlers()
		const topic = new ActivePiecesTopic(makeMockLogger(), handlers)
		const mockSubscriber = makeMockSubscriber()

		const currentPartInstanceId = 'CURRENT_PART_INSTANCE_ID'

		const playlist = makeTestPlaylist()
		playlist.activationId = protectString('somethingRandom')
		playlist.currentPartInfo = {
			consumesQueuedSegmentId: false,
			manuallySelected: false,
			partInstanceId: protectString(currentPartInstanceId),
			rundownId: playlist.rundownIdsInOrder[0],
		}
		handlers.playlistHandler.notify(playlist)

		const testShowStyleBase = makeTestShowStyleBase()
		handlers.showStyleBaseHandler.notify(testShowStyleBase as ShowStyleBaseExt)

		const testPieceInstances: PartialDeep<SelectedPieceInstances> = {
			currentPartInstance: [],
			nextPartInstance: [],
			active: [
				literal<PartialDeep<PieceInstance>>({
					_id: protectString('PIECE_1'),
					piece: {
						name: 'Piece 1',
						outputLayerId: 'pgm',
						sourceLayerId: 'layer0',
						tags: ['my_tag'],
						publicData: { c: 'd' },
					},
				}),
			] as PieceInstance[],
		}
		handlers.pieceInstancesHandler.notify(testPieceInstances as SelectedPieceInstances)

		topic.addSubscriber(mockSubscriber)

		const expectedStatus: PartialDeep<ActivePiecesEvent> = {
			event: 'activePieces',

			activePieces: [
				{
					id: 'PIECE_1',
					name: 'Piece 1',
					sourceLayer: 'Layer 0',
					outputLayer: 'PGM',
					tags: ['my_tag'],
					publicData: { c: 'd' },
				},
			],
		}

		// eslint-disable-next-line @typescript-eslint/unbound-method
		expect(mockSubscriber.send).toHaveBeenCalledTimes(1)
		expect(JSON.parse(mockSubscriber.send.mock.calls[0][0] as string)).toMatchObject(expectedStatus)
	})
})
