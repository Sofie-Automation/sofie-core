import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import {
	createResolvedPlaylistConversionContext,
	findCurrentPartInstance,
	findNextPartInstance,
	getOrderedPartsInRundown,
	getOrderedSegmentsInRundown,
} from '../context/conversionContext.js'
import {
	makePart,
	makePartInstance,
	makePieceInstance,
	makePlaylist,
	makeRundown,
	makeSegment,
	makeTestShowStyleBaseExt,
} from './resolvedPlaylistConversionTestUtils.js'

describe('conversionContext', () => {
	it('builds sorted lookup context and current/next pointers', () => {
		const currentId = protectString('current_pi')
		const nextId = protectString('next_pi')
		const playlist = makePlaylist({
			currentPartInfo: { partInstanceId: currentId },
			nextPartInfo: { partInstanceId: nextId },
		})
		const ctx = createResolvedPlaylistConversionContext({
			playlistState: playlist,
			rundownsState: [makeRundown('rundown0')],
			showStyleBaseExtState: makeTestShowStyleBaseExt(),
			segmentsState: [makeSegment('segment1', 'rundown0', 2), makeSegment('segment0', 'rundown0', 1)],
			partsState: [makePart('part1', 'rundown0', 'segment0', 2), makePart('part0', 'rundown0', 'segment0', 1)],
			partInstancesInPlaylistState: [
				makePartInstance('next_pi', 'part1', 'segment0', 'rundown0'),
				makePartInstance('current_pi', 'part0', 'segment0', 'rundown0'),
			],
			piecesInPlaylistState: [makePieceInstance('pi0').piece],
			pieceInstancesInPlaylistState: [makePieceInstance('pi0')],
		})

		expect(getOrderedSegmentsInRundown(ctx, 'rundown0').map((s) => String(s._id))).toEqual(['segment0', 'segment1'])
		expect(getOrderedPartsInRundown(ctx, 'rundown0').map((p) => String(p._id))).toEqual(['part0', 'part1'])
		expect(String(ctx.currentPartInstance?._id)).toBe('current_pi')
		expect(String(ctx.nextPartInstance?._id)).toBe('next_pi')
		expect(ctx.orderedRundownIds).toEqual(['rundown0', 'rundown1'])
	})

	it('query adapters filter data correctly', () => {
		const ctx = createResolvedPlaylistConversionContext({
			playlistState: makePlaylist(),
			rundownsState: [makeRundown('rundown0')],
			showStyleBaseExtState: makeTestShowStyleBaseExt(),
			segmentsState: [makeSegment('segment0', 'rundown0', 0)],
			partsState: [makePart('part0', 'rundown0', 'segment0', 0)],
			partInstancesInPlaylistState: [makePartInstance('pi0', 'part0', 'segment0', 'rundown0')],
			piecesInPlaylistState: [makePieceInstance('x').piece],
			pieceInstancesInPlaylistState: [makePieceInstance('x')],
		})

		expect(String(ctx.accessors.segmentsFindOne({ _id: protectString('segment0') } as any, {} as any)?._id)).toBe(
			'segment0'
		)
		expect(
			ctx.accessors.getActivePartInstances({ _id: protectString('playlist0') } as any, {
				_id: protectString('pi0'),
			}).length
		).toBe(1)
		expect(ctx.accessors.piecesFind({ _id: protectString('piece_x') } as any).length).toBe(1)
		expect(ctx.accessors.pieceInstancesFind({ _id: protectString('x') } as any).length).toBe(1)
	})

	it('throws when required playlist/showStyle is missing', () => {
		expect(() =>
			createResolvedPlaylistConversionContext({
				playlistState: undefined,
				rundownsState: [],
				showStyleBaseExtState: makeTestShowStyleBaseExt(),
				segmentsState: [],
				partsState: [],
				partInstancesInPlaylistState: [],
				piecesInPlaylistState: [],
				pieceInstancesInPlaylistState: [],
			})
		).toThrow('Missing playlist or showStyleBaseExt')
	})

	it('findCurrentPartInstance/findNextPartInstance return undefined when ids are absent', () => {
		const playlist = makePlaylist()
		expect(
			findCurrentPartInstance(playlist, [makePartInstance('pi0', 'part0', 'segment0', 'rundown0')])
		).toBeUndefined()
		expect(
			findNextPartInstance(playlist, [makePartInstance('pi1', 'part1', 'segment0', 'rundown0')])
		).toBeUndefined()
	})
})
