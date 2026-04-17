import { toResolvedRundownStatus } from '../rundowns/toResolvedRundownStatus.js'
import {
	makePart,
	makePartInstance,
	makePlaylist,
	makeRundown,
	makeSegment,
	makeTestShowStyleBaseExt,
} from './resolvedPlaylistConversionTestUtils.js'
import { createResolvedPlaylistConversionContext } from '../context/conversionContext.js'

jest.mock('../segments/toResolvedSegmentStatus.js', () => ({
	toResolvedSegmentStatus: jest.fn((_ctx, segment) => ({ id: String(segment._id) })),
}))

describe('toResolvedRundownStatus', () => {
	it('maps rundown fields and ordered segments', () => {
		const ctx = createResolvedPlaylistConversionContext({
			playlistState: makePlaylist(),
			rundownsState: [makeRundown('rundown0')],
			showStyleBaseExtState: makeTestShowStyleBaseExt(),
			segmentsState: [makeSegment('segment1', 'rundown0', 2), makeSegment('segment0', 'rundown0', 1)],
			partsState: [makePart('part0', 'rundown0', 'segment0', 0)],
			partInstancesInPlaylistState: [makePartInstance('pi0', 'part0', 'segment0', 'rundown0')],
			piecesInPlaylistState: [],
			pieceInstancesInPlaylistState: [],
		})

		const result = toResolvedRundownStatus(ctx, 'rundown0')
		expect(result).toMatchObject({
			id: 'rundown0',
			externalId: 'ext_rundown0',
			name: 'Rundown rundown0',
			rank: 0,
			description: 'Description rundown0',
		})
		expect(result.segments).toEqual([{ id: 'segment0' }, { id: 'segment1' }])
	})

	it('returns empty defaults when rundown is missing', () => {
		const ctx = createResolvedPlaylistConversionContext({
			playlistState: makePlaylist(),
			rundownsState: [],
			showStyleBaseExtState: makeTestShowStyleBaseExt(),
			segmentsState: [],
			partsState: [],
			partInstancesInPlaylistState: [],
			piecesInPlaylistState: [],
			pieceInstancesInPlaylistState: [],
		})

		const result = toResolvedRundownStatus(ctx, 'missing')
		expect(result.externalId).toBe('')
		expect(result.segments).toEqual([])
		expect(result.rank).toBe(0)
	})
})
