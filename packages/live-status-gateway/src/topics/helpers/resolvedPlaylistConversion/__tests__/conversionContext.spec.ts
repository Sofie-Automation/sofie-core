import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { mongoWhereFilter } from '@sofie-automation/corelib/dist/mongo'
import { buildPastInfinitePiecesForThisPartQuery } from '@sofie-automation/corelib/dist/playout/infinites'
import { PieceLifespan } from '@sofie-automation/blueprints-integration'
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
	makeLargeActivePlaylist,
} from './resolvedPlaylistConversionTestUtils.js'

describe('conversionContext', () => {
	it('builds sorted lookup context and current/next pointers', () => {
		const currentId = protectString('current_pi')
		const nextId = protectString('next_pi')
		const playlist = makePlaylist({
			defaultBrandingId: null,
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

describe('conversionContext accessors', () => {
	// The accessors look documents up through indexes. They must return exactly what a plain scan of the whole
	// playlist would, in the same order, for any selector.
	const props = makeLargeActivePlaylist({
		rundowns: 2,
		segmentsPerRundown: 4,
		partsPerSegment: 3,
		piecesPerPart: 4,
		playedParts: 5,
		now: 1_700_000_000_000,
	})
	const ctx = createResolvedPlaylistConversionContext(props)
	const playlist = props.playlistState as any
	const ids = (docs: Array<{ _id: unknown }> | undefined) => (docs ?? []).map((d) => String(d._id))

	const segment = props.segmentsState[1]
	const part = props.partsState[7]
	const partInstance = props.partInstancesInPlaylistState.find((pi) => !pi.reset && pi.segmentId === segment._id)
	if (!partInstance) throw new Error('Fixture has no PartInstance in the chosen segment')

	it('segmentsFindOne', () => {
		const reference = (selector: any) => mongoWhereFilter(props.segmentsState, selector)[0]
		const selectors: any[] = [
			{ _id: segment._id },
			{ _id: { $eq: segment._id } },
			{ _id: segment._id, rundownId: protectString('rundown_other') },
			{ _id: protectString('missing') },
			{ _rank: 2 },
		]
		for (const selector of selectors) {
			expect(ctx.accessors.segmentsFindOne(selector, {})?._id).toEqual(reference(selector)?._id)
		}
		expect(ctx.accessors.segmentsFindOne(segment._id, {})?._id).toEqual(segment._id)
		expect(ctx.accessors.segmentsFindOne(protectString('missing'), {})).toBeUndefined()
	})

	it('getSegmentsAndPartsSync', () => {
		const reference = (rundownIds: unknown[], segmentsQuery?: any, partsQuery?: any) => {
			const segments = props.segmentsState.filter((s) => rundownIds.includes(s.rundownId))
			const parts = props.partsState.filter((p) => rundownIds.includes(p.rundownId))
			return {
				segments: segmentsQuery ? mongoWhereFilter(segments, segmentsQuery) : segments,
				parts: partsQuery ? mongoWhereFilter(parts, partsQuery) : parts,
			}
		}
		const cases: Array<[unknown[], any, any]> = [
			[playlist.rundownIdsInOrder, undefined, undefined],
			[playlist.rundownIdsInOrder, { _id: segment._id }, { segmentId: segment._id }],
			// A segment outside of the rundowns asked for must not be returned, even when selected by id
			[[playlist.rundownIdsInOrder[0]], { _id: segment._id }, { segmentId: segment._id }],
			[playlist.rundownIdsInOrder, { _rank: { $gte: 2 } }, { segmentId: { $in: [segment._id, part.segmentId] } }],
		]
		for (const [rundownIds, segmentsQuery, partsQuery] of cases) {
			const result = ctx.accessors.getSegmentsAndPartsSync(
				{ ...playlist, rundownIdsInOrder: rundownIds },
				segmentsQuery,
				partsQuery
			)
			const expected = reference(rundownIds, segmentsQuery, partsQuery)
			expect(ids(result.segments)).toEqual(ids(expected.segments))
			expect(ids(result.parts)).toEqual(ids(expected.parts))
		}
	})

	it('getActivePartInstances', () => {
		const reference = (selector?: any) =>
			mongoWhereFilter(props.partInstancesInPlaylistState, { ...selector, reset: { $ne: true } })
		const selectors: any[] = [
			undefined,
			{ segmentId: segment._id },
			{ segmentId: { $eq: segment._id } },
			// The reset check wins over the selector
			{ segmentId: segment._id, reset: true },
			{ rundownId: segment.rundownId },
		]
		for (const selector of selectors) {
			expect(ids(ctx.accessors.getActivePartInstances(playlist, selector))).toEqual(ids(reference(selector)))
		}
		expect(ids(ctx.accessors.getActivePartInstances(playlist, undefined))).not.toHaveLength(0)
	})

	it('piecesFind', () => {
		const reference = (selector?: any) =>
			selector ? mongoWhereFilter(props.piecesInPlaylistState, selector) : props.piecesInPlaylistState
		const laterPart = props.partsState[11]
		const previousPartIdsInSegment = props.partsState
			.filter((p) => p.segmentId === laterPart.segmentId && p._rank < laterPart._rank)
			.map((p) => p._id)
		if (previousPartIdsInSegment.length === 0) throw new Error('Fixture part is first in its segment')
		const segmentIdsInRundown = props.segmentsState
			.filter((s) => s.rundownId === laterPart.rundownId)
			.map((s) => s._id)
		const otherLifespans = [PieceLifespan.OutOnSegmentEnd, PieceLifespan.OutOnRundownEnd]
		const selectors: any[] = [
			undefined,
			{ startPartId: part._id },
			{ startPartId: { $eq: part._id } },
			// Selectors the index can't be used for
			{ startPartId: { $in: [part._id, laterPart._id] } },
			{ sourceLayerId: 'sl1' },
			// The query for the infinites that may continue into a part, with a single fragment it is flattened
			buildPastInfinitePiecesForThisPartQuery(laterPart, previousPartIdsInSegment, [], []),
			// ... and with several they are under an `$or`
			buildPastInfinitePiecesForThisPartQuery(laterPart, previousPartIdsInSegment, segmentIdsInRundown, [
				playlist.rundownIdsInOrder[0],
			]),
			// Shaped like the infinites query, but may match WithinPart pieces too
			{ lifespan: { $in: [PieceLifespan.WithinPart, ...otherLifespans] } },
			{
				$or: [
					{ lifespan: { $in: otherLifespans } },
					{ lifespan: { $in: [PieceLifespan.WithinPart] }, startPartId: part._id },
				],
			},
		]
		// Make sure both shapes of the infinites query are covered
		expect(selectors[5]).not.toHaveProperty('$or')
		expect(selectors[6]).toHaveProperty('$or')
		expect(reference(selectors[6])).not.toHaveLength(0)

		for (const selector of selectors) {
			expect(ids(ctx.accessors.piecesFind(selector))).toEqual(ids(reference(selector)))
		}
		const pieceId = props.piecesInPlaylistState[3]._id
		expect(ids(ctx.accessors.piecesFind(pieceId))).toEqual([String(pieceId)])
	})

	it('pieceInstancesFind', () => {
		const reference = (selector?: any) =>
			selector
				? mongoWhereFilter(props.pieceInstancesInPlaylistState, selector)
				: props.pieceInstancesInPlaylistState
		const selectors: any[] = [
			undefined,
			{ partInstanceId: partInstance._id },
			{ partInstanceId: { $eq: partInstance._id } },
			{ partInstanceId: partInstance._id, reset: { $ne: true } },
			{ partInstanceId: { $in: [partInstance._id] } },
			{ rundownId: partInstance.rundownId },
		]
		for (const selector of selectors) {
			expect(ids(ctx.accessors.pieceInstancesFind(selector))).toEqual(ids(reference(selector)))
		}
		const pieceInstanceId = props.pieceInstancesInPlaylistState[2]._id
		expect(ids(ctx.accessors.pieceInstancesFind(pieceInstanceId))).toEqual([String(pieceInstanceId)])
	})

	it('results can be modified without affecting later lookups', () => {
		const first = ctx.accessors.pieceInstancesFind(props.pieceInstancesInPlaylistState[2]._id)
		first.length = 0
		expect(ctx.accessors.pieceInstancesFind(props.pieceInstancesInPlaylistState[2]._id)).toHaveLength(1)

		const all = ctx.accessors.getActivePartInstances(playlist, undefined)
		const count = all.length
		all.pop()
		expect(ctx.accessors.getActivePartInstances(playlist, undefined)).toHaveLength(count)
	})
})
