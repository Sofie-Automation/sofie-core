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

	it('orders parts by segment order, then by part rank', () => {
		const ctx = createResolvedPlaylistConversionContext({
			playlistState: makePlaylist(),
			rundownsState: [makeRundown('rundown0')],
			showStyleBaseExtState: makeTestShowStyleBaseExt(),
			segmentsState: [makeSegment('segment1', 'rundown0', 2), makeSegment('segment0', 'rundown0', 1)],
			partsState: [
				// Deliberately interleave segments and ranks:
				// - segment0 should still come first overall (because segment order)
				// - within each segment, sort by part rank
				makePart('partA', 'rundown0', 'segment0', 20),
				makePart('partC', 'rundown0', 'segment1', 2),
				makePart('partB', 'rundown0', 'segment0', 10),
				makePart('partD', 'rundown0', 'segment1', 1),
			],
			partInstancesInPlaylistState: [],
			piecesInPlaylistState: [],
			pieceInstancesInPlaylistState: [],
		})

		expect(getOrderedPartsInRundown(ctx, 'rundown0').map((p) => String(p._id))).toEqual([
			'partB',
			'partA',
			'partD',
			'partC',
		])
	})

	it('maps rundowns to their own showStyleBaseId', () => {
		const playlist = makePlaylist()
		const rundown0 = makeRundown('rundown0')
		const rundown1 = makeRundown('rundown1')
		rundown0.showStyleBaseId = protectString('showStyleBaseA')
		rundown1.showStyleBaseId = protectString('showStyleBaseB')

		const ctx = createResolvedPlaylistConversionContext({
			playlistState: playlist,
			rundownsState: [rundown0, rundown1],
			showStyleBaseExtState: makeTestShowStyleBaseExt(),
			segmentsState: [],
			partsState: [],
			partInstancesInPlaylistState: [],
			piecesInPlaylistState: [],
			pieceInstancesInPlaylistState: [],
		})

		expect(String(ctx.rundownsToShowStyles.get(protectString('rundown0')))).toBe('showStyleBaseA')
		expect(String(ctx.rundownsToShowStyles.get(protectString('rundown1')))).toBe('showStyleBaseB')
	})

	it('omits missing rundowns from rundownsToShowStyles', () => {
		const playlist = makePlaylist()
		const rundown0 = makeRundown('rundown0')
		rundown0.showStyleBaseId = protectString('showStyleBaseA')

		const ctx = createResolvedPlaylistConversionContext({
			playlistState: playlist,
			rundownsState: [rundown0],
			showStyleBaseExtState: makeTestShowStyleBaseExt(),
			segmentsState: [],
			partsState: [],
			partInstancesInPlaylistState: [],
			piecesInPlaylistState: [],
			pieceInstancesInPlaylistState: [],
		})

		expect(String(ctx.rundownsToShowStyles.get(protectString('rundown0')))).toBe('showStyleBaseA')
		expect(ctx.rundownsToShowStyles.has(protectString('rundown1'))).toBe(false)
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

	it('getActivePartInstances omits reset part instances', () => {
		const resetInstance = makePartInstance('pi_reset', 'part0', 'segment0', 'rundown0')
		resetInstance.reset = true

		const ctx = createResolvedPlaylistConversionContext({
			playlistState: makePlaylist(),
			rundownsState: [makeRundown('rundown0')],
			showStyleBaseExtState: makeTestShowStyleBaseExt(),
			segmentsState: [makeSegment('segment0', 'rundown0', 0)],
			partsState: [makePart('part0', 'rundown0', 'segment0', 0)],
			partInstancesInPlaylistState: [makePartInstance('pi0', 'part0', 'segment0', 'rundown0'), resetInstance],
			piecesInPlaylistState: [],
			pieceInstancesInPlaylistState: [],
		})

		expect(
			ctx.accessors.getActivePartInstances({ _id: protectString('playlist0') } as any).map((p) => String(p._id))
		).toEqual(['pi0'])
		expect(
			ctx.accessors.getActivePartInstances({ _id: protectString('playlist0') } as any, {
				_id: protectString('pi_reset'),
			}).length
		).toBe(0)
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
