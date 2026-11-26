import { IBlueprintPieceType, SourceLayerType } from '@sofie-automation/blueprints-integration'
import clone from 'fast-clone'
import { EmptyPieceTimelineObjectsBlob, Piece } from '../../dataModel/Piece.js'
import { PieceInstance, PieceInstancePiece, ResolvedPieceInstance } from '../../dataModel/PieceInstance.js'
import { literal } from '../../lib.js'
import { protectString } from '../../protectedString.js'
import {
	createPartCurrentTimes,
	PartCurrentTimes,
	PieceInstanceWithTimings,
	processAndPrunePieceInstanceTimings,
	resolvePrunedPieceInstance,
} from '../processAndPrune.js'
import { IPieceLifespan } from '@sofie-automation/shared-lib/dist/core/model/Rundown'

describe('processAndPrunePieceInstanceTimings', () => {
	const partOnlyLifespan = { scope: 'part', presence: 'forward-scope', whenCovered: 'stop' } as const

	function createPieceInstance(
		id: string,
		enable: Piece['enable'],
		sourceLayerId: string,
		lifespan: IPieceLifespan,
		clearOrAdlib?: boolean | number,
		infinite?: PieceInstance['infinite']
	): PieceInstance {
		return literal<PieceInstance>({
			_id: protectString(id),
			rundownId: protectString(''),
			partInstanceId: protectString(''),
			playlistActivationId: protectString('active'),
			piece: literal<PieceInstancePiece>({
				_id: protectString(`${id}_p`),
				externalId: '',
				startPartId: protectString(''),
				enable: enable,
				name: '',
				lifespan: lifespan,
				sourceLayerId: sourceLayerId,
				outputLayerId: '',
				invalid: false,
				virtual: clearOrAdlib === true,
				content: {},
				timelineObjectsString: EmptyPieceTimelineObjectsBlob,
				pieceType: IBlueprintPieceType.Normal,
			}),
			dynamicallyInserted: clearOrAdlib === true ? Date.now() : clearOrAdlib || undefined,
			infinite,
		})
	}

	function runAndTidyResult(pieceInstances: PieceInstance[], partTimes: PartCurrentTimes, includeVirtual?: boolean) {
		const resolvedInstances = processAndPrunePieceInstanceTimings(
			{
				one: {
					_id: 'one',
					_rank: 0,
					type: SourceLayerType.UNKNOWN,
					name: 'One',
				},
				two: {
					_id: 'two',
					_rank: 0,
					type: SourceLayerType.UNKNOWN,
					name: 'Two',
				},
			},
			pieceInstances,
			partTimes,
			undefined,
			includeVirtual
		)
		return resolvedInstances.map((p) => ({
			_id: p._id,
			start: p.piece.enable.start,
			end: p.resolvedEndCap,
			priority: p.priority,
		}))
	}

	test('simple seperate layers', () => {
		const pieceInstances = [
			createPieceInstance('one', { start: 0 }, 'one', {
				scope: 'rundown',
				presence: 'forward-scope',
				whenCovered: 'persist',
			}),
			createPieceInstance('two', { start: 1000 }, 'two', {
				scope: 'rundown',
				presence: 'forward-scope',
				whenCovered: 'persist',
			}),
		]

		const resolvedInstances = runAndTidyResult(pieceInstances, createPartCurrentTimes(500, 0))
		expect(resolvedInstances).toEqual([
			{
				_id: 'one',
				priority: 1,
				start: 0,
				end: undefined,
			},
			{
				_id: 'two',
				priority: 1,
				start: 1000,
				end: undefined,
			},
		])
	})
	test('basic collision', () => {
		const pieceInstances = [
			createPieceInstance('one', { start: 0 }, 'one', {
				scope: 'rundown',
				presence: 'forward-scope',
				whenCovered: 'persist',
			}),
			createPieceInstance('two', { start: 1000, duration: 5000 }, 'one', {
				scope: 'rundown',
				presence: 'forward-scope',
				whenCovered: 'persist',
			}),
		]

		// 'one' is hidden by 'two', and resumes when it ends
		const resolvedInstances = runAndTidyResult(pieceInstances, createPartCurrentTimes(500, 0))
		expect(resolvedInstances).toEqual([
			{
				_id: 'one',
				priority: 1,
				start: 0,
				end: undefined,
			},
			{
				_id: 'two',
				priority: 1,
				start: 1000,
				end: undefined,
			},
		])
	})
	test('a legacy-persist piece covered by another piece comes back once it ends, as on the timeline', () => {
		const pieceInstances = [
			createPieceInstance(
				'incoming',
				{ start: 0 },
				'one',
				{ scope: 'rundown', presence: 'forward-scope', whenCovered: 'legacy-persist' },
				false,
				{
					infiniteInstanceId: protectString('incoming_inf'),
					infiniteInstanceIndex: 1,
					infinitePieceId: protectString('incoming_p'),
					fromPreviousPart: true,
				}
			),
			createPieceInstance('occluder', { start: 2000, duration: 1000 }, 'one', {
				scope: 'part',
				presence: 'forward-scope',
				whenCovered: 'stop',
			}),
		]

		const resolvedInstances = runAndTidyResult(pieceInstances, createPartCurrentTimes(500, 0))
		expect(resolvedInstances).toEqual([
			// Not capped: the occluder covers it by priority on the timeline, and it comes back once that ends
			{ _id: 'incoming', priority: 1, start: 0, end: undefined },
			{ _id: 'occluder', priority: 5, start: 2000, end: undefined },
		])
	})

	test('a legacy-persist piece comes back once the nested pieces covering it end', () => {
		const pieceInstances = [
			createPieceInstance(
				'incoming',
				{ start: 0 },
				'one',
				{ scope: 'rundown', presence: 'forward-scope', whenCovered: 'legacy-persist' },
				false,
				{
					infiniteInstanceId: protectString('incoming_inf'),
					infiniteInstanceIndex: 1,
					infinitePieceId: protectString('incoming_p'),
					fromPreviousPart: true,
				}
			),
			createPieceInstance('A', { start: 1000, duration: 5000 }, 'one', partOnlyLifespan),
			createPieceInstance('B', { start: 2000, duration: 3000 }, 'one', partOnlyLifespan),
			createPieceInstance('C', { start: 3000, duration: 1000 }, 'one', partOnlyLifespan),
		]

		const resolvedInstances = runAndTidyResult(pieceInstances, createPartCurrentTimes(500, 0))
		expect(resolvedInstances).toEqual([
			// Each newer part-only piece ends the previous one, so the incoming piece is back after C, at 4s
			{ _id: 'incoming', priority: 1, start: 0, end: undefined },
			{ _id: 'A', priority: 5, start: 1000, end: 2000 },
			{ _id: 'B', priority: 5, start: 2000, end: 3000 },
			{ _id: 'C', priority: 5, start: 3000, end: undefined },
		])
	})

	test('a continued persist piece resumes after a timed piece of its scope starting with it', () => {
		const segmentPersist = { scope: 'segment', presence: 'forward-scope', whenCovered: 'persist' } as const
		const pieceInstances = [
			createPieceInstance('first', { start: 0 }, 'one', segmentPersist, false, {
				infiniteInstanceId: protectString('first_inf'),
				infiniteInstanceIndex: 1,
				infinitePieceId: protectString('first_p'),
				fromPreviousPart: true,
			}),
			createPieceInstance('second', { start: 0, duration: 3000 }, 'one', segmentPersist),
		]

		// 'first' sits just below 'second', and is visible again once 'second' ends
		const resolvedInstances = runAndTidyResult(pieceInstances, createPartCurrentTimes(500, 0))
		expect(resolvedInstances).toEqual([
			{ _id: 'first', priority: 1.5, start: 0, end: undefined },
			{ _id: 'second', priority: 2, start: 0, end: undefined },
		])
	})

	describe('persistCoveredPieces', () => {
		const continuation = (id: string, lifespan: IPieceLifespan) =>
			createPieceInstance(id, { start: 0 }, 'one', lifespan, false, {
				infiniteInstanceId: protectString(`${id}_inf`),
				infiniteInstanceIndex: 1,
				infinitePieceId: protectString(`${id}_p`),
				fromPreviousPart: true,
			})
		const cover = (enable: Piece['enable']): PieceInstance => {
			const instance = createPieceInstance('cover', enable, 'one', {
				scope: 'part',
				presence: 'forward-scope',
				whenCovered: 'stop',
			})
			return { ...instance, piece: { ...instance.piece, virtual: true, persistCoveredPieces: true } }
		}
		const rundownPersist: IPieceLifespan = { scope: 'rundown', presence: 'forward-scope', whenCovered: 'persist' }

		test('an adlib taken before a cover stays under it, wherever the playhead is', () => {
			const adlib = {
				...createPieceInstance('adlib', { start: 'now' }, 'one', rundownPersist),
				dynamicallyInserted: 3000,
			}
			// The part started at 0, so the adlib was taken 3s in
			for (const playhead of [4000, 6000]) {
				const resolvedInstances = runAndTidyResult(
					[adlib, cover({ start: 5000 })],
					createPartCurrentTimes(playhead, 0)
				)
				expect(resolvedInstances).toEqual([{ _id: 'adlib', priority: 1, start: 'now', end: 5000 }])
			}
		})

		test('a continued cover covers a continued piece only if its chain started later', () => {
			const continuedCover = (startedAt: number): PieceInstance => {
				const instance = cover({ start: 0 })
				return {
					...instance,
					plannedStartedPlayback: startedAt,
					infinite: {
						infiniteInstanceId: protectString('cover_inf'),
						infiniteInstanceIndex: 1,
						infinitePieceId: protectString('cover_p'),
						fromPreviousPart: true,
					},
				}
			}
			const incoming = { ...continuation('incoming', rundownPersist), plannedStartedPlayback: 1000 }

			// The cover started after the incoming piece, so it is on top of it
			expect(runAndTidyResult([incoming, continuedCover(2000)], createPartCurrentTimes(500, 0))).toEqual([])
			// The incoming piece started on top of the cover
			expect(runAndTidyResult([incoming, continuedCover(500)], createPartCurrentTimes(500, 0))).toEqual([
				{ _id: 'incoming', priority: 1, start: 0, end: undefined },
			])
		})

		test('a persisting piece is cut by a cover, and resumes after it', () => {
			const resolvedInstances = runAndTidyResult(
				[continuation('incoming', rundownPersist), cover({ start: 2000, duration: 3000 })],
				createPartCurrentTimes(500, 0)
			)
			expect(resolvedInstances).toEqual([
				{ _id: 'incoming', priority: 1, start: 0, end: 2000 },
				{ _id: 'incoming_after_cover', priority: 1, start: 5000, end: undefined },
			])
		})

		test('a piece which stops when covered is cut by a cover, and resumes after it', () => {
			const resolvedInstances = runAndTidyResult(
				[
					continuation('incoming', { scope: 'segment', presence: 'forward-scope', whenCovered: 'stop' }),
					cover({ start: 2000, duration: 3000 }),
				],
				createPartCurrentTimes(500, 0)
			)
			expect(resolvedInstances).toEqual([
				{ _id: 'incoming', priority: 5, start: 0, end: 2000 },
				{ _id: 'incoming_after_cover', priority: 5, start: 5000, end: undefined },
			])
		})

		test('a legacy-persist piece is cut by a cover, and resumes after it', () => {
			const resolvedInstances = runAndTidyResult(
				[
					continuation('incoming', { ...rundownPersist, whenCovered: 'legacy-persist' }),
					cover({ start: 2000, duration: 3000 }),
				],
				createPartCurrentTimes(500, 0)
			)
			expect(resolvedInstances).toEqual([
				{ _id: 'incoming', priority: 1, start: 0, end: 2000 },
				{ _id: 'incoming_after_cover', priority: 1, start: 5000, end: undefined },
			])
		})

		test('a piece starting during a cover is on top of it', () => {
			const resolvedInstances = runAndTidyResult(
				[
					continuation('incoming', rundownPersist),
					cover({ start: 2000, duration: 3000 }),
					createPieceInstance('later', { start: 3000, duration: 1000 }, 'one', {
						scope: 'part',
						presence: 'forward-scope',
						whenCovered: 'persist',
					}),
				],
				createPartCurrentTimes(500, 0)
			)
			expect(resolvedInstances).toEqual([
				{ _id: 'incoming', priority: 1, start: 0, end: 2000 },
				{ _id: 'incoming_after_cover', priority: 1, start: 5000, end: undefined },
				{ _id: 'later', priority: 3, start: 3000, end: undefined },
			])
		})

		test('an open ended cover hides the layer for the rest of the part', () => {
			const resolvedInstances = runAndTidyResult(
				[continuation('incoming', rundownPersist), cover({ start: 2000 })],
				createPartCurrentTimes(500, 0)
			)
			expect(resolvedInstances).toEqual([{ _id: 'incoming', priority: 1, start: 0, end: 2000 }])
		})

		test('a piece ending the covered one during the cover means it does not resume', () => {
			const resolvedInstances = runAndTidyResult(
				[
					continuation('incoming', rundownPersist),
					cover({ start: 2000, duration: 3000 }),
					createPieceInstance('replacement', { start: 3000 }, 'one', rundownPersist),
				],
				createPartCurrentTimes(500, 0)
			)
			expect(resolvedInstances).toEqual([
				{ _id: 'incoming', priority: 1, start: 0, end: 2000 },
				{ _id: 'replacement', priority: 1, start: 3000, end: undefined },
			])
		})

		test('a virtual which does not end a persisting piece hides it while active, as persistCoveredPieces does', () => {
			const clear = createPieceInstance('clear', { start: 2000, duration: 3000 }, 'one', partOnlyLifespan, true)
			const segmentPersist: IPieceLifespan = {
				scope: 'segment',
				presence: 'forward-scope',
				whenCovered: 'persist',
			}
			const legacyPersist: IPieceLifespan = { ...rundownPersist, whenCovered: 'legacy-persist' }

			expect(
				runAndTidyResult([continuation('incoming', segmentPersist), clear], createPartCurrentTimes(500, 0))
			).toEqual([
				{ _id: 'incoming', priority: 2, start: 0, end: 2000 },
				{ _id: 'clear', priority: 5, start: 2000, end: undefined },
				{ _id: 'incoming_after_clear', priority: 2, start: 5000, end: undefined },
			])

			// A legacy-persist piece is left to the timeline, which covers it by priority as it always did
			expect(
				runAndTidyResult([continuation('incoming', legacyPersist), clear], createPartCurrentTimes(500, 0))
			).toEqual([
				{ _id: 'incoming', priority: 1, start: 0, end: undefined },
				{ _id: 'clear', priority: 5, start: 2000, end: undefined },
			])
		})

		test('a piece starting during the cover ends a piece which stops when covered under it', () => {
			const resolvedInstances = runAndTidyResult(
				[
					continuation('incoming', { scope: 'segment', presence: 'forward-scope', whenCovered: 'stop' }),
					cover({ start: 2000, duration: 3000 }),
					createPieceInstance('normal', { start: 3000, duration: 1000 }, 'one', partOnlyLifespan),
				],
				createPartCurrentTimes(500, 0)
			)
			expect(resolvedInstances).toEqual([
				{ _id: 'incoming', priority: 5, start: 0, end: 2000 },
				{ _id: 'normal', priority: 5, start: 3000, end: undefined },
			])
		})
	})

	test('basic collision with legacy-persist', () => {
		const legacyPersist = { scope: 'rundown', presence: 'forward-scope', whenCovered: 'legacy-persist' } as const
		const pieceInstances = [
			createPieceInstance('one', { start: 0 }, 'one', legacyPersist),
			createPieceInstance('two', { start: 1000, duration: 5000 }, 'one', legacyPersist),
		]

		// A newer piece of the same scope ends a legacy-persist one for good, even when it has an end itself
		const resolvedInstances = runAndTidyResult(pieceInstances, createPartCurrentTimes(500, 0))
		expect(resolvedInstances).toEqual([
			{ _id: 'one', priority: 1, start: 0, end: 1000 },
			{ _id: 'two', priority: 1, start: 1000, end: undefined },
		])
	})
	test('onEnd type override', () => {
		const pieceInstances = [
			createPieceInstance('zero', { start: 0 }, 'one', {
				scope: 'showstyle',
				presence: 'forward-scope',
				whenCovered: 'persist',
			}),
			createPieceInstance('one', { start: 500 }, 'one', {
				scope: 'rundown',
				presence: 'forward-scope',
				whenCovered: 'persist',
			}),
			createPieceInstance('two', { start: 1000, duration: 5000 }, 'one', {
				scope: 'segment',
				presence: 'forward-scope',
				whenCovered: 'persist',
			}),
			createPieceInstance('four', { start: 2000, duration: 2000 }, 'one', {
				scope: 'part',
				presence: 'forward-scope',
				whenCovered: 'stop',
			}),
			createPieceInstance('three', { start: 3000 }, 'one', {
				scope: 'rundown',
				presence: 'forward-scope',
				whenCovered: 'persist',
			}),
			createPieceInstance('five', { start: 4000 }, 'one', {
				scope: 'showstyle',
				presence: 'forward-scope',
				whenCovered: 'persist',
			}),
		]

		const resolvedInstances = runAndTidyResult(pieceInstances, createPartCurrentTimes(500, 0))
		expect(resolvedInstances).toEqual([
			{
				_id: 'zero',
				priority: 0,
				start: 0,
				end: 4000,
			},
			{
				_id: 'one',
				priority: 1,
				start: 500,
				end: 3000,
			},
			{
				_id: 'two',
				priority: 2,
				start: 1000,
				end: undefined,
			},
			{
				_id: 'four',
				priority: 5,
				start: 2000,
				end: undefined,
			},
			{
				_id: 'three',
				priority: 1,
				start: 3000,
				end: undefined,
			},
			{
				_id: 'five',
				priority: 0,
				start: 4000,
				end: undefined,
			},
		])
	})
	test('clear onEnd', () => {
		const pieceInstances = [
			createPieceInstance('zero', { start: 0 }, 'one', {
				scope: 'showstyle',
				presence: 'forward-scope',
				whenCovered: 'persist',
			}),
			createPieceInstance('one', { start: 500 }, 'one', {
				scope: 'rundown',
				presence: 'forward-scope',
				whenCovered: 'persist',
			}),
			createPieceInstance('two', { start: 1000 }, 'one', {
				scope: 'segment',
				presence: 'forward-scope',
				whenCovered: 'persist',
			}),
			createPieceInstance(
				'three',
				{ start: 3000 },
				'one',
				{ scope: 'rundown', presence: 'forward-scope', whenCovered: 'persist' },
				true
			),
			createPieceInstance(
				'two',
				{ start: 5000 },
				'one',
				{ scope: 'segment', presence: 'forward-scope', whenCovered: 'persist' },
				true
			),
			createPieceInstance(
				'zero',
				{ start: 6000 },
				'one',
				{ scope: 'showstyle', presence: 'forward-scope', whenCovered: 'persist' },
				true
			),
		]

		const resolvedInstances = runAndTidyResult(pieceInstances, createPartCurrentTimes(500, 0))
		expect(resolvedInstances).toEqual([
			{
				_id: 'zero',
				priority: 0,
				start: 0,
				end: 3000,
			},
			{
				_id: 'one',
				priority: 1,
				start: 500,
				end: 3000,
			},
			{
				_id: 'two',
				priority: 2,
				start: 1000,
				end: 5000,
			},
		])
	})
	test('clear onEnd; include virtuals', () => {
		const pieceInstances = [
			createPieceInstance('zero', { start: 0 }, 'one', {
				scope: 'showstyle',
				presence: 'forward-scope',
				whenCovered: 'persist',
			}),
			createPieceInstance('one', { start: 500 }, 'one', {
				scope: 'rundown',
				presence: 'forward-scope',
				whenCovered: 'persist',
			}),
			createPieceInstance('two', { start: 1000 }, 'one', {
				scope: 'segment',
				presence: 'forward-scope',
				whenCovered: 'persist',
			}),
			createPieceInstance(
				'three',
				{ start: 3000 },
				'one',
				{ scope: 'rundown', presence: 'forward-scope', whenCovered: 'persist' },
				true
			),
			createPieceInstance(
				'four',
				{ start: 5000 },
				'one',
				{ scope: 'segment', presence: 'forward-scope', whenCovered: 'persist' },
				true
			),
			createPieceInstance(
				'five',
				{ start: 6000 },
				'one',
				{ scope: 'showstyle', presence: 'forward-scope', whenCovered: 'persist' },
				true
			),
		]

		const resolvedInstances = runAndTidyResult(pieceInstances, createPartCurrentTimes(500, 0), true)
		expect(resolvedInstances).toEqual([
			{
				_id: 'zero',
				priority: 0,
				start: 0,
				end: 3000,
			},
			{
				_id: 'one',
				priority: 1,
				start: 500,
				end: 3000,
			},
			{
				_id: 'two',
				priority: 2,
				start: 1000,
				end: 5000,
			},
			{
				_id: 'three',
				priority: 1,
				start: 3000,
				end: 5000,
			},
			{
				_id: 'four',
				priority: 2,
				start: 5000,
				end: undefined,
			},
			{
				_id: 'five',
				priority: 0,
				start: 6000,
				end: undefined,
			},
		])
	})
	test('stop onSegmentChange with onEnd', () => {
		const pieceInstances = [
			createPieceInstance('zero', { start: 0 }, 'one', {
				scope: 'showstyle',
				presence: 'forward-scope',
				whenCovered: 'persist',
			}),
			createPieceInstance('one', { start: 500 }, 'one', {
				scope: 'segment',
				presence: 'forward-scope',
				whenCovered: 'persist',
			}),
			createPieceInstance('two', { start: 1000 }, 'one', {
				scope: 'segment',
				presence: 'follow-playhead',
				whenCovered: 'stop',
			}),
			createPieceInstance('three', { start: 2000 }, 'one', {
				scope: 'rundown',
				presence: 'forward-scope',
				whenCovered: 'persist',
			}),
			createPieceInstance('four', { start: 5000 }, 'one', {
				scope: 'segment',
				presence: 'forward-scope',
				whenCovered: 'persist',
			}),
			createPieceInstance('five', { start: 6000 }, 'one', {
				scope: 'showstyle',
				presence: 'forward-scope',
				whenCovered: 'persist',
			}),
		]

		const resolvedInstances = runAndTidyResult(pieceInstances, createPartCurrentTimes(500, 0))
		expect(resolvedInstances).toEqual([
			{
				_id: 'zero',
				priority: 0,
				start: 0,
				end: 6000,
			},
			{
				_id: 'one',
				priority: 2,
				start: 500,
				end: 5000,
			},
			{
				_id: 'two',
				priority: 5,
				start: 1000,
				end: 5000,
			},
			{
				_id: 'three',
				priority: 1,
				start: 2000,
				end: undefined,
			},
			{
				_id: 'four',
				priority: 2,
				start: 5000,
				end: undefined,
			},
			{
				_id: 'five',
				priority: 0,
				start: 6000,
				end: undefined,
			},
		])
	})
	test('prefer newer adlib', () => {
		const pieceInstances = [
			createPieceInstance(
				'one',
				{ start: 1000 },
				'one',
				{ scope: 'segment', presence: 'forward-scope', whenCovered: 'persist' },
				6000
			),
			createPieceInstance(
				'two',
				{ start: 1000 },
				'one',
				{ scope: 'segment', presence: 'forward-scope', whenCovered: 'persist' },
				5500
			),
		]

		const resolvedInstances = runAndTidyResult(pieceInstances, createPartCurrentTimes(500, 0))
		expect(resolvedInstances).toEqual([
			{
				_id: 'one',
				priority: 2,
				start: 1000,
				end: undefined,
			},
		])
	})
	test('prefer newer adlib2', () => {
		const pieceInstances = [
			createPieceInstance(
				'one',
				{ start: 1000 },
				'one',
				{ scope: 'rundown', presence: 'follow-playhead', whenCovered: 'stop' },
				6000
			),
			createPieceInstance(
				'two',
				{ start: 1000 },
				'one',
				{ scope: 'rundown', presence: 'follow-playhead', whenCovered: 'stop' },
				5500
			),
			createPieceInstance(
				'three',
				{ start: 1000 },
				'one',
				{ scope: 'rundown', presence: 'follow-playhead', whenCovered: 'stop' },
				7000
			),
			createPieceInstance(
				'four',
				{ start: 1000 },
				'one',
				{ scope: 'rundown', presence: 'follow-playhead', whenCovered: 'stop' },
				4000
			),
		]

		const resolvedInstances = runAndTidyResult(pieceInstances, createPartCurrentTimes(500, 0))
		expect(resolvedInstances).toEqual([
			{
				_id: 'three',
				priority: 5,
				start: 1000,
				end: undefined,
			},
		])
	})
	test('prefer newer adlib3', () => {
		const pieceInstances = [
			createPieceInstance(
				'one',
				{ start: 1000 },
				'one',
				{ scope: 'showstyle', presence: 'forward-scope', whenCovered: 'persist' },
				6000
			),
			createPieceInstance(
				'two',
				{ start: 1000 },
				'one',
				{ scope: 'showstyle', presence: 'forward-scope', whenCovered: 'persist' },
				5500
			),
		]

		const resolvedInstances = runAndTidyResult(pieceInstances, createPartCurrentTimes(500, 0))
		expect(resolvedInstances).toEqual([
			{
				_id: 'one',
				priority: 0,
				start: 1000,
				end: undefined,
			},
		])
	})
	test('continue onChange when start=0 and onEnd is present, and both are infinite continuations', () => {
		const pieceInstances = [
			createPieceInstance(
				'one',
				{ start: 0 },
				'one',
				{ scope: 'segment', presence: 'follow-playhead', whenCovered: 'stop' },
				6000,
				{
					fromPreviousPart: true,
					fromPreviousPlayhead: true,
					infiniteInstanceId: protectString('one_a'),
					infiniteInstanceIndex: 0,
					infinitePieceId: protectString('one_b'),
				}
			),
			createPieceInstance(
				'two',
				{ start: 0 },
				'one',
				{ scope: 'segment', presence: 'forward-scope', whenCovered: 'persist' },
				false,
				{
					fromPreviousPart: true,
					infiniteInstanceId: protectString('two_a'),
					infiniteInstanceIndex: 0,
					infinitePieceId: protectString('two_b'),
				}
			),
		]

		const resolvedInstances = runAndTidyResult(pieceInstances, createPartCurrentTimes(500, 0))
		expect(resolvedInstances).toEqual([
			{
				_id: 'one',
				priority: 5,
				start: 0,
				end: undefined,
			},
			{
				_id: 'two',
				priority: 2,
				start: 0,
				end: undefined,
			},
		])
	})
	test('stop onChange when start=0 and onEnd is present, and both are infinite continuations', () => {
		const pieceInstances = [
			createPieceInstance(
				'one',
				{ start: 0 },
				'one',
				{ scope: 'segment', presence: 'follow-playhead', whenCovered: 'stop' },
				6000,
				{
					fromPreviousPart: true,
					fromPreviousPlayhead: true,
					infiniteInstanceId: protectString('one_a'),
					infiniteInstanceIndex: 0,
					infinitePieceId: protectString('one_b'),
				}
			),
			createPieceInstance(
				'two',
				{ start: 0 },
				'one',
				{ scope: 'segment', presence: 'forward-scope', whenCovered: 'persist' },
				false,
				{
					fromPreviousPart: false,
					infiniteInstanceId: protectString('two_a'),
					infiniteInstanceIndex: 0,
					infinitePieceId: protectString('two_b'),
				}
			),
		]

		const resolvedInstances = runAndTidyResult(pieceInstances, createPartCurrentTimes(500, 0))
		expect(resolvedInstances).toEqual([
			{
				_id: 'two',
				priority: 2,
				start: 0,
				end: undefined,
			},
		])
	})
	test('stop onRundownEnd continuation when start=0 and onSegmentEnd is present', () => {
		const pieceInstances = [
			createPieceInstance(
				'one',
				{ start: 0 },
				'one',
				{ scope: 'rundown', presence: 'forward-scope', whenCovered: 'persist' },
				false,
				{
					fromPreviousPart: true,
					infiniteInstanceId: protectString('one_a'),
					infiniteInstanceIndex: 0,
					infinitePieceId: protectString('one_b'),
				}
			),
			createPieceInstance(
				'two',
				{ start: 0 },
				'one',
				{ scope: 'segment', presence: 'forward-scope', whenCovered: 'persist' },
				false,
				{
					fromPreviousPart: false,
					infiniteInstanceId: protectString('two_a'),
					infiniteInstanceIndex: 0,
					infinitePieceId: protectString('two_b'),
				}
			),
		]

		pieceInstances[1].piece.virtual = true

		const resolvedInstances = runAndTidyResult(pieceInstances, createPartCurrentTimes(500, 0))

		// don't expect virtual Pieces in the results, but 'one' should be pruned too
		expect(resolvedInstances).toEqual([])
	})

	test('stop onSegmentChange continuation with planned onSegmentEnd start=0', () => {
		const pieceInstances = [
			createPieceInstance(
				'one',
				{ start: 0 },
				'one',
				{ scope: 'segment', presence: 'follow-playhead', whenCovered: 'stop' },
				false,
				{
					fromPreviousPart: true,
					fromPreviousPlayhead: true,
					infiniteInstanceId: protectString('one_a'),
					infiniteInstanceIndex: 1,
					infinitePieceId: protectString('one_b'),
				}
			),
			createPieceInstance(
				'two',
				{ start: 0 },
				'one',
				{ scope: 'segment', presence: 'forward-scope', whenCovered: 'persist' },
				false,
				{
					fromPreviousPart: false,
					infiniteInstanceId: protectString('two_a'),
					infiniteInstanceIndex: 0,
					infinitePieceId: protectString('two_b'),
				}
			),
		]

		// Set the first as adlibbed during the previous part
		pieceInstances[0].dynamicallyInserted = 1

		// Pieces should have preroll
		pieceInstances[0].piece.prerollDuration = 200
		pieceInstances[1].piece.prerollDuration = 200

		const resolvedInstances = runAndTidyResult(pieceInstances, createPartCurrentTimes(500, 0))

		expect(resolvedInstances).toEqual([
			{
				_id: 'two',
				end: undefined,
				priority: 2,
				start: 0,
			},
		])
	})

	describe('absolute timed (rundown owned) pieces', () => {
		test('simple collision', () => {
			const now = 9000
			const partStart = 8000

			const pieceInstances = [
				createPieceInstance('one', { start: 0 }, 'one', {
					scope: 'rundown',
					presence: 'follow-playhead',
					whenCovered: 'stop',
				}),
				createPieceInstance('two', { start: now + 2000, isAbsolute: true }, 'one', {
					scope: 'rundown',
					presence: 'follow-playhead',
					whenCovered: 'stop',
				}),
				createPieceInstance('three', { start: 6000 }, 'one', {
					scope: 'rundown',
					presence: 'follow-playhead',
					whenCovered: 'stop',
				}),
			]

			const resolvedInstances = runAndTidyResult(pieceInstances, createPartCurrentTimes(now, partStart))
			expect(resolvedInstances).toEqual([
				{
					_id: 'one',
					priority: 5,
					start: 0,
					end: 3000,
				},
				{
					_id: 'two',
					priority: 5,
					start: partStart + 3000,
					end: partStart + 6000,
				},
				{
					_id: 'three',
					priority: 5,
					start: 6000,
					end: undefined,
				},
			])
		})

		test('collision with same start time', () => {
			const now = 9000
			const partStart = 8000

			const pieceInstances = [
				createPieceInstance('one', { start: 0 }, 'one', {
					scope: 'rundown',
					presence: 'follow-playhead',
					whenCovered: 'stop',
				}),
				createPieceInstance('two', { start: partStart + 2000, isAbsolute: true }, 'one', {
					scope: 'rundown',
					presence: 'follow-playhead',
					whenCovered: 'stop',
				}),
				createPieceInstance('three', { start: 2000 }, 'one', {
					scope: 'rundown',
					presence: 'follow-playhead',
					whenCovered: 'stop',
				}),
			]

			const resolvedInstances = runAndTidyResult(pieceInstances, createPartCurrentTimes(now, partStart))
			expect(resolvedInstances).toEqual([
				{
					_id: 'one',
					priority: 5,
					start: 0,
					end: 2000,
				},
				{
					_id: 'two',
					priority: 5,
					start: partStart + 2000,
					end: undefined,
				},
			])

			{
				// check stability
				pieceInstances[1].piece.enable = { start: 2000 }
				pieceInstances[2].piece.enable = { start: partStart + 2000, isAbsolute: true }

				const resolvedInstances = runAndTidyResult(pieceInstances, createPartCurrentTimes(now, partStart))
				expect(resolvedInstances).toEqual([
					{
						_id: 'one',
						priority: 5,
						start: 0,
						end: 2000,
					},
					{
						_id: 'three',
						priority: 5,
						start: partStart + 2000,
						end: undefined,
					},
				])
			}
		})
	})

	test('nested pieces persisting when covered resume when the one covering them ends', () => {
		const partPersist = { scope: 'part', presence: 'forward-scope', whenCovered: 'persist' } as const
		const pieceInstances = [
			createPieceInstance(
				'incoming',
				{ start: 0 },
				'one',
				{ scope: 'rundown', presence: 'forward-scope', whenCovered: 'persist' },
				false,
				{
					infiniteInstanceId: protectString('incoming_inf'),
					infiniteInstanceIndex: 1,
					infinitePieceId: protectString('incoming_p'),
					fromPreviousPart: true,
				}
			),
			createPieceInstance('a', { start: 1000, duration: 5000 }, 'one', partPersist),
			createPieceInstance('b', { start: 2000, duration: 3000 }, 'one', partPersist),
			createPieceInstance('c', { start: 3000, duration: 1000 }, 'one', partPersist),
		]

		// Nothing is cut short, the timeline shows the newest piece still on air at any point
		const resolvedInstances = runAndTidyResult(pieceInstances, createPartCurrentTimes(500, 0))
		expect(resolvedInstances).toEqual([
			{ _id: 'incoming', priority: 1, start: 0, end: undefined },
			{ _id: 'a', priority: 3, start: 1000, end: undefined },
			{ _id: 'b', priority: 3, start: 2000, end: undefined },
			{ _id: 'c', priority: 3, start: 3000, end: undefined },
		])
	})

	test('an open ended piece persisting when covered stops the ones of its scope it covers', () => {
		const partPersist = { scope: 'part', presence: 'forward-scope', whenCovered: 'persist' } as const
		const pieceInstances = [
			createPieceInstance('a', { start: 1000, duration: 5000 }, 'one', partPersist),
			createPieceInstance('b', { start: 2000, duration: 1000 }, 'one', partPersist),
			createPieceInstance('c', { start: 4000 }, 'one', partPersist),
		]

		const resolvedInstances = runAndTidyResult(pieceInstances, createPartCurrentTimes(500, 0))
		expect(resolvedInstances).toEqual([
			{ _id: 'a', priority: 3, start: 1000, end: 4000 },
			{ _id: 'b', priority: 3, start: 2000, end: 4000 },
			{ _id: 'c', priority: 3, start: 4000, end: undefined },
		])
	})

	test('keeps pieces of every lifespan combination', () => {
		const scopes = ['part', 'segment', 'rundown', 'showstyle', 'playlist'] as const
		const presences = ['forward-scope', 'follow-playhead'] as const
		const whenCovereds = ['stop', 'persist'] as const

		const pieceInstances: PieceInstance[] = []
		const expected: ReturnType<typeof runAndTidyResult> = []
		for (const scope of scopes) {
			for (const presence of presences) {
				for (const whenCovered of whenCovereds) {
					const id = `${scope}:${presence}:${whenCovered}`
					pieceInstances.push(createPieceInstance(id, { start: 0 }, id, { scope, presence, whenCovered }))
					expected.push({
						_id: protectString(id),
						start: 0,
						end: undefined,
						priority:
							whenCovered === 'persist'
								? { part: 3, segment: 2, rundown: 1, showstyle: 0, playlist: -1 }[scope]
								: 5,
					})
				}
			}
		}

		const resolvedInstances = runAndTidyResult(pieceInstances, createPartCurrentTimes(500, 0))
		expect(resolvedInstances).toEqual(expected)
	})

	test('part scoped persisting piece covers a broader one without stopping it', () => {
		const pieceInstances = [
			createPieceInstance('rundown', { start: 0 }, 'one', {
				scope: 'rundown',
				presence: 'forward-scope',
				whenCovered: 'persist',
			}),
			createPieceInstance('part', { start: 1000, duration: 2000 }, 'one', {
				scope: 'part',
				presence: 'forward-scope',
				whenCovered: 'persist',
			}),
		]

		const resolvedInstances = runAndTidyResult(pieceInstances, createPartCurrentTimes(500, 0))
		expect(resolvedInstances).toEqual([
			{
				_id: 'rundown',
				priority: 1,
				start: 0,
				end: undefined,
			},
			{
				_id: 'part',
				priority: 3,
				start: 1000,
				end: undefined,
			},
		])
	})
})

