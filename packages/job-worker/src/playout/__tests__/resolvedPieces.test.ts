/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { setupMockShowStyleCompound } from '../../__mocks__/presetCollections.js'
import { MockJobContext, setupDefaultJobEnvironment } from '../../__mocks__/context.js'
import { SourceLayers } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { ReadonlyDeep } from 'type-fest'
import { protectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import { getRandomId } from '@sofie-automation/corelib/dist/lib'
import { IBlueprintPieceType, PieceLifespan } from '@sofie-automation/blueprints-integration'
import {
	PieceInstance,
	PieceInstancePiece,
	ResolvedPieceInstance,
} from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { EmptyPieceTimelineObjectsBlob } from '@sofie-automation/corelib/dist/dataModel/Piece'
import {
	createPartCurrentTimes,
	PartCurrentTimes,
	processAndPrunePieceInstanceTimings,
	resolvePrunedPieceInstance,
} from '@sofie-automation/corelib/dist/playout/processAndPrune'
import { getResolvedPiecesForPartInstancesOnTimeline } from '../resolvedPieces.js'
import { SelectedPartInstanceTimelineInfo } from '../timeline/generate.js'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { setupPieceInstanceInfiniteProperties } from '../pieces.js'
import { getPartTimingsOrDefaults } from '@sofie-automation/corelib/dist/playout/timings'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { PieceInstanceId } from '@sofie-automation/corelib/dist/dataModel/Ids'

describe('Resolved Pieces', () => {
	let context: MockJobContext
	let sourceLayers: ReadonlyDeep<SourceLayers>

	beforeEach(async () => {
		context = setupDefaultJobEnvironment()

		const showStyle = await setupMockShowStyleCompound(context)
		sourceLayers = showStyle.sourceLayers
	})

	type StrippedResult = (Pick<ResolvedPieceInstance, 'resolvedStart' | 'resolvedDuration'> & {
		_id: PieceInstanceId
	})[]
	function stripResult(result: ResolvedPieceInstance[]): StrippedResult {
		return result
			.map((resolvedPiece) => ({
				_id: resolvedPiece.instance._id,
				resolvedStart: resolvedPiece.resolvedStart,
				resolvedDuration: resolvedPiece.resolvedDuration,
			}))
			.sort((a, b) => a.resolvedStart - b.resolvedStart)
	}

	function createPieceInstance(
		sourceLayerId: string,
		enable: PieceInstancePiece['enable'],
		piecePartial?: Partial<
			Pick<PieceInstancePiece, 'lifespan' | 'virtual' | 'prerollDuration' | 'postrollDuration'>
		>,
		instancePartial?: Partial<Pick<PieceInstance, 'userDuration'>>
	): PieceInstance {
		const piece: PieceInstance = {
			_id: getRandomId(),
			playlistActivationId: protectString(''),
			rundownId: protectString(''),
			partInstanceId: protectString(''),
			disabled: false,
			piece: {
				_id: getRandomId(),
				externalId: '',
				startPartId: protectString(''),
				invalid: false,
				name: '',
				content: {},
				pieceType: IBlueprintPieceType.Normal,
				sourceLayerId,
				outputLayerId: '',
				lifespan: piecePartial?.lifespan ?? PieceLifespan.WithinPart,
				enable,
				virtual: piecePartial?.virtual ?? false,
				timelineObjectsString: EmptyPieceTimelineObjectsBlob,
			},
			userDuration: instancePartial?.userDuration,
		}

		if (piece.piece.lifespan !== PieceLifespan.WithinPart) {
			setupPieceInstanceInfiniteProperties(piece)
		}

		return piece
	}

	describe('getResolvedPiecesForCurrentPartInstance', () => {
		function getResolvedPiecesInner(
			sourceLayers: SourceLayers,
			nowInPart: number | null,
			pieceInstances: PieceInstance[]
		): ResolvedPieceInstance[] {
			const partTimes = createPartCurrentTimes(5000, nowInPart)
			const preprocessedPieces = processAndPrunePieceInstanceTimings(sourceLayers, pieceInstances, partTimes)
			return preprocessedPieces.map((instance) => resolvePrunedPieceInstance(partTimes, instance))
		}

		test('simple single piece', async () => {
			const sourceLayerId = Object.keys(sourceLayers)[0]
			expect(sourceLayerId).toBeTruthy()

			const piece0 = createPieceInstance(sourceLayerId, { start: 0 })

			const resolvedPieces = getResolvedPiecesInner(sourceLayers, null, [piece0])

			expect(stripResult(resolvedPieces)).toEqual([
				{
					_id: piece0._id,
					resolvedStart: 0,
					resolvedDuration: undefined,
				},
			] satisfies StrippedResult)
		})

		test('non-overlapping simple pieces', async () => {
			const sourceLayerId = Object.keys(sourceLayers)[0]
			expect(sourceLayerId).toBeTruthy()

			const piece0 = createPieceInstance(sourceLayerId, { start: 1000, duration: 2000 })
			const piece1 = createPieceInstance(sourceLayerId, { start: 4000 })

			const resolvedPieces = getResolvedPiecesInner(sourceLayers, null, [piece0, piece1])

			expect(stripResult(resolvedPieces)).toEqual([
				{
					_id: piece0._id,
					resolvedStart: 1000,
					resolvedDuration: 2000,
				},
				{
					_id: piece1._id,
					resolvedStart: 4000,
					resolvedDuration: undefined,
				},
			] satisfies StrippedResult)
		})

		test('overlapping simple pieces', async () => {
			const sourceLayerId = Object.keys(sourceLayers)[0]
			expect(sourceLayerId).toBeTruthy()

			const piece0 = createPieceInstance(sourceLayerId, { start: 1000, duration: 8000 })
			const piece1 = createPieceInstance(sourceLayerId, { start: 4000 })

			const resolvedPieces = getResolvedPiecesInner(sourceLayers, null, [piece0, piece1])

			expect(stripResult(resolvedPieces)).toEqual([
				{
					_id: piece0._id,
					resolvedStart: 1000,
					resolvedDuration: 3000,
				},
				{
					_id: piece1._id,
					resolvedStart: 4000,
					resolvedDuration: undefined,
				},
			] satisfies StrippedResult)
		})

		test('colliding infinites', async () => {
			const sourceLayerId = Object.keys(sourceLayers)[0]
			expect(sourceLayerId).toBeTruthy()

			const piece0 = createPieceInstance(
				sourceLayerId,
				{ start: 1000 },
				{ lifespan: PieceLifespan.OutOnRundownEnd }
			)
			const piece1 = createPieceInstance(
				sourceLayerId,
				{ start: 4000 },
				{ lifespan: PieceLifespan.OutOnSegmentEnd }
			)
			const piece2 = createPieceInstance(sourceLayerId, { start: 8000, duration: 2000 })

			const resolvedPieces = getResolvedPiecesInner(sourceLayers, null, [piece0, piece1, piece2])

			expect(stripResult(resolvedPieces)).toEqual([
				{
					_id: piece0._id,
					resolvedStart: 1000,
					resolvedDuration: undefined,
				},
				{
					_id: piece1._id,
					resolvedStart: 4000,
					resolvedDuration: undefined,
				},
				{
					_id: piece2._id,
					resolvedStart: 8000,
					resolvedDuration: 2000,
				},
			] satisfies StrippedResult)
		})

		test('stopped by virtual', async () => {
			const sourceLayerId = Object.keys(sourceLayers)[0]
			expect(sourceLayerId).toBeTruthy()

			const piece0 = createPieceInstance(
				sourceLayerId,
				{ start: 1000 },
				{ lifespan: PieceLifespan.OutOnRundownEnd }
			)
			const piece1 = createPieceInstance(
				sourceLayerId,
				{ start: 4000 },
				{ lifespan: PieceLifespan.OutOnRundownEnd, virtual: true }
			)

			const resolvedPieces = getResolvedPiecesInner(sourceLayers, null, [piece0, piece1])

			expect(stripResult(resolvedPieces)).toEqual([
				{
					_id: piece0._id,
					resolvedStart: 1000,
					resolvedDuration: 3000,
				},
			] satisfies StrippedResult)
		})

		test('part not playing, timed interacts with "now"', async () => {
			const sourceLayerId = Object.keys(sourceLayers)[0]
			expect(sourceLayerId).toBeTruthy()

			const piece0 = createPieceInstance(sourceLayerId, { start: 1000 })
			const piece1 = createPieceInstance(sourceLayerId, { start: 'now' }, { virtual: true })

			const resolvedPieces = getResolvedPiecesInner(sourceLayers, null, [piece0, piece1])

			expect(stripResult(resolvedPieces)).toEqual([
				{
					_id: piece1._id,
					resolvedStart: 0,
					resolvedDuration: 1000,
				},
				{
					_id: piece0._id,
					resolvedStart: 1000,
					resolvedDuration: undefined,
				},
			] satisfies StrippedResult)
		})

		test('part is playing, timed interacts with "now"', async () => {
			const sourceLayerId = Object.keys(sourceLayers)[0]
			expect(sourceLayerId).toBeTruthy()

			const piece0 = createPieceInstance(sourceLayerId, { start: 1000 })
			const piece1 = createPieceInstance(sourceLayerId, { start: 'now' }, { virtual: true })

			const resolvedPieces = getResolvedPiecesInner(sourceLayers, 2500, [piece0, piece1])

			expect(stripResult(resolvedPieces)).toEqual([
				{
					_id: piece0._id,
					resolvedStart: 1000,
					resolvedDuration: 1500,
				},
				{
					_id: piece1._id,
					resolvedStart: 2500,
					resolvedDuration: undefined,
				},
			] satisfies StrippedResult)
		})

		test('userDuration.endRelativeToPart', async () => {
			const sourceLayerId = Object.keys(sourceLayers)[0]
			expect(sourceLayerId).toBeTruthy()

			const piece0 = createPieceInstance(
				sourceLayerId,
				{ start: 1000 },
				{},
				{
					userDuration: {
						endRelativeToPart: 2000,
					},
				}
			)

			const resolvedPieces = getResolvedPiecesInner(sourceLayers, 2500, [piece0])

			expect(stripResult(resolvedPieces)).toEqual([
				{
					_id: piece0._id,
					resolvedStart: 1000,
					resolvedDuration: 1000,
				},
			] satisfies StrippedResult)
		})

		test('preroll has no effect', async () => {
			const sourceLayerId = Object.keys(sourceLayers)[0]
			expect(sourceLayerId).toBeTruthy()

			const piece0 = createPieceInstance(
				sourceLayerId,
				{ start: 1000 },
				{
					prerollDuration: 500,
				}
			)

			const resolvedPieces = getResolvedPiecesInner(sourceLayers, null, [piece0])

			expect(stripResult(resolvedPieces)).toEqual([
				{
					_id: piece0._id,
					resolvedStart: 1000,
					resolvedDuration: undefined,
				},
			] satisfies StrippedResult)
		})

		test('postroll has no effect', async () => {
			const sourceLayerId = Object.keys(sourceLayers)[0]
			expect(sourceLayerId).toBeTruthy()

			const piece0 = createPieceInstance(
				sourceLayerId,
				{ start: 1000, duration: 1000 },
				{
					postrollDuration: 500,
				}
			)

			const resolvedPieces = getResolvedPiecesInner(sourceLayers, null, [piece0])

			expect(stripResult(resolvedPieces)).toEqual([
				{
					_id: piece0._id,
					resolvedStart: 1000,
					resolvedDuration: 1000,
				},
			] satisfies StrippedResult)
		})
	})

	describe('getResolvedPiecesForPartInstancesOnTimeline', () => {
		function createPartInstance(
			partProps?: Partial<Pick<DBPart, 'autoNext' | 'expectedDuration'>>
		): DBPartInstance {
			return {
				_id: getRandomId(),
				rundownId: protectString(''),
				segmentId: protectString(''),
				playlistActivationId: protectString(''),
				segmentPlayoutId: protectString(''),
				rehearsal: false,

				takeCount: 0,

				part: {
					_id: getRandomId(),
					_rank: 0,
					rundownId: protectString(''),
					segmentId: protectString(''),
					externalId: '',
					title: '',

					expectedDurationWithTransition: undefined,

					...partProps,
				},
			}
		}

		function createPartInstanceInfo(
			partTimes: PartCurrentTimes,
			// partStarted: number,
			// nowInPart: number,
			partInstance: DBPartInstance,
			currentPieces: PieceInstance[]
		): SelectedPartInstanceTimelineInfo {
			const pieceInstances = processAndPrunePieceInstanceTimings(sourceLayers, currentPieces, partTimes)

			return {
				partInstance,
				pieceInstances,
				partTimes,
				// Approximate `calculatedTimings`, for the partInstances which already have it cached
				calculatedTimings: getPartTimingsOrDefaults(partInstance, pieceInstances),
				regenerateTimelineAt: undefined,
			}
		}

		test('simple part scenario', async () => {
			const sourceLayerId = Object.keys(sourceLayers)[0]
			expect(sourceLayerId).toBeTruthy()

			const now = 990000
			const partTimes = createPartCurrentTimes(now, now)

			const piece001 = createPieceInstance(sourceLayerId, { start: 0 })
			const currentPartInfo = createPartInstanceInfo(partTimes, createPartInstance(), [piece001])

			const resolvedPieces = getResolvedPiecesForPartInstancesOnTimeline(
				context,
				{ current: currentPartInfo },
				now
			)

			expect(stripResult(resolvedPieces)).toEqual([
				{
					_id: piece001._id,
					resolvedStart: now,
					resolvedDuration: undefined,
				},
			] satisfies StrippedResult)
		})

		test('single piece stopped by virtual now', async () => {
			const sourceLayerId = Object.keys(sourceLayers)[0]
			expect(sourceLayerId).toBeTruthy()

			const piece001 = createPieceInstance(sourceLayerId, { start: 0 })

			// insert a virtual piece on the same layer
			const virtualPiece = createPieceInstance(
				sourceLayerId,
				{ start: 'now' },
				{
					virtual: true,
				}
			)

			const now = 990000
			const partTimes = createPartCurrentTimes(now, now - 2000)

			const currentPartInfo = createPartInstanceInfo(partTimes, createPartInstance(), [piece001, virtualPiece])

			// Check the result
			const simpleResolvedPieces = getResolvedPiecesForPartInstancesOnTimeline(
				context,
				{ current: currentPartInfo },
				now
			)
			expect(stripResult(simpleResolvedPieces)).toEqual([
				{
					_id: piece001._id,
					resolvedStart: partTimes.partStartTime!,
					resolvedDuration: partTimes.nowInPart,
				},
				{
					// TODO - this object should not be present?
					_id: virtualPiece._id,
					resolvedStart: now,
					resolvedDuration: undefined,
				},
			] satisfies StrippedResult)
		})

		test('single piece stopped by timed now', async () => {
			const sourceLayerId = Object.keys(sourceLayers)[0]
			expect(sourceLayerId).toBeTruthy()

			const piece001 = createPieceInstance(sourceLayerId, { start: 0 })

			// insert a virtual piece on the same layer
			const virtualPiece = createPieceInstance(
				sourceLayerId,
				{ start: 7000 },
				{
					virtual: true,
				}
			)

			const now = 990000
			const partTimes = createPartCurrentTimes(now, now - 2000)

			const currentPartInfo = createPartInstanceInfo(partTimes, createPartInstance(), [piece001, virtualPiece])

			const simpleResolvedPieces = getResolvedPiecesForPartInstancesOnTimeline(
				context,
				{ current: currentPartInfo },
				now
			)
			expect(stripResult(simpleResolvedPieces)).toEqual([
				{
					_id: piece001._id,
					resolvedStart: partTimes.partStartTime!,
					resolvedDuration: 7000,
				},
				{
					// TODO - this object should not be present?
					_id: virtualPiece._id,
					resolvedStart: partTimes.partStartTime! + 7000,
					resolvedDuration: undefined,
				},
			] satisfies StrippedResult)
		})

		test('single piece with zero length', async () => {
			const sourceLayerId = Object.keys(sourceLayers)[0]
			expect(sourceLayerId).toBeTruthy()

			const piece001 = createPieceInstance(sourceLayerId, { start: 0, duration: 0 })

			const now = 990000
			const partTimes = createPartCurrentTimes(now, now - 2000)

			const currentPartInfo = createPartInstanceInfo(partTimes, createPartInstance(), [piece001])

			const simpleResolvedPieces = getResolvedPiecesForPartInstancesOnTimeline(
				context,
				{ current: currentPartInfo },
				now
			)
			expect(stripResult(simpleResolvedPieces)).toEqual([
				{
					_id: piece001._id,
					resolvedStart: partTimes.partStartTime!,
					resolvedDuration: 0,
				},
			] satisfies StrippedResult)
		})

		test('within part overriding infinite for period', async () => {
			const sourceLayerId = Object.keys(sourceLayers)[0]
			expect(sourceLayerId).toBeTruthy()

			const piece001 = createPieceInstance(sourceLayerId, { start: 3000, duration: 2500 })

			const infinite1 = createPieceInstance(
				sourceLayerId,
				{ start: 1000 },
				{
					lifespan: PieceLifespan.OutOnSegmentEnd,
				}
			)
			const infinite2 = createPieceInstance(
				sourceLayerId,
				{ start: 5000 },
				{
					lifespan: PieceLifespan.OutOnSegmentEnd,
				}
			)

			const now = 990000
			const partTimes = createPartCurrentTimes(now, now - 2000)

			const currentPartInfo = createPartInstanceInfo(partTimes, createPartInstance(), [
				piece001,
				infinite1,
				infinite2,
			])

			const simpleResolvedPieces = getResolvedPiecesForPartInstancesOnTimeline(
				context,
				{ current: currentPartInfo },
				now
			)
			expect(stripResult(simpleResolvedPieces)).toEqual([
				{
					_id: infinite1._id,
					resolvedStart: partTimes.partStartTime! + 1000,
					resolvedDuration: 4000,
				},
				{
					_id: piece001._id,
					resolvedStart: partTimes.partStartTime! + 3000,
					resolvedDuration: 2000,
				},
				{
					_id: infinite2._id,
					resolvedStart: partTimes.partStartTime! + 5000,
					resolvedDuration: undefined,
				},
			] satisfies StrippedResult)
		})

		test('userDuration.endRelativeToPart', async () => {
			const sourceLayerId = Object.keys(sourceLayers)[0]
			expect(sourceLayerId).toBeTruthy()

			const piece001 = createPieceInstance(
				sourceLayerId,
				{ start: 3000 },
				{},
				{
					userDuration: {
						endRelativeToPart: 4200,
					},
				}
			)

			const now = 990000
			const partTimes = createPartCurrentTimes(now, now - 2000)

			const currentPartInfo = createPartInstanceInfo(partTimes, createPartInstance(), [piece001])

			const simpleResolvedPieces = getResolvedPiecesForPartInstancesOnTimeline(
				context,
				{ current: currentPartInfo },
				now
			)
			expect(stripResult(simpleResolvedPieces)).toEqual([
				{
					_id: piece001._id,
					resolvedStart: partTimes.partStartTime! + 3000,
					resolvedDuration: 1200,
				},
			] satisfies StrippedResult)
		})

		test('basic previousPart', async () => {
			const sourceLayerId = Object.keys(sourceLayers)[0]
			expect(sourceLayerId).toBeTruthy()

			const piece001 = createPieceInstance(sourceLayerId, { start: 0 })

			const piece010 = createPieceInstance(sourceLayerId, { start: 0 })

			const now = 990000
			const currentPartTimes = createPartCurrentTimes(now, now - 2000)
			const previousPartTimes = createPartCurrentTimes(now, now - 7000)

			const previousPartInfo = createPartInstanceInfo(previousPartTimes, createPartInstance(), [piece001])

			const currentPartInfo = createPartInstanceInfo(currentPartTimes, createPartInstance(), [piece010])

			const simpleResolvedPieces = getResolvedPiecesForPartInstancesOnTimeline(
				context,
				{
					current: currentPartInfo,
					previous: previousPartInfo,
				},
				now
			)
			expect(stripResult(simpleResolvedPieces)).toEqual([
				{
					_id: piece001._id,
					resolvedStart: previousPartTimes.partStartTime!,
					resolvedDuration: 5000,
				},
				{
					_id: piece010._id,
					resolvedStart: currentPartTimes.partStartTime!,
					resolvedDuration: undefined,
				},
			] satisfies StrippedResult)
		})

		test('previousPart with ending infinite', async () => {
			const sourceLayerId = Object.keys(sourceLayers)[0]
			expect(sourceLayerId).toBeTruthy()

			const piece001 = createPieceInstance(sourceLayerId, { start: 0 })

			const piece010 = createPieceInstance(sourceLayerId, { start: 0 })

			const cappedInfinitePiece = createPieceInstance(
				sourceLayerId,
				{ start: 1000 },
				{
					lifespan: PieceLifespan.OutOnSegmentEnd,
				}
			)

			const now = 990000
			const currentPartTimes = createPartCurrentTimes(now, now - 2000)
			const previousPartTimes = createPartCurrentTimes(now, now - 7000)

			const previousPartInfo = createPartInstanceInfo(previousPartTimes, createPartInstance(), [
				piece001,
				cappedInfinitePiece,
			])

			const currentPartInfo = createPartInstanceInfo(currentPartTimes, createPartInstance(), [piece010])

			const simpleResolvedPieces = getResolvedPiecesForPartInstancesOnTimeline(
				context,
				{
					current: currentPartInfo,
					previous: previousPartInfo,
				},
				now
			)
			expect(stripResult(simpleResolvedPieces)).toEqual([
				{
					_id: piece001._id,
					resolvedStart: previousPartTimes.partStartTime!,
					resolvedDuration: 1000,
				},
				{
					_id: cappedInfinitePiece._id,
					resolvedStart: previousPartTimes.partStartTime! + 1000,
					resolvedDuration: 4000,
				},
				{
					_id: piece010._id,
					resolvedStart: currentPartTimes.partStartTime!,
					resolvedDuration: undefined,
				},
			] satisfies StrippedResult)
		})

		test('previousPart with continuing infinite', async () => {
			const sourceLayerId = Object.keys(sourceLayers)[0]
			expect(sourceLayerId).toBeTruthy()

			const piece001 = createPieceInstance(sourceLayerId, { start: 0 })

			const piece010 = createPieceInstance(sourceLayerId, { start: 0 })

			const startingInfinitePiece = createPieceInstance(
				sourceLayerId,
				{ start: 1000 },
				{
					lifespan: PieceLifespan.OutOnSegmentEnd,
				}
			)

			const continuingInfinitePiece = createPieceInstance(
				sourceLayerId,
				{ start: 0 },
				{
					lifespan: PieceLifespan.OutOnSegmentEnd,
				},
				{
					userDuration: {
						endRelativeToPart: 5400,
					},
				}
			)
			continuingInfinitePiece.infinite = {
				...startingInfinitePiece.infinite!,
				fromPreviousPart: true,
				infiniteInstanceIndex: 1,
			}

			const now = 990000
			const currentPartTimes = createPartCurrentTimes(now, now - 2000)
			const previousPartTimes = createPartCurrentTimes(now, now - 7000)

			const previousPartInfo = createPartInstanceInfo(previousPartTimes, createPartInstance(), [
				piece001,
				startingInfinitePiece,
			])

			const currentPartInfo = createPartInstanceInfo(currentPartTimes, createPartInstance(), [
				piece010,
				continuingInfinitePiece,
			])

			const simpleResolvedPieces = getResolvedPiecesForPartInstancesOnTimeline(
				context,
				{
					current: currentPartInfo,
					previous: previousPartInfo,
				},
				now
			)
			expect(stripResult(simpleResolvedPieces)).toEqual([
				{
					_id: piece001._id,
					resolvedStart: previousPartTimes.partStartTime!,
					resolvedDuration: 1000,
				},
				{
					_id: continuingInfinitePiece._id,
					resolvedStart: previousPartTimes.partStartTime! + 1000,
					resolvedDuration: 9400,
				},
				{
					_id: piece010._id,
					resolvedStart: currentPartTimes.partStartTime!,
					resolvedDuration: undefined,
				},
			] satisfies StrippedResult)
		})

		test('basic nextPart', async () => {
			const sourceLayerId = Object.keys(sourceLayers)[0]
			expect(sourceLayerId).toBeTruthy()

			const piece001 = createPieceInstance(sourceLayerId, { start: 0 })

			const piece010 = createPieceInstance(sourceLayerId, { start: 0 })

			const now = 990000
			const currentPartTimes = createPartCurrentTimes(now, now - 2000)
			const currentPartLength = 13000
			const nextPartTimes = createPartCurrentTimes(now, currentPartTimes.partStartTime! + currentPartLength)

			const currentPartInfo = createPartInstanceInfo(
				currentPartTimes,
				createPartInstance({
					autoNext: true,
					expectedDuration: currentPartLength,
				}),
				[piece001]
			)

			const nextPartInfo = createPartInstanceInfo(nextPartTimes, createPartInstance(), [piece010])

			const simpleResolvedPieces = getResolvedPiecesForPartInstancesOnTimeline(
				context,
				{
					current: currentPartInfo,
					next: nextPartInfo,
				},
				now
			)
			expect(stripResult(simpleResolvedPieces)).toEqual([
				{
					_id: piece001._id,
					resolvedStart: currentPartTimes.partStartTime!,
					resolvedDuration: currentPartLength,
				},
				{
					_id: piece010._id,
					resolvedStart: nextPartTimes.partStartTime!,
					resolvedDuration: undefined,
				},
			] satisfies StrippedResult)
		})

		test('nextPart with ending infinite', async () => {
			const sourceLayerId = Object.keys(sourceLayers)[0]
			expect(sourceLayerId).toBeTruthy()

			const piece001 = createPieceInstance(sourceLayerId, { start: 0 })

			const piece010 = createPieceInstance(sourceLayerId, { start: 0 })

			const cappedInfinitePiece = createPieceInstance(
				sourceLayerId,
				{ start: 1000 },
				{
					lifespan: PieceLifespan.OutOnSegmentEnd,
				}
			)

			const now = 990000
			const currentPartTimes = createPartCurrentTimes(now, now - 2000)
			const currentPartLength = 13000
			const nextPartTimes = createPartCurrentTimes(now, currentPartTimes.partStartTime! + currentPartLength)

			const currentPartInfo = createPartInstanceInfo(
				currentPartTimes,
				createPartInstance({
					autoNext: true,
					expectedDuration: currentPartLength,
				}),
				[piece001, cappedInfinitePiece]
			)

			const nextPartInfo = createPartInstanceInfo(nextPartTimes, createPartInstance(), [piece010])

			const simpleResolvedPieces = getResolvedPiecesForPartInstancesOnTimeline(
				context,
				{
					current: currentPartInfo,
					next: nextPartInfo,
				},
				now
			)

			expect(stripResult(simpleResolvedPieces)).toEqual([
				{
					_id: piece001._id,
					resolvedStart: currentPartTimes.partStartTime!,
					resolvedDuration: 1000,
				},
				{
					_id: cappedInfinitePiece._id,
					resolvedStart: currentPartTimes.partStartTime! + 1000,
					resolvedDuration: currentPartLength - 1000,
				},
				{
					_id: piece010._id,
					resolvedStart: nextPartTimes.partStartTime!,
					resolvedDuration: undefined,
				},
			] satisfies StrippedResult)
		})

		test('nextPart with continuing infinite', async () => {
			const sourceLayerId = Object.keys(sourceLayers)[0]
			expect(sourceLayerId).toBeTruthy()

			const piece001 = createPieceInstance(sourceLayerId, { start: 0 })

			const piece010 = createPieceInstance(sourceLayerId, { start: 0 })

			const startingInfinitePiece = createPieceInstance(
				sourceLayerId,
				{ start: 1000 },
				{
					lifespan: PieceLifespan.OutOnSegmentEnd,
				}
			)
			const continuingInfinitePiece = createPieceInstance(
				sourceLayerId,
				{ start: 0 },
				{
					lifespan: PieceLifespan.OutOnSegmentEnd,
				},
				{
					userDuration: {
						endRelativeToPart: 3400,
					},
				}
			)

			continuingInfinitePiece.infinite = {
				...startingInfinitePiece.infinite!,
				fromPreviousPart: true,
				infiniteInstanceIndex: 1,
			}

			const now = 990000
			const currentPartTimes = createPartCurrentTimes(now, now - 2000)
			const currentPartLength = 13000
			const nextPartTimes = createPartCurrentTimes(now, currentPartTimes.partStartTime! + currentPartLength)

			const currentPartInfo = createPartInstanceInfo(
				currentPartTimes,
				createPartInstance({
					autoNext: true,
					expectedDuration: currentPartLength,
				}),
				[piece001, startingInfinitePiece]
			)

			const nextPartInfo = createPartInstanceInfo(nextPartTimes, createPartInstance(), [
				piece010,
				continuingInfinitePiece,
			])

			const simpleResolvedPieces = getResolvedPiecesForPartInstancesOnTimeline(
				context,
				{
					current: currentPartInfo,
					next: nextPartInfo,
				},
				now
			)

			expect(stripResult(simpleResolvedPieces)).toEqual([
				{
					_id: piece001._id,
					resolvedStart: currentPartTimes.partStartTime!,
					resolvedDuration: 1000,
				},
				{
					_id: startingInfinitePiece._id,
					resolvedStart: currentPartTimes.partStartTime! + 1000,
					resolvedDuration: currentPartLength - 1000 + 3400,
				},
				{
					_id: piece010._id,
					resolvedStart: nextPartTimes.partStartTime!,
					resolvedDuration: undefined,
				},
			] satisfies StrippedResult)
		})
	})
})
