import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { getResolvedSegment } from '@sofie-automation/corelib/dist/playout/stateCacheResolver'
import { toResolvedSegmentStatus } from '../segments/toResolvedSegmentStatus.js'
import {
	makePart,
	makePartInstance,
	makePieceInstance,
	makePlaylist,
	makeRundown,
	makeSegment,
	makeTestShowStyleBaseExt,
} from './resolvedPlaylistConversionTestUtils.js'
import { createResolvedPlaylistConversionContext } from '../context/conversionContext.js'

jest.mock('@sofie-automation/corelib/dist/playout/stateCacheResolver', () => ({
	getResolvedSegment: jest.fn(),
}))

describe('toResolvedSegmentStatus', () => {
	it('maps resolved segment to API shape and sorts layers', () => {
		;(getResolvedSegment as jest.Mock).mockReturnValue({
			segmentExtended: {
				sourceLayers: {
					sl2: { _rank: 2, name: 'SL2', abbreviation: 'S2', isHidden: true, type: 3 },
					sl1: { _rank: 1, name: 'SL1', abbreviation: 'S1', isHidden: false, type: 2 },
				},
				outputLayers: {
					ol2: { name: 'Output B', isFlattened: true, isPGM: false, sourceLayers: [{ _id: 'sl2' }] },
					ol1: { name: 'Output A', isFlattened: false, isPGM: true, sourceLayers: [{ _id: 'sl1' }] },
				},
			},
			parts: [
				{
					partId: protectString('part0'),
					instance: makePartInstance('pi0', 'part0', 'segment0', 'rundown0'),
					pieces: [{ instance: makePieceInstance('piece0') }],
				},
			],
		})

		const segment = makeSegment('segment0', 'rundown0', 1)
		const rundown = makeRundown('rundown0')
		const ctx = createResolvedPlaylistConversionContext({
			playlistState: makePlaylist(),
			rundownsState: [rundown],
			showStyleBaseExtState: makeTestShowStyleBaseExt(),
			segmentsState: [segment],
			partsState: [makePart('part0', 'rundown0', 'segment0', 1)],
			partInstancesInPlaylistState: [makePartInstance('pi0', 'part0', 'segment0', 'rundown0')],
			piecesInPlaylistState: [makePieceInstance('piece0').piece],
			pieceInstancesInPlaylistState: [makePieceInstance('piece0')],
		})

		const result = toResolvedSegmentStatus(ctx, segment, rundown)
		expect(result).toMatchObject({
			id: 'segment0',
			externalId: 'ext_segment0',
			identifier: 'ident_segment0',
			name: 'Segment segment0',
			rank: 1,
			isHidden: false,
			timing: { startMs: 0, endMs: 3000, budgetDurationMs: 3000 },
		})
		expect(result.sourceLayers.map((s) => s.id)).toEqual(['sl1', 'sl2'])
		expect(result.outputLayers.map((s) => s.id)).toEqual(['ol1', 'ol2'])
		expect(result.parts).toHaveLength(1)
	})

	it('resolves per-rundown showStyleBaseExt in mixed-showstyle playlists', () => {
		const showStyleBaseExtA = makeTestShowStyleBaseExt()
		const showStyleBaseExtB = {
			...makeTestShowStyleBaseExt(),
			_id: protectString('showStyleBaseB'),
			sourceLayerNamesById: new Map([['sourceLayerX', 'SourceLayerX_fromShowStyleB']]),
			outputLayerNamesById: new Map([['outputLayerX', 'OutputLayerX_fromShowStyleB']]),
		}

		;(getResolvedSegment as jest.Mock).mockReturnValue({
			segmentExtended: {
				sourceLayers: {
					sourceLayerX: { _rank: 1 },
				},
				outputLayers: {
					outputLayerX: { sourceLayers: [{ _id: 'sourceLayerX' }] },
				},
			},
			parts: [],
		})

		const rundown0 = makeRundown('rundown0')
		const rundown1 = makeRundown('rundown1')
		rundown0.showStyleBaseId = showStyleBaseExtA._id
		rundown1.showStyleBaseId = showStyleBaseExtB._id

		const segment = makeSegment('segment1', 'rundown1', 1)
		const ctx = createResolvedPlaylistConversionContext({
			playlistState: makePlaylist(),
			rundownsState: [rundown0, rundown1],
			// Fallback showstyle:
			showStyleBaseExtState: showStyleBaseExtA,
			showStyleBaseExtsByIdState: new Map([
				[showStyleBaseExtA._id, showStyleBaseExtA],
				[showStyleBaseExtB._id, showStyleBaseExtB],
			]),
			segmentsState: [segment],
			partsState: [],
			partInstancesInPlaylistState: [],
			piecesInPlaylistState: [],
			pieceInstancesInPlaylistState: [],
		})

		const result = toResolvedSegmentStatus(ctx, segment, rundown1)

		expect(getResolvedSegment).toHaveBeenCalledWith(expect.objectContaining({ showStyleBase: showStyleBaseExtB }))
		expect(result.sourceLayers).toMatchObject([{ id: 'sourceLayerX', name: 'SourceLayerX_fromShowStyleB' }])
		expect(result.outputLayers).toMatchObject([{ id: 'outputLayerX', name: 'OutputLayerX_fromShowStyleB' }])
	})
})
