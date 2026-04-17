import { PlaylistTimingType } from '@sofie-automation/blueprints-integration'
import { PlaylistActivationStatus, ResolvedPlaylistTimingType } from '@sofie-automation/live-status-gateway-api'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { toResolvedPlaylistStatus } from '../events/toResolvedPlaylistStatus.js'
import {
	makePart,
	makePartInstance,
	makePieceInstance,
	makePlaylist,
	makeQuickLoop,
	makeRundown,
	makeSegment,
	makeTestShowStyleBaseExt,
} from './resolvedPlaylistConversionTestUtils.js'

jest.mock('../rundowns/toResolvedRundownStatus.js', () => ({
	toResolvedRundownStatus: jest.fn((_ctx, rundownId) => ({ id: rundownId })),
}))

describe('toResolvedPlaylistStatus', () => {
	it('returns empty payload when playlist or showStyle is missing', () => {
		const result = toResolvedPlaylistStatus({
			playlistState: undefined,
			rundownsState: [],
			showStyleBaseExtState: undefined,
			segmentsState: [],
			partsState: [],
			partInstancesInPlaylistState: [],
			piecesInPlaylistState: [],
			pieceInstancesInPlaylistState: [],
		})

		expect(result).toMatchObject({
			event: 'resolvedPlaylist',
			id: '',
			externalId: '',
			name: '',
			activationStatus: PlaylistActivationStatus.DEACTIVATED,
			rundowns: [],
			timing: {
				type: ResolvedPlaylistTimingType.FORWARD,
				startMs: null,
				durationMs: null,
				endMs: null,
			},
		})
	})

	it('assembles full payload and maps activation/timing/quickLoop', () => {
		const playlist = makePlaylist({
			activationId: protectString('activation0'),
			rehearsal: true,
			quickLoop: makeQuickLoop(),
			currentPartInfo: { partInstanceId: protectString('current_pi') },
			nextPartInfo: { partInstanceId: protectString('next_pi') },
			timing: { type: PlaylistTimingType.BackTime, expectedDuration: 15000 },
		})

		const result = toResolvedPlaylistStatus({
			playlistState: playlist,
			rundownsState: [makeRundown('rundown0'), makeRundown('rundown1')],
			showStyleBaseExtState: makeTestShowStyleBaseExt(),
			segmentsState: [makeSegment('segment0', 'rundown0', 0)],
			partsState: [makePart('part0', 'rundown0', 'segment0', 0)],
			partInstancesInPlaylistState: [
				makePartInstance('current_pi', 'part0', 'segment0', 'rundown0'),
				makePartInstance('next_pi', 'part0', 'segment0', 'rundown0'),
			],
			piecesInPlaylistState: [makePieceInstance('piece0').piece],
			pieceInstancesInPlaylistState: [makePieceInstance('piece0')],
		})

		expect(result.activationStatus).toBe(PlaylistActivationStatus.REHEARSAL)
		expect(result.currentPartInstanceId).toBe('current_pi')
		expect(result.nextPartInstanceId).toBe('next_pi')
		expect(result.timing).toMatchObject({
			type: ResolvedPlaylistTimingType.BACK,
			startMs: 0,
			durationMs: 15000,
			endMs: 15000,
		})
		expect(result.quickLoop).toBeDefined()
		expect(result.rundowns).toEqual([{ id: 'rundown0' }, { id: 'rundown1' }])
	})
})
