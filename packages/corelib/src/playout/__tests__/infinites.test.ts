import { IBlueprintPieceType } from '@sofie-automation/blueprints-integration'
import { DBPartInstance } from '../../dataModel/PartInstance.js'
import { PartId, RundownId, SegmentId, ShowStyleBaseId } from '../../dataModel/Ids.js'
import { DBPart } from '../../dataModel/Part.js'
import { EmptyPieceTimelineObjectsBlob, Piece } from '../../dataModel/Piece.js'
import { PieceInstance } from '../../dataModel/PieceInstance.js'
import { literal } from '../../lib.js'
import { protectString } from '../../protectedString.js'
import {
	buildPastInfinitePiecesForThisPartQuery,
	buildPastPiecesOnLayersForThisPartQuery,
	getContinuedInfinitesForPart,
	getPieceInstancesForPart,
	getSourceLayersWithStoppableInfinites,
	mergePiecesBeforePart,
	PieceInstancesForPartParams,
	PlayingPartInstance,
} from '../infinites.js'
import { mongoWhere } from '../../mongo.js'
import { DBSegment, SegmentOrphanedReason } from '../../dataModel/Segment.js'
import { IPieceLifespan } from '@sofie-automation/shared-lib/dist/core/model/Rundown'

/*
 * The playlist used in these tests:
 *   rundown0 (showstyleA): segment0 [part0, part1, part2], segment1 [part3, part4]
 *   rundown1 (showstyleA): segment2 [part5]
 *   rundown2 (showstyleB): segment3 [part6]
 */
const structure: Array<{ rundownId: string; showStyleBaseId: string; segments: Record<string, string[]> }> = [
	{
		rundownId: 'rundown0',
		showStyleBaseId: 'showstyleA',
		segments: { segment0: ['part0', 'part1', 'part2'], segment1: ['part3', 'part4'] },
	},
	{ rundownId: 'rundown1', showStyleBaseId: 'showstyleA', segments: { segment2: ['part5'] } },
	{ rundownId: 'rundown2', showStyleBaseId: 'showstyleB', segments: { segment3: ['part6'] } },
]

interface PartInfo {
	part: DBPart
	rundownIndex: number
	segmentIndex: number
	partIndex: number
}

const parts = new Map<string, PartInfo>()
structure.forEach(({ rundownId, segments }, rundownIndex) => {
	Object.entries<string[]>(segments).forEach(([segmentId, partIds], segmentIndex) => {
		partIds.forEach((partId, partIndex) => {
			parts.set(partId, {
				part: {
					_id: protectString(partId),
					_rank: partIndex,
					rundownId: protectString(rundownId),
					segmentId: protectString(segmentId),
					externalId: partId,
					title: partId,
					expectedDurationWithTransition: undefined,
				},
				rundownIndex,
				segmentIndex,
				partIndex,
			})
		})
	})
})

function getPart(partId: string): DBPart {
	const info = parts.get(partId)
	if (!info) throw new Error(`Unknown part ${partId}`)
	return info.part
}

function createPiece(
	id: string,
	partId: string,
	start: number,
	sourceLayerId: string,
	lifespan: IPieceLifespan
): Piece {
	const part = getPart(partId)
	return literal<Piece>({
		_id: protectString(id),
		externalId: id,
		startRundownId: part.rundownId,
		startSegmentId: part.segmentId,
		startPartId: part._id,
		enable: { start },
		name: id,
		lifespan,
		sourceLayerId,
		outputLayerId: '',
		invalid: false,
		content: {},
		timelineObjectsString: EmptyPieceTimelineObjectsBlob,
		pieceType: IBlueprintPieceType.Normal,
	})
}

function createPieceInstance(
	piece: Piece,
	props?: Omit<Partial<PieceInstance>, 'piece'> & { piece?: Partial<PieceInstance['piece']> }
): PieceInstance {
	return {
		_id: protectString(`instance_${piece._id}`),
		rundownId: piece.startRundownId,
		partInstanceId: protectString(`instance_${piece.startPartId}`),
		playlistActivationId: protectString('active'),
		...props,
		piece: { ...piece, ...props?.piece },
	}
}

