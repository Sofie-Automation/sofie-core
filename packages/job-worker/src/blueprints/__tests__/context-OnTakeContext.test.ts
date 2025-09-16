/* eslint-disable @typescript-eslint/unbound-method */
import { IBlueprintMutatablePart, IBlueprintPiece } from '@sofie-automation/blueprints-integration'
import { WatchedPackagesHelper } from '../context/watchedPackages.js'
import { JobContext, ProcessedShowStyleCompound } from '../../jobs/index.js'
import { mock } from 'jest-mock-extended'
import { PartAndPieceInstanceActionService } from '../context/services/PartAndPieceInstanceActionService.js'
import { OnTakeContext } from '../context/index.js'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { PlayoutModelImpl } from '../../playout/model/implementation/PlayoutModelImpl.js'

describe('Test blueprint api context', () => {
	async function getTestee() {
		const mockPlayoutModel = mock<PlayoutModelImpl>()
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
					{ _id: 'part1', title: 'Part 1', invalid: false, floated: false } as unknown as DBPart,
					{ _id: 'part2', title: 'Part 2', invalid: false, floated: false } as unknown as DBPart,
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
			expect(mockActionService.updatePartInstance).toHaveBeenCalledWith('next', { title: 'My Part' })
		})
	})
})
