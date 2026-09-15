import { IBlueprintPieceType, PieceLifespan, PlaylistTimingType } from '@sofie-automation/blueprints-integration'
import { DBPartInstance } from '../../dataModel/PartInstance.js'
import { PartId, PartInstanceId, RundownId, RundownPlaylistId } from '../../dataModel/Ids.js'
import { DBPart } from '../../dataModel/Part.js'
import { EmptyPieceTimelineObjectsBlob, Piece } from '../../dataModel/Piece.js'
import { PieceInstance, PieceInstancePiece } from '../../dataModel/PieceInstance.js'
import { Rundown, DBRundown } from '../../dataModel/Rundown.js'
import { literal } from '../../lib.js'
import { protectString } from '../../protectedString.js'
import { getPieceInstancesForPart, getPlayheadTrackingInfinitesForPart } from '../infinites.js'
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
		test('piece dynamically converted to infinite should be continued', () => {
			const playlistId = protectString('playlist0')
			const rundownId = protectString('rundown0')
			const segmentId = protectString('segment0')
			const partId = protectString('part0')
			const previousPartInstance = { rundownId, segmentId, partId }
			const previousSegment = { _id: previousPartInstance.segmentId }
			const previousPartPieces: PieceInstance[] = [
				{
					...createPieceInstanceAsInfinite(
						'one',
						rundownId,
						partId,
						{ start: 0 },
						'one',
						PieceLifespan.OutOnRundownEnd
					),
					dynamicallyConvertedToInfinite: Date.now(),
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

		describe('selecting which piece on a layer continues', () => {
			const playlistId = protectString('playlist0')
			const rundownId: RundownId = protectString('rundown0')
			const segmentId = protectString('segment0')
			const partId: PartId = protectString('part0')

			/** Run with all the Pieces on one source layer, and return the ids of those which continued */
			function getContinuedIds(previousPartPieces: PieceInstance[], brandingId?: string): string[] {
				const continuedInstances = runAndTidyResult(
					{ rundownId, segmentId, partId, brandingId: brandingId ?? null } as any,
					{ _id: segmentId },
					previousPartPieces,
					createRundown(rundownId, playlistId, 'Test Rundown', 'rundown0'),
					{ _id: segmentId },
					{ rundownId, segmentId },
					protectString('newInstance0')
				)

				return continuedInstances.map((p) => String(p._id)).sort()
			}

			function createOnChangePiece(id: string, enable: Piece['enable']): PieceInstance {
				return createPieceInstanceAsInfinite(
					id,
					rundownId,
					partId,
					enable,
					'one',
					PieceLifespan.OutOnRundownChange
				)
			}

			function createAdlibbedOnEndPiece(id: string, enable: Piece['enable']): PieceInstance {
				return {
					...createPieceInstanceAsInfinite(
						id,
						rundownId,
						partId,
						enable,
						'one',
						PieceLifespan.OutOnRundownEnd
					),
					dynamicallyConvertedToInfinite: Date.now(),
				}
			}

			test('the onChange piece starting last is the one continued', () => {
				expect(
					getContinuedIds([
						createOnChangePiece('early', { start: 1000 }),
						createOnChangePiece('late', { start: 2000 }),
					])
				).toEqual(['newInstance0_late_p_continue'])
			})

			test('the onChange piece starting last is chosen regardless of the order they are considered in', () => {
				expect(
					getContinuedIds([
						createOnChangePiece('late', { start: 2000 }),
						createOnChangePiece('early', { start: 1000 }),
					])
				).toEqual(['newInstance0_late_p_continue'])
			})

			test("an onChange piece starting 'now' starts later than any planned start", () => {
				expect(
					getContinuedIds([
						createOnChangePiece('planned', { start: 2000 }),
						createOnChangePiece('now', { start: 'now' }),
					])
				).toEqual(['newInstance0_now_p_continue'])
			})

			test('the adlibbed onEnd piece starting last is the one continued', () => {
				expect(
					getContinuedIds([
						createAdlibbedOnEndPiece('early', { start: 1000 }),
						createAdlibbedOnEndPiece('late', { start: 2000 }),
					])
				).toEqual(['newInstance0_late_p_continue'])
			})

			test("an adlibbed onEnd piece starting 'now' starts later than any planned start", () => {
				expect(
					getContinuedIds([
						createAdlibbedOnEndPiece('planned', { start: 2000 }),
						createAdlibbedOnEndPiece('now', { start: 'now' }),
					])
				).toEqual(['newInstance0_now_p_continue'])
			})

			test('a piece hidden by the Branding is not continued, as it is not playing', () => {
				const hidden = createOnChangePiece('hidden', { start: 2000 })
				hidden.piece.onlyValidForBranding = ['brandingB']

				// Without the Branding it would have beaten the other, as it starts later
				expect(getContinuedIds([createOnChangePiece('shown', { start: 1000 }), hidden], 'brandingA')).toEqual([
					'newInstance0_shown_p_continue',
				])
			})

			test('a piece used with the selected Branding is continued', () => {
				const limited = createOnChangePiece('limited', { start: 1000 })
				limited.piece.onlyValidForBranding = ['brandingA']

				expect(getContinuedIds([limited], 'brandingA')).toEqual(['newInstance0_limited_p_continue'])
			})

			test('a piece limited to a Branding is not discarded by one which beats it', () => {
				const limited = createOnChangePiece('limited', { start: 1000 })
				limited.piece.onlyValidForBranding = ['brandingA']

				expect(getContinuedIds([limited, createOnChangePiece('later', { start: 2000 })], 'brandingA')).toEqual([
					'newInstance0_later_p_continue',
					'newInstance0_limited_p_continue',
				])
			})
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

describe('getPieceInstancesForPart branding', () => {
	const rundownId: RundownId = protectString('rundown0')
	const segmentId = protectString('segment0')
	const partIds: PartId[] = [protectString('part0'), protectString('part1'), protectString('part2')]

	function createInfinitePiece(
		id: string,
		startPartId: PartId,
		sourceLayerId: string,
		onlyValidForBranding?: string[],
		branding?: Piece['branding']
	): Piece {
		return literal<Piece>({
			_id: protectString(id),
			externalId: '',
			startPartId,
			startSegmentId: segmentId,
			startRundownId: rundownId,
			enable: { start: 0 },
			name: id,
			lifespan: PieceLifespan.OutOnSegmentEnd,
			sourceLayerId,
			outputLayerId: '',
			invalid: false,
			content: {},
			timelineObjectsString: EmptyPieceTimelineObjectsBlob,
			pieceType: IBlueprintPieceType.Normal,
			onlyValidForBranding,
			branding,
		})
	}

	/** The ids of the Pieces which got a PieceInstance for the last Part in the Segment */
	function getKeptPieceIds(possiblePieces: Piece[]): string[] {
		const instances = getPieceInstancesForPart(
			protectString('activation0'),
			undefined,
			undefined,
			undefined,
			{ _id: rundownId, showStyleBaseId: protectString('showStyleBase0') },
			{ _id: segmentId },
			{ _id: partIds[2], rundownId, segmentId } as any,
			new Set([partIds[0], partIds[1]]),
			new Set(),
			[],
			new Map(),
			possiblePieces,
			partIds,
			protectString('newInstance0'),
			false,
			true,
			false
		)

		return instances.map((p) => String(p.piece._id)).sort()
	}

	test('without Branding, only the last starting infinite on a layer is kept', () => {
		expect(
			getKeptPieceIds([
				createInfinitePiece('early', partIds[0], 'layer0'),
				createInfinitePiece('late', partIds[1], 'layer0'),
			])
		).toEqual(['late'])
	})

	test('an infinite limited to a Branding does not discard the one it beats', () => {
		expect(
			getKeptPieceIds([
				createInfinitePiece('early', partIds[0], 'layer0'),
				createInfinitePiece('late', partIds[1], 'layer0', ['brandingA']),
			])
		).toEqual(['early', 'late'])
	})

	test('infinites limited to different Brandings are all kept', () => {
		expect(
			getKeptPieceIds([
				createInfinitePiece('early', partIds[0], 'layer0', ['brandingB']),
				createInfinitePiece('late', partIds[1], 'layer0', ['brandingA']),
			])
		).toEqual(['early', 'late'])
	})

	test('an infinite limited to a Branding is kept even when an unlimited one beats it', () => {
		expect(
			getKeptPieceIds([
				createInfinitePiece('early', partIds[0], 'layer0', ['brandingA']),
				createInfinitePiece('late', partIds[1], 'layer0'),
			])
		).toEqual(['early', 'late'])
	})

	test('an unlimited infinite is kept when everything beating it is limited', () => {
		expect(
			getKeptPieceIds([
				createInfinitePiece('early', partIds[0], 'layer0'),
				createInfinitePiece('late', partIds[1], 'layer0', ['brandingA']),
				createInfinitePiece('latest', partIds[1], 'layer0', ['brandingB']),
			])
		).toEqual(['early', 'late', 'latest'])
	})

	test('an override does not affect the selection, as it cannot move the Piece between layers', () => {
		expect(
			getKeptPieceIds([
				createInfinitePiece('early', partIds[0], 'layer0'),
				createInfinitePiece('late', partIds[1], 'layer0', undefined, {
					brandingA: { name: 'branded-name' },
				}),
			])
		).toEqual(['late'])
	})

	test('infinites on separate layers never compete', () => {
		expect(
			getKeptPieceIds([
				createInfinitePiece('early', partIds[0], 'layer0'),
				createInfinitePiece('late', partIds[1], 'layer1'),
			])
		).toEqual(['early', 'late'])
	})
})