function createPlaying(
	partId: string,
	pieceInstances: PieceInstance[],
	segment?: Pick<DBSegment, '_id' | 'orphaned'>,
	isBeforeTarget = true
): PlayingPartInstance {
	const part = getPart(partId)
	return {
		partInstance: literal<Partial<DBPartInstance>>({
			_id: protectString(`instance_${partId}`),
			rundownId: part.rundownId,
			segmentId: part.segmentId,
			part,
		}) as DBPartInstance,
		segment: segment ?? { _id: part.segmentId },
		pieceInstances,
		isBeforeTarget,
	}
}

function getParams(
	targetPartId: string,
	pieces: Piece[],
	playing?: PlayingPartInstance,
	segment?: Pick<DBSegment, '_id' | 'orphaned'>,
	isTemporary = false
): PieceInstancesForPartParams {
	const target = parts.get(targetPartId)
	if (!target) throw new Error(`Unknown part ${targetPartId}`)

	const allParts = Array.from(parts.values())
	const sameRundown = allParts.filter((p) => p.rundownIndex === target.rundownIndex)

	return {
		playlistActivationId: protectString('active'),
		rundown: {
			_id: target.part.rundownId,
			showStyleBaseId: protectString(structure[target.rundownIndex].showStyleBaseId),
		},
		segment: segment ?? { _id: target.part.segmentId },
		part: target.part,
		position: {
			partIdsBefore: new Set(
				sameRundown
					.filter((p) => p.segmentIndex === target.segmentIndex && p.partIndex < target.partIndex)
					.map((p) => p.part._id)
			),
			segmentIdsBefore: new Set(
				sameRundown.filter((p) => p.segmentIndex < target.segmentIndex).map((p) => p.part.segmentId)
			),
			rundownIdsBefore: structure.slice(0, target.rundownIndex).map((r) => protectString<RundownId>(r.rundownId)),
			rundownShowStyles: new Map(
				structure.map((r) => [
					protectString<RundownId>(r.rundownId),
					protectString<ShowStyleBaseId>(r.showStyleBaseId),
				])
			),
			orderedPartIds: allParts.map((p) => p.part._id),
		},
		pieces,
		playing,
		newInstanceId: protectString('newInstance'),
		isTemporary,
		allowTestingAdlibsToPersist: false,
	}
}

function getContinuedPieceIds(params: PieceInstancesForPartParams): string[] {
	return getContinuedInfinitesForPart(params).map((p) => String(p.piece._id))
}

const segmentStop: IPieceLifespan = { scope: 'segment', presence: 'forward-scope', whenCovered: 'stop' }
const segmentPersist: IPieceLifespan = { scope: 'segment', presence: 'forward-scope', whenCovered: 'persist' }
const rundownPersist: IPieceLifespan = { scope: 'rundown', presence: 'forward-scope', whenCovered: 'persist' }
const showstylePersist: IPieceLifespan = { scope: 'showstyle', presence: 'forward-scope', whenCovered: 'persist' }
const playlistPersist: IPieceLifespan = { scope: 'playlist', presence: 'forward-scope', whenCovered: 'persist' }
const partOnly: IPieceLifespan = { scope: 'part', presence: 'forward-scope', whenCovered: 'stop' }
const segmentPlayhead: IPieceLifespan = { scope: 'segment', presence: 'follow-playhead', whenCovered: 'stop' }
const rundownPlayhead: IPieceLifespan = { scope: 'rundown', presence: 'follow-playhead', whenCovered: 'stop' }

