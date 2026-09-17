/* eslint-disable @typescript-eslint/unbound-method */
import { IBlueprintMutatablePart, IBlueprintPart, IBlueprintPiece } from '@sofie-automation/blueprints-integration'
import { WatchedPackagesHelper } from '../context/watchedPackages.js'
import { JobContext, ProcessedShowStyleCompound } from '../../jobs/index.js'
import { mock } from 'jest-mock-extended'
import { PartAndPieceInstanceActionService } from '../context/services/PartAndPieceInstanceActionService.js'
import { OnTakeContext } from '../context/index.js'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { PartId, RundownId, SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { PlayoutModelImpl } from '../../playout/model/implementation/PlayoutModelImpl.js'
import type { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist/RundownPlaylist'

describe('Test blueprint api context', () => {
	async function getTestee(rehearsal?: boolean, partInstances?: { current?: object | null; next?: object | null }) {
		const mockPlayoutModel = mock<PlayoutModelImpl>()
		Object.defineProperty(mockPlayoutModel, 'playlist', {
			get: () =>
				({
					rehearsal,
					tTimers: [
						{ index: 1, label: 'Timer 1', mode: null, state: null },
						{ index: 2, label: 'Timer 2', mode: null, state: null },
						{ index: 3, label: 'Timer 3', mode: null, state: null },
					],
				}) satisfies Partial<DBRundownPlaylist>,
		})
		Object.defineProperty(mockPlayoutModel, 'currentPartInstance', {
			get: () => partInstances?.current ?? null,
		})
		Object.defineProperty(mockPlayoutModel, 'nextPartInstance', {
			get: () => partInstances?.next ?? null,
		})
		const mockActionService = mock<PartAndPieceInstanceActionService>()
		const context = new OnTakeContext(
			{
				name: 'fakeContext',
				identifier: 'action',
			},
			mock<JobContext>(),
			mockPlayoutModel,
			mock<ProcessedShowStyleCompound>(),
			mock<WatchedPackagesHelper>(),
			mockActionService
		)

		return {
			context,
			mockActionService,
			mockPlayoutModel,
		}
	}

	describe('ActionExecutionContext', () => {
		test('getPartInstance', async () => {
			const { context, mockActionService } = await getTestee()

			await context.getPartInstance('current')
			expect(mockActionService.getPartInstance).toHaveBeenCalledTimes(1)
			expect(mockActionService.getPartInstance).toHaveBeenCalledWith('current')
		})

		test('getPieceInstances', async () => {
			const { context, mockActionService } = await getTestee()

			await context.getPieceInstances('current')
			expect(mockActionService.getPieceInstances).toHaveBeenCalledTimes(1)
			expect(mockActionService.getPieceInstances).toHaveBeenCalledWith('current')
		})

		test('getResolvedPieceInstances', async () => {
			const { context, mockActionService } = await getTestee()

			await context.getResolvedPieceInstances('current')
			expect(mockActionService.getResolvedPieceInstances).toHaveBeenCalledTimes(1)
			expect(mockActionService.getResolvedPieceInstances).toHaveBeenCalledWith('current')
		})

		test('getSegment', async () => {
			const { context, mockActionService } = await getTestee()

			await context.getSegment('current')
			expect(mockActionService.getSegment).toHaveBeenCalledTimes(1)
			expect(mockActionService.getSegment).toHaveBeenCalledWith('current')
		})

		test('findLastPieceOnLayer', async () => {
			const { context, mockActionService } = await getTestee()

			await context.findLastPieceOnLayer('myLayer', { piecePrivateDataFilter: { someField: 1 } })
			expect(mockActionService.findLastPieceOnLayer).toHaveBeenCalledTimes(1)
			expect(mockActionService.findLastPieceOnLayer).toHaveBeenCalledWith('myLayer', {
				piecePrivateDataFilter: { someField: 1 },
			})
		})

		test('findLastScriptedPieceOnLayer', async () => {
			const { context, mockActionService } = await getTestee()

			await context.findLastScriptedPieceOnLayer('myLayer', { piecePrivateDataFilter: { someField: 1 } })
			expect(mockActionService.findLastScriptedPieceOnLayer).toHaveBeenCalledTimes(1)
			expect(mockActionService.findLastScriptedPieceOnLayer).toHaveBeenCalledWith('myLayer', {
				piecePrivateDataFilter: { someField: 1 },
			})
		})

		test('getPartInstanceForPreviousPiece', async () => {
			const { context, mockActionService } = await getTestee()

			await context.findLastPieceOnLayer('myLayer', { piecePrivateDataFilter: { someField: 1 } })
			expect(mockActionService.findLastPieceOnLayer).toHaveBeenCalledTimes(1)
			expect(mockActionService.findLastPieceOnLayer).toHaveBeenCalledWith('myLayer', {
				piecePrivateDataFilter: { someField: 1 },
			})
		})

		test('getPartForPreviousPiece', async () => {
			const { context, mockActionService } = await getTestee()

			await context.getPartForPreviousPiece({ _id: 'pieceId' })
			expect(mockActionService.getPartForPreviousPiece).toHaveBeenCalledTimes(1)
			expect(mockActionService.getPartForPreviousPiece).toHaveBeenCalledWith({ _id: 'pieceId' })
		})

		test('getUpcomingParts', async () => {
			const { context, mockPlayoutModel } = await getTestee()

			mockPlayoutModel.getAllOrderedParts.mockReturnValue(
				mock([
					{
						_id: protectString<PartId>('part1'),
						title: 'Part 1',
						invalid: false,
						floated: false,
						_rank: 1,
						rundownId: protectString<RundownId>('rundown1'),
						externalId: 'ext1',
						segmentId: protectString<SegmentId>('seg1'),
						expectedDurationWithTransition: 1000,
						userEditOperations: [],
					} as DBPart,
					{
						_id: protectString<PartId>('part2'),
						title: 'Part 2',
						invalid: false,
						floated: false,
						_rank: 1,
						rundownId: protectString<RundownId>('rundown1'),
						externalId: 'ext1',
						segmentId: protectString<SegmentId>('seg1'),
						expectedDurationWithTransition: 1000,
						userEditOperations: [],
					} as unknown as DBPart,
				])
			)

			const parts = await context.getUpcomingParts()
			expect(parts.map((i) => i.title)).toEqual(['Part 1', 'Part 2'])
		})

		test('insertPiece', async () => {
			const { context, mockActionService } = await getTestee()

			await context.insertPiece('next', { name: 'My Piece' } as IBlueprintPiece<unknown>)
			expect(mockActionService.insertPiece).toHaveBeenCalledTimes(1)
			expect(mockActionService.insertPiece).toHaveBeenCalledWith('next', { name: 'My Piece' })
		})

		test('updatePieceInstance', async () => {
			const { context, mockActionService } = await getTestee()

			await context.updatePieceInstance('pieceId', { name: 'My Piece' } as IBlueprintPiece<unknown>)
			expect(mockActionService.updatePieceInstance).toHaveBeenCalledTimes(1)
			expect(mockActionService.updatePieceInstance).toHaveBeenCalledWith('pieceId', { name: 'My Piece' })
		})

		test('stopPiecesOnLayers', async () => {
			const { context, mockActionService } = await getTestee()

			await context.stopPiecesOnLayers(['myLayer'], 1000)
			expect(mockActionService.stopPiecesOnLayers).toHaveBeenCalledTimes(1)
			expect(mockActionService.stopPiecesOnLayers).toHaveBeenCalledWith(['myLayer'], 1000)
		})

		test('stopPieceInstances', async () => {
			const { context, mockActionService } = await getTestee()

			await context.stopPieceInstances(['pieceInstanceId'], 1000)
			expect(mockActionService.stopPieceInstances).toHaveBeenCalledTimes(1)
			expect(mockActionService.stopPieceInstances).toHaveBeenCalledWith(['pieceInstanceId'], 1000)
		})

		test('removePieceInstances', async () => {
			const { context, mockActionService } = await getTestee()

			await context.removePieceInstances('next', ['pieceInstanceId'])
			expect(mockActionService.removePieceInstances).toHaveBeenCalledTimes(1)
			expect(mockActionService.removePieceInstances).toHaveBeenCalledWith('next', ['pieceInstanceId'])

			await context.removePieceInstances('current', ['pieceInstanceId'])
			expect(mockActionService.removePieceInstances).toHaveBeenCalledTimes(2)
			expect(mockActionService.removePieceInstances).toHaveBeenCalledWith('current', ['pieceInstanceId'])
		})

		test('updatePartInstance', async () => {
			const { context, mockActionService } = await getTestee()

			await context.updatePartInstance('next', { title: 'My Part' } as Partial<IBlueprintMutatablePart<unknown>>)
			expect(mockActionService.updatePartInstance).toHaveBeenCalledTimes(1)
			expect(mockActionService.updatePartInstance).toHaveBeenCalledWith('next', { title: 'My Part' }, {})
		})

		test('updatePartInstance with instanceProps', async () => {
			const { context, mockActionService } = await getTestee()

			await context.updatePartInstance(
				'next',
				{ title: 'My Part' } as Partial<IBlueprintMutatablePart<unknown>>,
				{ invalidReason: { key: 'test' } }
			)
			expect(mockActionService.updatePartInstance).toHaveBeenCalledTimes(1)
			expect(mockActionService.updatePartInstance).toHaveBeenCalledWith(
				'next',
				{ title: 'My Part' },
				{
					invalidReason: { key: 'test' },
				}
			)
		})

		test('isRehearsal when true', async () => {
			const { context } = await getTestee(true)

			expect(context.isRehearsal).toBe(true)
		})

		test('isRehearsal when false', async () => {
			const { context } = await getTestee(false)

			expect(context.isRehearsal).toBe(false)
		})

		test('isRehearsal when undefined', async () => {
			const { context } = await getTestee()

			expect(context.isRehearsal).toBe(false)
		})

		test('queuePartAfterTake uses next partInstance when target is omitted', async () => {
			const currentPartInstance = { id: 'current' }
			const nextPartInstance = { id: 'next' }
			const { context, mockActionService } = await getTestee(undefined, {
				current: currentPartInstance,
				next: nextPartInstance,
			})

			const queued = { part: {}, pieces: [] }
			mockActionService.prepareQueueablePartAndPieces.mockReturnValue(queued as any)

			const rawPart = { title: 'Queued' } as IBlueprintPart
			const rawPieces = [{ name: 'Piece' }] as IBlueprintPiece[]
			context.queuePartAfterTake(rawPart, rawPieces)

			expect(mockActionService.prepareQueueablePartAndPieces).toHaveBeenCalledTimes(1)
			expect(mockActionService.prepareQueueablePartAndPieces).toHaveBeenCalledWith(
				rawPart,
				rawPieces,
				nextPartInstance,
				undefined
			)
			expect(context.partToQueueAfterTake).toBe(queued)
		})

		test('queuePartAfterTake uses current partInstance when target is provided', async () => {
			const currentPartInstance = { id: 'current' }
			const nextPartInstance = { id: 'next' }
			const { context, mockActionService } = await getTestee(undefined, {
				current: currentPartInstance,
				next: nextPartInstance,
			})

			const queued = { part: {}, pieces: [] }
			mockActionService.prepareQueueablePartAndPieces.mockReturnValue(queued as any)

			const rawPart = { title: 'Queued' } as IBlueprintPart
			const rawPieces = [{ name: 'Piece' }] as IBlueprintPiece[]
			const target = { targetPartId: 'part1' }
			context.queuePartAfterTake(rawPart, rawPieces, target)

			expect(mockActionService.prepareQueueablePartAndPieces).toHaveBeenCalledTimes(1)
			expect(mockActionService.prepareQueueablePartAndPieces).toHaveBeenCalledWith(
				rawPart,
				rawPieces,
				currentPartInstance,
				target
			)
			expect(context.partToQueueAfterTake).toBe(queued)
		})

		test('queuePartAfterTake throws when no current partInstance', async () => {
			const { context } = await getTestee()

			expect(() => context.queuePartAfterTake({ title: 'Queued' } as IBlueprintPart, [])).toThrow(
				'Cannot queue part when no current partInstance'
			)
		})

		test('queuePartAfterTake throws when target is omitted and no next partInstance', async () => {
			const { context } = await getTestee(undefined, { current: { id: 'current' } })

			expect(() => context.queuePartAfterTake({ title: 'Queued' } as IBlueprintPart, [])).toThrow(
				'Cannot queue part after take when no next partInstance'
			)
		})
	})
})
