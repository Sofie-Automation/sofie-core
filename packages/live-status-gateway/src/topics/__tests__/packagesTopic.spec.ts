import { protectString, unprotectString } from '@sofie-automation/server-core-integration'
import { makeMockHandlers, makeMockLogger, makeMockSubscriber } from './utils.js'
import { PackagesTopic } from '../packagesTopic.js'
import { UIPieceContentStatus } from '@sofie-automation/corelib/dist/dataModel/PieceContentStatus'
import { PieceStatusCode } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { PackagesEvent, PackageStatus } from '@sofie-automation/live-status-gateway-api'

function makeTestUIPieceContentStatuses(): UIPieceContentStatus[] {
	return [
		{
			pieceId: protectString('PIECE_0'),
			rundownId: protectString('RUNDOWN_0'),
			partId: protectString('PART_0'),
			segmentId: protectString('SEGMENT_0'),
			status: {
				packageName: 'Test Package',
				status: PieceStatusCode.OK,
				thumbnailUrl: 'http://example.com/thumbnail.jpg',
				previewUrl: 'http://example.com/preview.mp4',
				blacks: [],
				contentDuration: 5,
				freezes: [],
				messages: [],
				progress: 0,
				scenes: [],
			},
			_id: protectString('PIECE_CONTENT_STATUS_0'),
			segmentRank: 0,
			partRank: 0,
			isPieceInstance: false,
			name: '',
			segmentName: 'Segment',
		},
	]
}

function makeTestPlaylist(): DBRundownPlaylist {
	return {
		_id: protectString('PLAYLIST_0'),
		activationId: protectString('ACTIVATION_0'),
	} as DBRundownPlaylist
}

describe('PackagesTopic', () => {
	it('notifies subscribers', async () => {
		const handlers = makeMockHandlers()
		const topic = new PackagesTopic(makeMockLogger(), handlers)
		const mockSubscriber = makeMockSubscriber()

		const playlist = makeTestPlaylist()
		handlers.playlistHandler.notify(playlist)

		const testUIPieceContentStatuses = makeTestUIPieceContentStatuses()
		handlers.pieceContentStatusesHandler.notify(testUIPieceContentStatuses)

		topic.addSubscriber(mockSubscriber)

		const expectedStatus: PackagesEvent = {
			event: 'packages',
			rundownPlaylistId: unprotectString(playlist._id),
			packages: [
				{
					packageName: 'Test Package',
					status: PackageStatus.OK,
					pieceOrAdLibId: 'PIECE_0',
					rundownId: 'RUNDOWN_0',
					partId: 'PART_0',
					segmentId: 'SEGMENT_0',
					thumbnailUrl: 'http://example.com/thumbnail.jpg',
					previewUrl: 'http://example.com/preview.mp4',
				},
			],
		}

		// eslint-disable-next-line @typescript-eslint/unbound-method
		expect(mockSubscriber.send).toHaveBeenCalledTimes(1)
		expect(JSON.parse(mockSubscriber.send.mock.calls[0][0] as string)).toMatchObject(expectedStatus)
	})
})