describe('Infinites', () => {
	describe('planned pieces', () => {
		test('an infinite which stops when covered is stopped by any later piece on its layer', () => {
			const infinite = createPiece('infinite', 'part0', 0, 'layer', segmentStop)
			const finite = createPiece('finite', 'part1', 0, 'layer', partOnly)
			const otherLayer = createPiece('otherLayer', 'part1', 0, 'other', partOnly)

			expect(getContinuedPieceIds(getParams('part2', [infinite, otherLayer]))).toEqual(['infinite'])
			expect(getContinuedPieceIds(getParams('part2', [infinite, finite]))).toEqual([])
		})

		test('an infinite which persists when covered resumes after a later piece', () => {
			const infinite = createPiece('infinite', 'part0', 0, 'layer', segmentPersist)
			const finite = createPiece('finite', 'part1', 0, 'layer', partOnly)

			expect(getContinuedPieceIds(getParams('part2', [infinite, finite]))).toEqual(['infinite'])
		})

		test('an infinite which persists when covered is replaced by a later one of the same scope', () => {
			const first = createPiece('first', 'part0', 0, 'layer', segmentPersist)
			const second = createPiece('second', 'part1', 0, 'layer', segmentPersist)

			expect(getContinuedPieceIds(getParams('part2', [first, second]))).toEqual(['second'])
		})

		test('an infinite which persists when covered is not replaced by a later one of the same scope with an end', () => {
			const first = createPiece('first', 'part0', 0, 'layer', segmentPersist)
			const second = {
				...createPiece('second', 'part1', 0, 'layer', segmentPersist),
				enable: { start: 0, duration: 1000 },
			}

			// The second one ends with its duration, so only the first one continues
			expect(getContinuedPieceIds(getParams('part2', [first, second]))).toEqual(['first'])
		})

		test('a legacy-persist infinite is replaced by a later one of the same scope, even with an end', () => {
			const legacyPersist: IPieceLifespan = {
				scope: 'segment',
				presence: 'forward-scope',
				whenCovered: 'legacy-persist',
			}
			const first = createPiece('first', 'part0', 0, 'layer', legacyPersist)
			const second = {
				...createPiece('second', 'part1', 0, 'layer', legacyPersist),
				enable: { start: 0, duration: 1000 },
			}

			expect(getContinuedPieceIds(getParams('part2', [first, second]))).toEqual(['second'])
		})

		test('a planned infinite with a duration does not continue, except a legacy preset', () => {
			const timed = (id: string, lifespan: IPieceLifespan) => ({
				...createPiece(id, 'part0', 0, id, lifespan),
				enable: { start: 0, duration: 1000 },
			})
			const legacyPersist: IPieceLifespan = { ...segmentPersist, whenCovered: 'legacy-persist' }

			expect(
				getContinuedPieceIds(
					getParams('part1', [timed('persist', segmentPersist), timed('legacy', legacyPersist)])
				)
			).toEqual(['legacy'])
		})

		test('a cover ends no infinite, they all continue under it', () => {
			const stop = createPiece('stop', 'part0', 0, 'layerA', segmentStop)
			const persist = createPiece('persist', 'part0', 0, 'layerB', rundownPersist)
			const cover = (layer: string) => ({
				...createPiece(`cover_${layer}`, 'part1', 0, layer, segmentPersist),
				virtual: true,
				persistCoveredPieces: true,
			})
			const pieces = [stop, persist, cover('layerA'), cover('layerB')]

			// The covers continue for their own scope, the infinites are still there under them
			expect(getContinuedPieceIds(getParams('part2', pieces)).sort()).toEqual([
				'cover_layerA',
				'cover_layerB',
				'persist',
				'stop',
			])
			expect(getContinuedPieceIds(getParams('part3', pieces))).toEqual(['persist'])
		})

		test('infinites which persist when covered with different scopes are stacked, broadest first', () => {
			const segment = createPiece('segment', 'part0', 0, 'layer', segmentPersist)
			const rundown = createPiece('rundown', 'part1', 0, 'layer', rundownPersist)

			expect(getContinuedPieceIds(getParams('part2', [segment, rundown]))).toEqual(['rundown', 'segment'])
			expect(getContinuedPieceIds(getParams('part3', [segment, rundown]))).toEqual(['rundown'])
		})

		test('later pieces in the same part are applied in order of their start', () => {
			const finite = createPiece('finite', 'part0', 0, 'layer', partOnly)
			const infinite = createPiece('infinite', 'part0', 1000, 'layer', segmentStop)

			expect(getContinuedPieceIds(getParams('part1', [infinite, finite]))).toEqual(['infinite'])
		})

		test('a part scoped piece is never continued, even when it persists when covered', () => {
			const piece = createPiece('piece', 'part0', 0, 'layer', {
				scope: 'part',
				presence: 'forward-scope',
				whenCovered: 'persist',
			})

			expect(getContinuedPieceIds(getParams('part1', [piece]))).toEqual([])
		})

		test('an infinite ends at the boundary of its scope', () => {
			const segment = createPiece('segment', 'part0', 0, 'segmentLayer', segmentPersist)
			const rundown = createPiece('rundown', 'part0', 0, 'rundownLayer', rundownPersist)

			expect(getContinuedPieceIds(getParams('part1', [segment, rundown]))).toEqual(['rundown', 'segment'])
			expect(getContinuedPieceIds(getParams('part3', [segment, rundown]))).toEqual(['rundown'])
			expect(getContinuedPieceIds(getParams('part5', [segment, rundown]))).toEqual([])
		})

		test('a showstyle scoped infinite ends when the showstyle changes, a playlist scoped one does not', () => {
			const showstyle = createPiece('showstyle', 'part0', 0, 'showstyleLayer', showstylePersist)
			const playlist = createPiece('playlist', 'part0', 0, 'playlistLayer', playlistPersist)

			expect(getContinuedPieceIds(getParams('part5', [showstyle, playlist]))).toEqual(['playlist', 'showstyle'])
			expect(getContinuedPieceIds(getParams('part6', [showstyle, playlist]))).toEqual(['playlist'])
		})

		test('an infinite following the playhead is not continued from the plan, only forward scoped ones are', () => {
			const infinite = createPiece('infinite', 'part0', 0, 'layer', segmentPlayhead)
			const forward = createPiece('forward', 'part0', 0, 'other', segmentPersist)

			expect(getContinuedPieceIds(getParams('part1', [infinite, forward]))).toEqual(['forward'])
			expect(getContinuedPieceIds(getParams('part1', [infinite, forward], undefined, undefined, true))).toEqual([
				'forward',
			])
		})

		test('pieces after the part are ignored', () => {
			const infinite = createPiece('infinite', 'part0', 0, 'layer', segmentStop)
			const later = createPiece('later', 'part2', 0, 'layer', partOnly)

			expect(getContinuedPieceIds(getParams('part1', [infinite, later]))).toEqual(['infinite'])
		})
	})

	describe('the playing PartInstance', () => {
		test('multiple continued pieces starting at 0 keep the newest of each kind', () => {
			const planned = createPiece('planned', 'part0', 0, 'layer', rundownPersist)
			const virtual = createPiece('virtual', 'part0', 0, 'layer', rundownPersist)
			const playhead = createPiece('playhead', 'part0', 0, 'layer', rundownPlayhead)

			const playing = createPlaying('part0', [
				createPieceInstance(planned),
				createPieceInstance(virtual, { dynamicallyInserted: 1000, piece: { virtual: true } }),
				createPieceInstance(playhead, { dynamicallyInserted: 5000 }),
			])

			// The planned piece is continued from the plan, the others from what is playing
			expect(getContinuedPieceIds(getParams('part1', [], playing))).toEqual(['virtual', 'playhead'])
		})

		test('a piece dynamically converted to an infinite is continued', () => {
			const piece = createPiece('piece', 'part0', 0, 'layer', rundownPersist)
			const playing = createPlaying('part0', [createPieceInstance(piece, { dynamicallyConvertedToInfinite: 1 })])

			expect(getContinuedPieceIds(getParams('part1', [], playing))).toEqual(['piece'])
		})

		test('pieces which have been stopped are not continued', () => {
			const one = createPiece('one', 'part0', 1000, 'one', rundownPlayhead)
			const two = createPiece('two', 'part0', 2000, 'two', rundownPlayhead)
			const three = createPiece('three', 'part0', 3000, 'three', rundownPlayhead)

			const playing = createPlaying('part0', [
				createPieceInstance(one),
				createPieceInstance(two, { userDuration: { endRelativeToPart: 5000 } }),
				createPieceInstance(three, { plannedStoppedPlayback: 5000 }),
			])

			expect(getContinuedPieceIds(getParams('part1', [], playing))).toEqual(['one'])
		})

		test('an infinite following the playhead is stopped by a later piece in the playing part', () => {
			const infinite = createPiece('infinite', 'part0', 0, 'layer', segmentPlayhead)
			const finite = createPiece('finite', 'part0', 1000, 'layer', partOnly)

			const playing = createPlaying('part0', [createPieceInstance(infinite), createPieceInstance(finite)])

			expect(getContinuedPieceIds(getParams('part1', [], playing))).toEqual([])
		})

		test('an adlib in the playing part stops a planned infinite which stops when covered', () => {
			const infinite = createPiece('infinite', 'part0', 0, 'layer', segmentStop)
			const adlib = createPiece('adlib', 'part1', 0, 'layer', partOnly)

			const continuation = createPieceInstance(infinite, {
				infinite: {
					infiniteInstanceId: protectString('chain'),
					infiniteInstanceIndex: 1,
					infinitePieceId: infinite._id,
					fromPreviousPart: true,
				},
			})

			const withoutAdlib = createPlaying('part1', [continuation])
			expect(getContinuedPieceIds(getParams('part2', [infinite], withoutAdlib))).toEqual(['infinite'])

			const withAdlib = createPlaying('part1', [
				continuation,
				createPieceInstance(adlib, { dynamicallyInserted: 1000, piece: { enable: { start: 'now' } } }),
			])
			expect(getContinuedPieceIds(getParams('part2', [infinite], withAdlib))).toEqual([])
		})

		test('an infinite which stopped playing while hidden by a cover is still continued', () => {
			const playhead = createPiece('playhead', 'part0', 0, 'layer', segmentPlayhead)
			const cover = {
				...createPiece('cover', 'part0', 2000, 'layer', partOnly),
				enable: { start: 2000, duration: 3000 },
				virtual: true,
				persistCoveredPieces: true,
			}
			// Playout reports the piece as stopped when the cover cuts it, and the slice resuming after it is not it
			const stoppedPlayhead = createPieceInstance(playhead, { plannedStoppedPlayback: 2000 })

			const withCover = createPlaying('part0', [stoppedPlayhead, createPieceInstance(cover)])
			expect(getContinuedPieceIds(getParams('part1', [], withCover))).toEqual(['playhead'])

			const withoutCover = createPlaying('part0', [stoppedPlayhead])
			expect(getContinuedPieceIds(getParams('part1', [], withoutCover))).toEqual([])
		})

		test('a planned infinite which was stopped in the playing part is not continued', () => {
			const infinite = createPiece('infinite', 'part0', 0, 'layer', segmentPersist)

			const playing = createPlaying('part1', [
				createPieceInstance(infinite, {
					userDuration: { endRelativeToPart: 1000 },
					infinite: {
						infiniteInstanceId: protectString('chain'),
						infiniteInstanceIndex: 1,
						infinitePieceId: infinite._id,
						fromPreviousPart: true,
					},
				}),
			])

			expect(getContinuedPieceIds(getParams('part2', [infinite], playing))).toEqual([])
		})

		test('adlibbed infinites are only continued when moving forwards', () => {
			const adlib = createPiece('adlib', 'part1', 0, 'layer', segmentPersist)
			const playing = (isBeforeTarget: boolean) =>
				createPlaying(
					'part1',
					[createPieceInstance(adlib, { dynamicallyInserted: 1 })],
					undefined,
					isBeforeTarget
				)

			expect(getContinuedPieceIds(getParams('part2', [], playing(true)))).toEqual(['adlib'])
			expect(getContinuedPieceIds(getParams('part0', [], playing(false)))).toEqual([])
		})

		test('pieces planned between the playing part and the part are replayed after the playing part', () => {
			const playhead = createPiece('playhead', 'part0', 0, 'layer', rundownPlayhead)
			const later = createPiece('later', 'part1', 0, 'layer', partOnly)
			const playing = createPlaying('part0', [createPieceInstance(playhead)])

			expect(getContinuedPieceIds(getParams('part2', [later], playing, undefined, true))).toEqual([])
		})

		test('an adlib in the playing part does not stop an infinite planned after it', () => {
			const adlib = createPiece('adlib', 'part0', 0, 'layer', partOnly)
			const infinite = createPiece('infinite', 'part1', 0, 'layer', segmentStop)
			const playing = createPlaying('part0', [createPieceInstance(adlib, { dynamicallyInserted: 1 })])

			expect(getContinuedPieceIds(getParams('part2', [infinite], playing, undefined, true))).toEqual(['infinite'])
		})

		test('an infinite following the playhead planned after the playing part is not predicted further ahead', () => {
			const playhead = createPiece('playhead', 'part1', 0, 'layer', rundownPlayhead)
			const playing = createPlaying('part0', [])

			expect(getContinuedPieceIds(getParams('part3', [playhead], playing, undefined, true))).toEqual([])
			expect(getContinuedPieceIds(getParams('part3', [playhead], playing))).toEqual([])
		})

		test('a skipped part does not affect an infinite following the playhead', () => {
			const playheadLifespan: IPieceLifespan = {
				scope: 'segment',
				presence: 'follow-playhead',
				whenCovered: 'persist',
			}
			const playhead = createPiece('playhead', 'part0', 0, 'layer', playheadLifespan)
			const playing = createPlaying('part0', [createPieceInstance(playhead)])

			const occludingPart = createPiece('occludingPart', 'part1', 0, 'layer', partOnly)
			expect(getContinuedPieceIds(getParams('part2', [occludingPart], playing))).toEqual(['playhead'])

			const occludingScope = createPiece('occludingScope', 'part1', 0, 'layer', playheadLifespan)
			expect(getContinuedPieceIds(getParams('part2', [occludingScope], playing))).toEqual(['playhead'])

			const occludingStop = createPiece('occludingStop', 'part1', 0, 'layer', segmentStop)
			const playingStop = createPlaying('part0', [
				createPieceInstance(createPiece('playheadStop', 'part0', 0, 'layer', segmentPlayhead)),
			])
			// A forward scoped infinite is part of the plan, so it continues even though its part was skipped
			expect(getContinuedPieceIds(getParams('part2', [occludingStop], playingStop))).toEqual([
				'playheadStop',
				'occludingStop',
			])
		})

		test('a planned piece does not end an adlibbed legacy-persist infinite, as it did not before', () => {
			const continuedAdlib = (id: string, lifespan: IPieceLifespan) =>
				createPieceInstance(createPiece(id, 'part0', 0, id, lifespan), {
					dynamicallyInserted: 1,
					infinite: {
						infiniteInstanceId: protectString(`${id}_chain`),
						infiniteInstanceIndex: 1,
						infinitePieceId: protectString(id),
						fromPreviousPart: true,
						fromPreviousPlayhead: true,
					},
				})
			const virtualEnder = (id: string, lifespan: IPieceLifespan) =>
				createPieceInstance({ ...createPiece(`${id}_end`, 'part1', 0, id, lifespan), virtual: true })

			const legacyPersist: IPieceLifespan = { ...rundownPersist, whenCovered: 'legacy-persist' }
			const playing = createPlaying('part1', [
				continuedAdlib('legacy', legacyPersist),
				virtualEnder('legacy', legacyPersist),
				continuedAdlib('persist', rundownPersist),
				virtualEnder('persist', rundownPersist),
			])

			expect(getContinuedPieceIds(getParams('part2', [], playing))).toEqual(['legacy'])
		})

		test('an adlib is ordered by when it was taken against the planned pieces of its part', () => {
			const planned = createPiece('planned', 'part1', 5000, 'layer', segmentPersist)
			const adlib = createPiece('adlib', 'part1', 0, 'layer', segmentPersist)
			const playing = (takenAt: number) => {
				const instance = createPlaying('part1', [
					createPieceInstance(planned),
					createPieceInstance(adlib, {
						dynamicallyInserted: 100000 + takenAt,
						piece: { enable: { start: 'now' } },
					}),
				])
				return {
					...instance,
					partInstance: { ...instance.partInstance, timings: { plannedStartedPlayback: 100000 } },
				}
			}

			// Taken at 3s: the planned piece at 5s is newer, of the same scope and has no end, so it ends the adlib
			expect(getContinuedPieceIds(getParams('part2', [planned], playing(3000)))).toEqual(['planned'])
			// Taken at 7s: the adlib is newer, and replaces the planned piece
			expect(getContinuedPieceIds(getParams('part2', [planned], playing(7000)))).toEqual(['adlib'])
		})

		describe('AdlibTesting', () => {
			const adlib = createPiece('adlib', 'part0', 0, 'layer', rundownPersist)
			const pieceInstances = [createPieceInstance(adlib, { dynamicallyInserted: 1 })]
			const adlibTestingSegment = (id: string): Pick<DBSegment, '_id' | 'orphaned'> => ({
				_id: protectString<SegmentId>(id),
				orphaned: SegmentOrphanedReason.ADLIB_TESTING,
			})

			test('normal rundown', () => {
				expect(
					getContinuedPieceIds(getParams('part1', [], createPlaying('part0', pieceInstances)))
				).toHaveLength(1)
			})

			test('into AdlibTesting segment', () => {
				const params = getParams(
					'part1',
					[],
					createPlaying('part0', pieceInstances),
					adlibTestingSegment('adlibTesting')
				)
				expect(getContinuedPieceIds(params)).toHaveLength(0)
			})

			test('out of AdlibTesting', () => {
				const playing = createPlaying('part0', pieceInstances, adlibTestingSegment('adlibTesting'))
				expect(getContinuedPieceIds(getParams('part1', [], playing))).toHaveLength(0)
			})

			test('within AdlibTesting', () => {
				const playing = createPlaying('part0', pieceInstances, adlibTestingSegment('segment0'))
				const params = getParams('part1', [], playing, adlibTestingSegment('segment0'))
				expect(getContinuedPieceIds(params)).toHaveLength(1)
			})
		})
	})

	describe('queries', () => {
		const part = getPart('part1')

		test('past infinites match on scope', () => {
			const query = buildPastInfinitePiecesForThisPartQuery(part, [protectString<PartId>('part0')], [], [])
			if (!query) throw new Error('Expected a query')

			expect(mongoWhere(createPiece('stop', 'part0', 0, 'layer', segmentStop), query)).toBe(true)
			expect(
				mongoWhere(
					createPiece('partPersist', 'part0', 0, 'layer', { ...partOnly, whenCovered: 'persist' }),
					query
				)
			).toBe(false)
		})

		test('past pieces on layers match any lifespan on those layers', () => {
			const query = buildPastPiecesOnLayersForThisPartQuery(
				part,
				[protectString<PartId>('part0')],
				[],
				[],
				['layer']
			)
			if (!query) throw new Error('Expected a query')

			expect(mongoWhere(createPiece('finite', 'part0', 0, 'layer', partOnly), query)).toBe(true)
			expect(mongoWhere(createPiece('otherLayer', 'part0', 0, 'other', partOnly), query)).toBe(false)
			expect(buildPastPiecesOnLayersForThisPartQuery(part, [protectString('part0')], [], [], [])).toBeNull()
		})
	})
})

