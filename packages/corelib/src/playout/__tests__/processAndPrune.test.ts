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
				inShadow: 'persist',
			}),
			createPieceInstance('two', { start: 1000 }, 'two', {
				scope: 'rundown',
				presence: 'forward-scope',
				inShadow: 'persist',
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
				inShadow: 'persist',
			}),
			createPieceInstance('two', { start: 1000, duration: 5000 }, 'one', {
				scope: 'rundown',
				presence: 'forward-scope',
				inShadow: 'persist',
			}),
		]

		// 'one' persists in shadow of 'two', and resumes when it ends
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
	test('onEnd type override', () => {
		const pieceInstances = [
			createPieceInstance('zero', { start: 0 }, 'one', {
				scope: 'showstyle',
				presence: 'forward-scope',
				inShadow: 'persist',
			}),
			createPieceInstance('one', { start: 500 }, 'one', {
				scope: 'rundown',
				presence: 'forward-scope',
				inShadow: 'persist',
			}),
			createPieceInstance('two', { start: 1000, duration: 5000 }, 'one', {
				scope: 'segment',
				presence: 'forward-scope',
				inShadow: 'persist',
			}),
			createPieceInstance('four', { start: 2000, duration: 2000 }, 'one', {
				scope: 'part',
				presence: 'forward-scope',
				inShadow: 'stop',
			}),
			createPieceInstance('three', { start: 3000 }, 'one', {
				scope: 'rundown',
				presence: 'forward-scope',
				inShadow: 'persist',
			}),
			createPieceInstance('five', { start: 4000 }, 'one', {
				scope: 'showstyle',
				presence: 'forward-scope',
				inShadow: 'persist',
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
				inShadow: 'persist',
			}),
			createPieceInstance('one', { start: 500 }, 'one', {
				scope: 'rundown',
				presence: 'forward-scope',
				inShadow: 'persist',
			}),
			createPieceInstance('two', { start: 1000 }, 'one', {
				scope: 'segment',
				presence: 'forward-scope',
				inShadow: 'persist',
			}),
			createPieceInstance(
				'three',
				{ start: 3000 },
				'one',
				{ scope: 'rundown', presence: 'forward-scope', inShadow: 'persist' },
				true
			),
			createPieceInstance(
				'two',
				{ start: 5000 },
				'one',
				{ scope: 'segment', presence: 'forward-scope', inShadow: 'persist' },
				true
			),
			createPieceInstance(
				'zero',
				{ start: 6000 },
				'one',
				{ scope: 'showstyle', presence: 'forward-scope', inShadow: 'persist' },
				true
			),
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
				inShadow: 'persist',
			}),
			createPieceInstance('one', { start: 500 }, 'one', {
				scope: 'rundown',
				presence: 'forward-scope',
				inShadow: 'persist',
			}),
			createPieceInstance('two', { start: 1000 }, 'one', {
				scope: 'segment',
				presence: 'forward-scope',
				inShadow: 'persist',
			}),
			createPieceInstance(
				'three',
				{ start: 3000 },
				'one',
				{ scope: 'rundown', presence: 'forward-scope', inShadow: 'persist' },
				true
			),
			createPieceInstance(
				'four',
				{ start: 5000 },
				'one',
				{ scope: 'segment', presence: 'forward-scope', inShadow: 'persist' },
				true
			),
			createPieceInstance(
				'five',
				{ start: 6000 },
				'one',
				{ scope: 'showstyle', presence: 'forward-scope', inShadow: 'persist' },
				true
			),
		]

		const resolvedInstances = runAndTidyResult(pieceInstances, createPartCurrentTimes(500, 0), true)
		expect(resolvedInstances).toEqual([
			{
				_id: 'zero',
				priority: 0,
				start: 0,
				end: 6000,
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
	test('stop onSegmentChange with onEnd', () => {
		const pieceInstances = [
			createPieceInstance('zero', { start: 0 }, 'one', {
				scope: 'showstyle',
				presence: 'forward-scope',
				inShadow: 'persist',
			}),
			createPieceInstance('one', { start: 500 }, 'one', {
				scope: 'segment',
				presence: 'forward-scope',
				inShadow: 'persist',
			}),
			createPieceInstance('two', { start: 1000 }, 'one', {
				scope: 'segment',
				presence: 'follow-playhead',
				inShadow: 'stop',
			}),
			createPieceInstance('three', { start: 2000 }, 'one', {
				scope: 'rundown',
				presence: 'forward-scope',
				inShadow: 'persist',
			}),
			createPieceInstance('four', { start: 5000 }, 'one', {
				scope: 'segment',
				presence: 'forward-scope',
				inShadow: 'persist',
			}),
			createPieceInstance('five', { start: 6000 }, 'one', {
				scope: 'showstyle',
				presence: 'forward-scope',
				inShadow: 'persist',
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
				{ scope: 'segment', presence: 'forward-scope', inShadow: 'persist' },
				6000
			),
			createPieceInstance(
				'two',
				{ start: 1000 },
				'one',
				{ scope: 'segment', presence: 'forward-scope', inShadow: 'persist' },
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
				{ scope: 'rundown', presence: 'follow-playhead', inShadow: 'stop' },
				6000
			),
			createPieceInstance(
				'two',
				{ start: 1000 },
				'one',
				{ scope: 'rundown', presence: 'follow-playhead', inShadow: 'stop' },
				5500
			),
			createPieceInstance(
				'three',
				{ start: 1000 },
				'one',
				{ scope: 'rundown', presence: 'follow-playhead', inShadow: 'stop' },
				7000
			),
			createPieceInstance(
				'four',
				{ start: 1000 },
				'one',
				{ scope: 'rundown', presence: 'follow-playhead', inShadow: 'stop' },
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
				{ scope: 'showstyle', presence: 'forward-scope', inShadow: 'persist' },
				6000
			),
			createPieceInstance(
				'two',
				{ start: 1000 },
				'one',
				{ scope: 'showstyle', presence: 'forward-scope', inShadow: 'persist' },
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
				{ scope: 'segment', presence: 'follow-playhead', inShadow: 'stop' },
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
				{ scope: 'segment', presence: 'forward-scope', inShadow: 'persist' },
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
				{ scope: 'segment', presence: 'follow-playhead', inShadow: 'stop' },
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
				{ scope: 'segment', presence: 'forward-scope', inShadow: 'persist' },
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
				{ scope: 'rundown', presence: 'forward-scope', inShadow: 'persist' },
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
				{ scope: 'segment', presence: 'forward-scope', inShadow: 'persist' },
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
				{ scope: 'segment', presence: 'follow-playhead', inShadow: 'stop' },
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
				{ scope: 'segment', presence: 'forward-scope', inShadow: 'persist' },
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
					inShadow: 'stop',
				}),
				createPieceInstance('two', { start: now + 2000, isAbsolute: true }, 'one', {
					scope: 'rundown',
					presence: 'follow-playhead',
					inShadow: 'stop',
				}),
				createPieceInstance('three', { start: 6000 }, 'one', {
					scope: 'rundown',
					presence: 'follow-playhead',
					inShadow: 'stop',
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
					inShadow: 'stop',
				}),
				createPieceInstance('two', { start: partStart + 2000, isAbsolute: true }, 'one', {
					scope: 'rundown',
					presence: 'follow-playhead',
					inShadow: 'stop',
				}),
				createPieceInstance('three', { start: 2000 }, 'one', {
					scope: 'rundown',
					presence: 'follow-playhead',
					inShadow: 'stop',
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

	test('nested pieces persisting in shadow resume when the one covering them ends', () => {
		const partPersist = { scope: 'part', presence: 'forward-scope', inShadow: 'persist' } as const
		const pieceInstances = [
			createPieceInstance(
				'incoming',
				{ start: 0 },
				'one',
				{ scope: 'rundown', presence: 'forward-scope', inShadow: 'persist' },
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

	test('an open ended piece persisting in shadow stops the ones of its scope it covers', () => {
		const partPersist = { scope: 'part', presence: 'forward-scope', inShadow: 'persist' } as const
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
		const inShadows = ['stop', 'persist'] as const

		const pieceInstances: PieceInstance[] = []
		const expected: ReturnType<typeof runAndTidyResult> = []
		for (const scope of scopes) {
			for (const presence of presences) {
				for (const inShadow of inShadows) {
					const id = `${scope}:${presence}:${inShadow}`
					pieceInstances.push(createPieceInstance(id, { start: 0 }, id, { scope, presence, inShadow }))
					expected.push({
						_id: protectString(id),
						start: 0,
						end: undefined,
						priority:
							inShadow === 'persist'
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
				inShadow: 'persist',
			}),
			createPieceInstance('part', { start: 1000, duration: 2000 }, 'one', {
				scope: 'part',
				presence: 'forward-scope',
				inShadow: 'persist',
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
				lifespan: { scope: 'part', presence: 'forward-scope', inShadow: 'stop' },
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
