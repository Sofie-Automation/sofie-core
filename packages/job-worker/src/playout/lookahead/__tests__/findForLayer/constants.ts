import { getRandomString } from '@sofie-automation/corelib/dist/lib'
import { PartInstanceAndPieceInstances, PartAndPieces } from '../../util.js'
import { createFakePiece } from '../utils.js'

const layer: string = getRandomString()

export const findForLayerTestConstants = {
	previous: {
		part: { _id: 'pPrev', part: 'prev' },
		allPieces: [createFakePiece('1'), createFakePiece('2'), createFakePiece('3')],
		onTimeline: true,
		nowInPart: 2000,
	} as any as PartInstanceAndPieceInstances,
	current: {
		part: { _id: 'pCur', part: 'cur' },
		allPieces: [createFakePiece('4'), createFakePiece('5'), createFakePiece('6')],
		onTimeline: true,
		nowInPart: 1000,
	} as any as PartInstanceAndPieceInstances,
	nextTimed: {
		part: { _id: 'pNextTimed', part: 'nextT' },
		allPieces: [createFakePiece('7'), createFakePiece('8'), createFakePiece('9')],
		onTimeline: true,
	} as any as PartInstanceAndPieceInstances,
	nextFuture: {
		part: { _id: 'pNextFuture', part: 'nextF' },
		allPieces: [createFakePiece('10'), createFakePiece('11'), createFakePiece('12')],
		onTimeline: false,
	} as any as PartInstanceAndPieceInstances,

	orderedParts: [{ _id: 'p1' }, { _id: 'p2', invalid: true }, { _id: 'p3' }, { _id: 'p4' }, { _id: 'p5' }].map(
		(p) => ({
			part: p as any,
			usesInTransition: true,
			pieces: [{ _id: p._id + '_p1' } as any],
		})
	) as PartAndPieces[],

	layer,
}