describe('Fetching the Pieces before a Part', () => {
	/** What the Pieces collection would return for a query */
	const find = (allPieces: Piece[], query: ReturnType<typeof buildPastInfinitePiecesForThisPartQuery>) =>
		query ? allPieces.filter((p) => mongoWhere(p, query)) : []

	/** Fetch as `fetchPiecesThatMayBeActiveForPart` does, querying the layers given for the pieces before the Part */
	function fetchPieces(
		allPieces: Piece[],
		params: PieceInstancesForPartParams,
		getLayers: (infinites: Piece[]) => string[]
	): Piece[] {
		const { part, position } = params
		const partIds = Array.from(position.partIdsBefore)
		const segmentIds = Array.from(position.segmentIdsBefore)
		const rundownIds = [...position.rundownIdsBefore]

		const starting = allPieces.filter((p) => p.startPartId === part._id)
		const infinites = find(
			allPieces,
			buildPastInfinitePiecesForThisPartQuery(part, partIds, segmentIds, rundownIds)
		)
		const layers = getLayers(infinites)
		const layerPieces = find(
			allPieces,
			buildPastPiecesOnLayersForThisPartQuery(part, partIds, segmentIds, rundownIds, layers)
		)
		return [...starting, ...mergePiecesBeforePart(layerPieces, infinites, layers)]
	}

	test('the layer of a playing infinite which stops when covered is queried when predicting', () => {
		// A planned infinite persisting when covered, on the layer of an adlibbed one which stops when covered
		const persisting = createPiece('persisting', 'part0', 0, 'layer', rundownPersist)
		const adlib = createPiece('adlib', 'part1', 0, 'layer', { ...rundownPersist, whenCovered: 'stop' })
		adlib.enable = { start: 'now' }
		// The playhead travels through part2 when predicting part3, where this covers the adlib
		const covering = createPiece('covering', 'part2', 0, 'layer', partOnly)
		const pieces = [persisting, covering]
		const playing = createPlaying('part1', [createPieceInstance(adlib, { dynamicallyInserted: 1000 })])

		const params = getParams('part3', [], playing, undefined, true)
		const fetched = fetchPieces(pieces, params, (infinites) =>
			getSourceLayersWithStoppableInfinites(infinites, playing.pieceInstances as PieceInstance[])
		)
		expect(fetched.map((p) => String(p._id)).sort()).toEqual(['covering', 'persisting'])
		expect(getContinuedPieceIds({ ...params, pieces: fetched })).toEqual(['persisting'])
	})

	test('only querying the layers with infinites which stop when covered gives the same PieceInstances', () => {
		// Seeded, so that a failure can be reproduced
		let seed = 42
		const random = () => {
			seed = (seed * 1103515245 + 12345) % 2147483648
			return seed / 2147483648
		}
		const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)]

		const lifespans: IPieceLifespan[] = []
		for (const scope of ['part', 'segment', 'rundown', 'showstyle', 'playlist'] as const) {
			for (const presence of ['forward-scope', 'follow-playhead'] as const) {
				for (const whenCovered of ['stop', 'persist', 'legacy-persist'] as const) {
					lifespans.push({ scope, presence, whenCovered })
				}
			}
		}
		const partIds = Array.from(parts.keys())
		const layers = ['layer0', 'layer1', 'layer2']

		let comparisons = 0
		let narrowedQueries = 0
		for (let scenario = 0; scenario < 1500; scenario++) {
			const pieces: Piece[] = []
			const pieceCount = 2 + Math.floor(random() * 10)
			for (let i = 0; i < pieceCount; i++) {
				const piece = createPiece(
					`piece${i}`,
					pick(partIds),
					pick([0, 0, 1000, 2000]),
					pick(layers),
					pick(lifespans)
				)
				if (random() < 0.25) piece.enable = { ...piece.enable, duration: pick([500, 1500, 5000]) }
				if (random() < 0.15) piece.virtual = true
				if (piece.virtual && random() < 0.5) piece.persistCoveredPieces = true
				pieces.push(piece)
			}

			const targetIndex = 1 + Math.floor(random() * (partIds.length - 1))
			const targetPartId = partIds[targetIndex]

			// Sometimes a PartInstance is playing before the target, with an adlib or two of its own
			let playing: PlayingPartInstance | undefined
			if (random() < 0.6) {
				const playingPartId = partIds[Math.floor(random() * targetIndex)]
				const instances = pieces
					.filter((p) => String(p.startPartId) === playingPartId)
					.map((p) => createPieceInstance(p))
				const adlibs = Math.floor(random() * 3)
				for (let i = 0; i < adlibs; i++) {
					const adlib = createPiece(`adlib${i}`, playingPartId, 0, pick(layers), pick(lifespans))
					adlib.enable = { start: 'now' }
					instances.push(createPieceInstance(adlib, { dynamicallyInserted: 1000 + i }))
				}
				playing = createPlaying(playingPartId, instances)
			}

			for (const isTemporary of [false, true]) {
				const params = getParams(targetPartId, [], playing, undefined, isTemporary)
				const playingInstances = playing?.pieceInstances as PieceInstance[] | undefined

				// Before: every layer with an infinite
				const everyLayer = fetchPieces(pieces, params, (infinites) =>
					Array.from(new Set(infinites.map((p) => p.sourceLayerId)))
				)
				const narrowed = fetchPieces(pieces, params, (infinites) =>
					getSourceLayersWithStoppableInfinites(infinites, playingInstances)
				)
				if (narrowed.length < everyLayer.length) narrowedQueries++

				const describe = (fetched: Piece[]) =>
					getPieceInstancesForPart({ ...params, pieces: fetched })
						.map((p) => `${p.piece._id}:${p.piece.enable.start}:${p.infinite?.fromPreviousPart ?? false}`)
						.sort()
				expect({ scenario, isTemporary, result: describe(narrowed) }).toEqual({
					scenario,
					isTemporary,
					result: describe(everyLayer),
				})
				comparisons++
			}
		}
		expect(comparisons).toBe(3000)
		// Make sure the narrowing was exercised
		expect(narrowedQueries).toBeGreaterThan(300)
	})
})
