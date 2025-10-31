import { IBlueprintPieceType, PieceLifespan, PlaylistTimingType } from '@sofie-automation/blueprints-integration'
import { DBPartInstance } from '../../dataModel/PartInstance.js'
import { PartId, PartInstanceId, RundownId, RundownPlaylistId } from '../../dataModel/Ids.js'
import { DBPart } from '../../dataModel/Part.js'
import { EmptyPieceTimelineObjectsBlob, Piece } from '../../dataModel/Piece.js'
import { PieceInstance, PieceInstancePiece } from '../../dataModel/PieceInstance.js'
import { Rundown, DBRundown } from '../../dataModel/Rundown.js'
import { literal } from '../../lib.js'
import { protectString } from '../../protectedString.js'
import { getPlayheadTrackingInfinitesForPart } from '../infinites.js'
import { DBSegment, SegmentOrphanedReason } from '../../dataModel/Segment.js'

describe('Infinites', () => {
	describe('getPlayheadTrackingInfinitesForPart', () => {
		function runAndTidyResult(
			previousPartInstance: Pick<DBPartInstance, 'rundownId' | 'segmentId'> & { partId: PartId },
			previousSegment: Pick<DBSegment, '_id' | 'orphaned'>,
			previousPartPieces: PieceInstance[],
			rundown: Rundown,
			segment: Pick<DBSegment, '_id' | 'orphaned'>,
			part: Pick<DBPart, 'rundownId' | 'segmentId'>,
			newInstanceId: PartInstanceId
		) {
			const resolvedInstances = getPlayheadTrackingInfinitesForPart(
				protectString('activation0'),
				new Set([previousPartInstance.partId]),
				new Set(),
				[],
				new Map(),
				previousPartInstance as any,
				previousSegment,
				previousPartPieces,
				rundown,
				part as any,
				segment,
				newInstanceId,
				true,
				false,
				false
			)
			return resolvedInstances.map((p) => ({
				_id: p._id,
				start: p.piece.enable.start,
			}))
		}

		function createPieceInstanceAsInfinite(
			id: string,
			rundownId: RundownId,
			partId: PartId,
			enable: Piece['enable'],
			sourceLayerId: string,
			lifespan: PieceLifespan,
			clear?: boolean
		): PieceInstance {
			return literal<PieceInstance>({
				_id: protectString(id),
				rundownId: rundownId,
				partInstanceId: protectString(''),
				playlistActivationId: protectString('active'),
				piece: literal<PieceInstancePiece>({
					_id: protectString(`${id}_p`),
					externalId: '',
					startPartId: partId,
					enable: enable,
					name: '',
					lifespan: lifespan,
					sourceLayerId: sourceLayerId,
					outputLayerId: '',
					invalid: false,
					virtual: clear,
					content: {},
					timelineObjectsString: EmptyPieceTimelineObjectsBlob,
					pieceType: IBlueprintPieceType.Normal,
				}),
				dynamicallyInserted: clear ? Date.now() : undefined,
				infinite: {
					infiniteInstanceId: protectString(`${id}_inf`),
					infiniteInstanceIndex: 0,
					infinitePieceId: protectString(`${id}_p`),
					fromPreviousPart: false,
				},
			})
		}

		function createRundown(
			id: RundownId,
			playlistId: RundownPlaylistId,
			name: string,
			externalId: string
		): Rundown {
			return literal<DBRundown>({
				_id: id,
				externalId,
				name,
				showStyleVariantId: protectString('test-variant'),
				showStyleBaseId: protectString('test-base'),
				studioId: protectString('studio0'),
				created: 0,
				modified: 0,
				importVersions: {
					studio: '0.0.0',
					showStyleBase: '0.0.0',
					showStyleVariant: '0.0.0',
					blueprint: '0.0.0',
					core: '0.0.0`',
				},
				playlistId,
				timing: {
					type: PlaylistTimingType.None,
				},
				source: {
					type: 'http',
				},
			})
		}

		test('multiple continued pieces starting at 0 should preserve the newest', () => {
			const playlistId = protectString('playlist0')
			const rundownId = protectString('rundown0')
			const segmentId = protectString('segment0')
			const partId = protectString('part0')
			const previousPartInstance = { rundownId, segmentId, partId }
			const previousSegment = { _id: previousPartInstance.segmentId }
			const previousPartPieces: PieceInstance[] = [
				createPieceInstanceAsInfinite(
					'one',
					rundownId,
					partId,
					{ start: 0 },
					'one',
					PieceLifespan.OutOnRundownEnd
				),
				createPieceInstanceAsInfinite(
					'two',
					rundownId,
					partId,
					{ start: 0 },
					'one',
					PieceLifespan.OutOnRundownEnd,
					true
				),
				{
					...createPieceInstanceAsInfinite(
						'three',
						rundownId,
						partId,
						{ start: 0 },
						'one',
						PieceLifespan.OutOnRundownChange
					),
					dynamicallyInserted: Date.now() + 5000,
				},
			]
			const segment = { _id: segmentId }
			const part = { rundownId, segmentId }
			const instanceId = protectString('newInstance0')
			const rundown = createRundown(rundownId, playlistId, 'Test Rundown', 'rundown0')

			const continuedInstances = runAndTidyResult(
				previousPartInstance,
				previousSegment,
				previousPartPieces,
				rundown,
				segment,
				part,
				instanceId
			)
			expect(continuedInstances).toEqual([
				{
					_id: 'newInstance0_three_p_continue',
					start: 0,
				},
				{
					_id: 'newInstance0_two_p_continue',
					start: 0,
				},
			])
		})
		test('ignore pieces that have stopped', () => {
			const playlistId = protectString('playlist0')
			const rundownId = protectString('rundown0')
			const segmentId = protectString('segment0')
			const partId = protectString('part0')
			const previousPartInstance = { rundownId, segmentId, partId }
			const previousSegment = { _id: previousPartInstance.segmentId }
			const previousPartPieces: PieceInstance[] = [
				createPieceInstanceAsInfinite(
					'one',
					rundownId,
					partId,
					{ start: 1000 },
					'one',
					PieceLifespan.OutOnRundownChange
				),
				{
					...createPieceInstanceAsInfinite(
						'two',
						rundownId,
						partId,
						{ start: 2000 },
						'two',
						PieceLifespan.OutOnRundownChange,
						true
					),
					userDuration: { endRelativeToPart: 5000 },
				},
				{
					...createPieceInstanceAsInfinite(
						'three',
						rundownId,
						partId,
						{ start: 3000 },
						'three',
						PieceLifespan.OutOnRundownChange
					),
					plannedStoppedPlayback: 5000,
				},
			]
			const segment = { _id: segmentId }
			const part = { rundownId, segmentId }
			const instanceId = protectString('newInstance0')
			const rundown = createRundown(rundownId, playlistId, 'Test Rundown', 'rundown0')

			const continuedInstances = runAndTidyResult(
				previousPartInstance,
				previousSegment,
				previousPartPieces,
				rundown,
				segment,
				part,
				instanceId
			)
			expect(continuedInstances).toEqual([
				{
					_id: 'newInstance0_one_p_continue',
					start: 0,
				},
			])
		})

		describe('AdlibTesting', () => {
			const playlistId = protectString('playlist0')
			const rundownId = protectString('rundown0')
			const segmentId = protectString('segment0')
			const partId = protectString('part0')
			const previousPartInstance = { rundownId, segmentId, partId }
			const previousPartPieces: PieceInstance[] = [
				createPieceInstanceAsInfinite(
					'one',
					rundownId,
					partId,
					{ start: 0 },
					'one',
					PieceLifespan.OutOnRundownEnd,
					true
				),
			]
			const part = { rundownId, segmentId }
			const instanceId = protectString('newInstance0')
			const rundown = createRundown(rundownId, playlistId, 'Test Rundown', 'rundown0')

			test('normal rundown', () => {
				const continuedInstances = runAndTidyResult(
					previousPartInstance,
					{ _id: previousPartInstance.segmentId },
					previousPartPieces,
					rundown,
					{ _id: previousPartInstance.segmentId },
					part,
					instanceId
				)
				expect(continuedInstances).toHaveLength(1)
			})

			test('into AdlibTesting segment', () => {
				const previousSegment: Pick<DBSegment, '_id' | 'orphaned'> = { _id: previousPartInstance.segmentId }
				const adlibTestingSegment: Pick<DBSegment, '_id' | 'orphaned'> = {
					_id: protectString('segment1'),
					orphaned: SegmentOrphanedReason.ADLIB_TESTING,
				}
				const continuedInstances = runAndTidyResult(
					previousPartInstance,
					previousSegment,
					previousPartPieces,
					rundown,
					adlibTestingSegment,
					part,
					instanceId
				)
				expect(continuedInstances).toHaveLength(0)
			})

			test('out of AdlibTesting', () => {
				const segment: Pick<DBSegment, '_id' | 'orphaned'> = { _id: protectString('segment1') }
				const adlibTestingSegment: Pick<DBSegment, '_id' | 'orphaned'> = {
					_id: previousPartInstance.segmentId,
					orphaned: SegmentOrphanedReason.ADLIB_TESTING,
				}
				const continuedInstances = runAndTidyResult(
					previousPartInstance,
					adlibTestingSegment,
					previousPartPieces,
					rundown,
					segment,
					part,
					instanceId
				)
				expect(continuedInstances).toHaveLength(0)
			})

			test('within AdlibTesting', () => {
				const segment: Pick<DBSegment, '_id' | 'orphaned'> = { _id: previousPartInstance.segmentId }
				const adlibTestingSegment: Pick<DBSegment, '_id' | 'orphaned'> = {
					_id: previousPartInstance.segmentId,
					orphaned: SegmentOrphanedReason.ADLIB_TESTING,
				}
				const continuedInstances = runAndTidyResult(
					previousPartInstance,
					adlibTestingSegment,
					previousPartPieces,
					rundown,
					segment,
					part,
					instanceId
				)
				expect(continuedInstances).toHaveLength(1)
			})
		})
	})
})
