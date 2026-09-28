import { expect } from 'vitest'
import { PartInstanceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { PieceInstance, PieceInstancePiece } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { ReadonlyDeep } from 'type-fest'
import { PartInstanceAndPieceInstances, PartAndPieces } from '../util.js'
import { findForLayerTestConstants } from './findForLayer/constants.js'
import { context, TfindLookaheadObjectsForPart } from './findForLayer/helpers/mockSetup.js'
import { TimelinePlayoutState } from '../../timeline/lib.js'

export function expectInstancesToMatch(
	findLookaheadObjectsForPartMock: TfindLookaheadObjectsForPart,
	index: number,
	layer: string,
	partInstanceInfo: PartInstanceAndPieceInstances,
	previousPart: PartInstanceAndPieceInstances | undefined,
	playoutState: TimelinePlayoutState
): void {
	expect(findLookaheadObjectsForPartMock).toHaveBeenNthCalledWith(
		index,
		context,
		findForLayerTestConstants.current.part._id,
		layer,
		previousPart?.part.part,
		{
			part: partInstanceInfo.part.part,
			usesInTransition: false,
			pieces: partInstanceInfo.allPieces,
		},
		partInstanceInfo?.part._id,
		playoutState
	)
}

export function createFakePiece(id: string, pieceProps?: Partial<PieceInstancePiece>): PieceInstance {
	return {
		_id: id,
		piece: {
			...(pieceProps ?? {}),
			enable: {
				start: 0,
				...(pieceProps ? pieceProps.enable : {}),
			},
		},
	} as any
}

export function expectPartToMatch(
	findLookaheadObjectsForPartMock: TfindLookaheadObjectsForPart,
	index: number,
	layer: string,
	partInfo: PartAndPieces,
	previousPart: ReadonlyDeep<DBPart> | undefined,
	currentPartInstanceId: PartInstanceId | null = null,
	playoutState: TimelinePlayoutState,
	nextTimeOffset?: number
): void {
	if (nextTimeOffset)
		expect(findLookaheadObjectsForPartMock).toHaveBeenNthCalledWith(
			index,
			context,
			currentPartInstanceId,
			layer,
			previousPart,
			partInfo,
			null,
			playoutState,
			nextTimeOffset
		)
	else
		expect(findLookaheadObjectsForPartMock).toHaveBeenNthCalledWith(
			index,
			context,
			currentPartInstanceId,
			layer,
			previousPart,
			partInfo,
			null,
			playoutState
		)
}
