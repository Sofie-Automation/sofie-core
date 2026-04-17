import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { ResolvedPartState } from '@sofie-automation/live-status-gateway-api'
import { toResolvedPartStatus } from '../parts/toResolvedPartStatus.js'
import {
	makePartInstance,
	makePieceInstance,
	makePlaylist,
	makeRundown,
	makeSegment,
	makeTestShowStyleBaseExt,
} from './resolvedPlaylistConversionTestUtils.js'
import { createResolvedPlaylistConversionContext } from '../context/conversionContext.js'

describe('toResolvedPartStatus', () => {
	it('maps current part state and nested pieces', () => {
		const currentPartInstanceId = protectString('current_pi')
		const ctx = createResolvedPlaylistConversionContext({
			playlistState: makePlaylist({
				currentPartInfo: { partInstanceId: currentPartInstanceId },
			}),
			rundownsState: [makeRundown('rundown0')],
			showStyleBaseExtState: makeTestShowStyleBaseExt(),
			segmentsState: [makeSegment('segment0', 'rundown0', 0)],
			partsState: [],
			partInstancesInPlaylistState: [makePartInstance('current_pi', 'part0', 'segment0', 'rundown0')],
			piecesInPlaylistState: [],
			pieceInstancesInPlaylistState: [],
		})

		const partExtended = {
			partId: protectString('part0'),
			instance: {
				...makePartInstance('current_pi', 'part0', 'segment0', 'rundown0'),
				orphaned: 'adlib-part',
			},
			startsAt: 1000,
			renderedDuration: 2000,
			pieces: [{ instance: makePieceInstance('piece0') }],
		} as any

		const result = toResolvedPartStatus(ctx, partExtended)
		expect(result.state).toBe(ResolvedPartState.CURRENT)
		expect(result.createdByAdLib).toBe(true)
		expect(result.id).toBe('part0')
		expect(result.instanceId).toBe('current_pi')
		expect(result.timing).toMatchObject({
			startMs: 1000,
			durationMs: 2000,
			plannedStartedPlayback: 10,
			reportedStartedPlayback: 11,
			playOffset: 12,
			setAsNext: 13,
			take: 14,
		})
		expect(result.pieces).toHaveLength(1)
	})

	it('maps next part state and default timing fallbacks', () => {
		const nextPartInstanceId = protectString('next_pi')
		const ctx = createResolvedPlaylistConversionContext({
			playlistState: makePlaylist({
				nextPartInfo: { partInstanceId: nextPartInstanceId },
			}),
			rundownsState: [makeRundown('rundown0')],
			showStyleBaseExtState: makeTestShowStyleBaseExt(),
			segmentsState: [makeSegment('segment0', 'rundown0', 0)],
			partsState: [],
			partInstancesInPlaylistState: [makePartInstance('next_pi', 'part1', 'segment0', 'rundown0')],
			piecesInPlaylistState: [],
			pieceInstancesInPlaylistState: [],
		})

		const partExtended = {
			partId: protectString('part1'),
			instance: makePartInstance('next_pi', 'part1', 'segment0', 'rundown0'),
		} as any

		const result = toResolvedPartStatus(ctx, partExtended)
		expect(result.state).toBe(ResolvedPartState.NEXT)
		expect(result.timing.startMs).toBe(0)
		expect(result.timing.durationMs).toBe(0)
		expect(result.pieces).toEqual([])
	})
})