describe('resolvePrunedPieceInstances', () => {
	function createPieceInstance(
		enable: Piece['enable'],
		resolvedEndCap?: PieceInstanceWithTimings['resolvedEndCap'],
		userDuration?: PieceInstance['userDuration']
	): PieceInstanceWithTimings {
		return literal<PieceInstanceWithTimings>({
			_id: protectString(''),
			rundownId: protectString(''),
			partInstanceId: protectString(''),
			playlistActivationId: protectString('active'),
			piece: literal<PieceInstancePiece>({
				_id: protectString(''),
				externalId: '',
				startPartId: protectString(''),
				enable: enable,
				name: '',
				lifespan: { scope: 'part', presence: 'forward-scope', whenCovered: 'stop' },
				sourceLayerId: '',
				outputLayerId: '',
				invalid: false,
				virtual: false,
				content: {},
				timelineObjectsString: EmptyPieceTimelineObjectsBlob,
				pieceType: IBlueprintPieceType.Normal,
			}),
			priority: Math.random(),
			resolvedEndCap,
			userDuration,
		})
	}

	test('numeric start, no duration', async () => {
		const partTimes = createPartCurrentTimes(123, 0)
		const piece = createPieceInstance({ start: 2000 })

		expect(resolvePrunedPieceInstance(partTimes, clone(piece))).toStrictEqual({
			instance: clone(piece),
			timelinePriority: piece.priority,
			resolvedStart: 2000,
			resolvedDuration: undefined,
		} satisfies ResolvedPieceInstance)
	})

	test('numeric start, with planned duration', async () => {
		const partTimes = createPartCurrentTimes(123, 0)
		const piece = createPieceInstance({ start: 2000, duration: 3400 })

		expect(resolvePrunedPieceInstance(partTimes, clone(piece))).toStrictEqual({
			instance: clone(piece),
			timelinePriority: piece.priority,
			resolvedStart: 2000,
			resolvedDuration: 3400,
		} satisfies ResolvedPieceInstance)
	})

	test('now start, no duration', async () => {
		const partTimes = createPartCurrentTimes(123, 0)
		const piece = createPieceInstance({ start: 'now' })

		expect(resolvePrunedPieceInstance(partTimes, clone(piece))).toStrictEqual({
			instance: clone(piece),
			timelinePriority: piece.priority,
			resolvedStart: partTimes.nowInPart,
			resolvedDuration: undefined,
		} satisfies ResolvedPieceInstance)
	})

	test('now start, with planned duration', async () => {
		const partTimes = createPartCurrentTimes(123, 0)
		const piece = createPieceInstance({ start: 'now', duration: 3400 })

		expect(resolvePrunedPieceInstance(partTimes, clone(piece))).toStrictEqual({
			instance: clone(piece),
			timelinePriority: piece.priority,
			resolvedStart: partTimes.nowInPart,
			resolvedDuration: 3400,
		} satisfies ResolvedPieceInstance)
	})

	test('now start, with end cap', async () => {
		const partTimes = createPartCurrentTimes(123, 0)
		const piece = createPieceInstance({ start: 'now' }, 5000)

		expect(resolvePrunedPieceInstance(partTimes, clone(piece))).toStrictEqual({
			instance: clone(piece),
			timelinePriority: piece.priority,
			resolvedStart: partTimes.nowInPart,
			resolvedDuration: 5000 - partTimes.nowInPart,
		} satisfies ResolvedPieceInstance)
	})

	test('now start, with end cap and longer planned duration', async () => {
		const partTimes = createPartCurrentTimes(123, 0)
		const piece = createPieceInstance({ start: 'now', duration: 6000 }, 5000)

		expect(resolvePrunedPieceInstance(partTimes, clone(piece))).toStrictEqual({
			instance: clone(piece),
			timelinePriority: piece.priority,
			resolvedStart: partTimes.nowInPart,
			resolvedDuration: 5000 - partTimes.nowInPart,
		} satisfies ResolvedPieceInstance)
	})

	test('now start, with end cap and shorter planned duration', async () => {
		const partTimes = createPartCurrentTimes(123, 0)
		const piece = createPieceInstance({ start: 'now', duration: 3000 }, 5000)

		expect(resolvePrunedPieceInstance(partTimes, clone(piece))).toStrictEqual({
			instance: clone(piece),
			timelinePriority: piece.priority,
			resolvedStart: partTimes.nowInPart,
			resolvedDuration: 3000,
		} satisfies ResolvedPieceInstance)
	})

	test('now start, with userDuration.endRelativeToPart', async () => {
		const partTimes = createPartCurrentTimes(123, 0)
		const piece = createPieceInstance({ start: 'now' }, undefined, {
			endRelativeToPart: 4000,
		})

		expect(resolvePrunedPieceInstance(partTimes, clone(piece))).toStrictEqual({
			instance: clone(piece),
			timelinePriority: piece.priority,
			resolvedStart: partTimes.nowInPart,
			resolvedDuration: 4000 - partTimes.nowInPart,
		} satisfies ResolvedPieceInstance)
	})

	test('now start, with end cap, planned duration and userDuration.endRelativeToPart', async () => {
		const partTimes = createPartCurrentTimes(123, 0)
		const piece = createPieceInstance({ start: 'now', duration: 3000 }, 5000, { endRelativeToPart: 2800 })

		expect(resolvePrunedPieceInstance(partTimes, clone(piece))).toStrictEqual({
			instance: clone(piece),
			timelinePriority: piece.priority,
			resolvedStart: partTimes.nowInPart,
			resolvedDuration: 2800 - partTimes.nowInPart,
		} satisfies ResolvedPieceInstance)
	})
})
