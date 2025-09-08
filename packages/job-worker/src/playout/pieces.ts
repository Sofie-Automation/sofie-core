import { PieceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { PieceInstance, PieceInstancePiece } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { PieceLifespan, IBlueprintPieceType } from '@sofie-automation/blueprints-integration/dist'
import { getRandomId, literal } from '@sofie-automation/corelib/dist/lib'
import { JobContext } from '../jobs/index.js'
import { AdLibPiece } from '@sofie-automation/corelib/dist/dataModel/AdLibPiece'
import _ from 'underscore'
import { Piece } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { BucketAdLib } from '@sofie-automation/corelib/dist/dataModel/BucketAdLibPiece'
import { ReadonlyDeep } from 'type-fest'

/**
 * Approximate compare Piece start times (for use in .sort())
 * @param a First Piece
 * @param b Second Piece
 * @param nowInPart Approximate time to substitute for 'now'
 */
export function comparePieceStart<T extends ReadonlyDeep<PieceInstancePiece>>(
	a: T,
	b: T,
	nowInPart: number
): 0 | 1 | -1 {
	if (a.pieceType === IBlueprintPieceType.OutTransition && b.pieceType !== IBlueprintPieceType.OutTransition) {
		return 1
	} else if (a.pieceType !== IBlueprintPieceType.OutTransition && b.pieceType === IBlueprintPieceType.OutTransition) {
		return -1
	}

	const aStart = a.enable.start === 'now' ? nowInPart : a.enable.start
	const bStart = b.enable.start === 'now' ? nowInPart : b.enable.start
	if (aStart < bStart) {
		return -1
	} else if (aStart > bStart) {
		return 1
	} else {
		const aIsInTransition = a.pieceType === IBlueprintPieceType.InTransition
		const bIsInTransition = b.pieceType === IBlueprintPieceType.InTransition
		// Transitions first
		if (aIsInTransition && !bIsInTransition) {
			return -1
		} else if (!aIsInTransition && bIsInTransition) {
			return 1
		} else if (a._id < b._id) {
			// Then go by id to make it consistent
			return -1
		} else if (a._id > b._id) {
			return 1
		} else {
			return 0
		}
	}
}

/**
 * Approximate sorting of PieceInstances, by start time within the PartInstance
 * This assumes all provided PieceInstances belong to the same PartInstance
 * @param pieces PieceInstances to sort
 * @param nowInPart Approximate time to substitute for 'now'
 * @returns Sorted PieceInstances
 */
export function sortPieceInstancesByStart(
	pieces: ReadonlyDeep<PieceInstance[]>,
	nowInPart: number
): ReadonlyDeep<PieceInstance>[] {
	const pieces2 = [...pieces]
	pieces2.sort((a, b) => comparePieceStart(a.piece, b.piece, nowInPart))
	return pieces2
}

/**
 * Approximate sorting of PieceInstances, by start time within the PartInstance
 * This assumes all provided Pieces belong to the same Part.
 * Uses '0' as an approximation for 'now'
 * @param pieces Pieces to sort
 * @returns Sorted Pieces
 */
export function sortPiecesByStart<T extends PieceInstancePiece>(pieces: T[]): T[] {
	pieces.sort((a, b) => comparePieceStart(a, b, 0))
	return pieces
}

/**
 * Wrap a Piece into an AdLibPiece, so that it can be re-played as an AdLib
 * @param context Context of the current job
 * @param piece The Piece to wrap
 * @returns AdLibPiece
 */
export function convertPieceToAdLibPiece(context: JobContext, piece: PieceInstancePiece): AdLibPiece {
	const span = context.startSpan('convertPieceToAdLibPiece')
	const newAdLibPiece = literal<AdLibPiece>({
		...piece,
		_id: getRandomId(),
		_rank: 0,
		expectedDuration: piece.enable.duration,
		rundownId: protectString(''),
	})

	if (span) span.end()
	return newAdLibPiece
}

/**
 * Convert some form of Piece into a PieceInstance, played as an AdLib
 * @param context Context of the current job
 * @param playlistActivationId ActivationId for the active current playlist
 * @param adLibPiece The piece or AdLibPiece to convert
 * @param partInstance The PartInstance the Adlibbed PieceInstance will belong to
 * @param isBeingQueued Whether this is being queued as a new PartInstance, or adding to the already playing PartInstance
 * @returns The PieceInstance that was constructed
 */
export function convertAdLibToGenericPiece(
	adLibPiece: AdLibPiece | Piece | BucketAdLib | PieceInstancePiece,
	isBeingQueued: boolean
): Omit<PieceInstancePiece, 'startPartId'> {
	let duration: number | undefined = undefined
	if ('expectedDuration' in adLibPiece && adLibPiece['expectedDuration']) {
		duration = adLibPiece['expectedDuration']
	} else if ('enable' in adLibPiece && adLibPiece['enable'] && adLibPiece['enable'].duration) {
		duration = adLibPiece['enable'].duration
	}

	const newPieceId: PieceId = getRandomId()
	return {
		...(_.omit(adLibPiece, '_rank', 'expectedDuration', 'partId', 'rundownId') as PieceInstancePiece), // TODO - this could be typed stronger
		_id: newPieceId,
		// startPartId: partInstance.part._id,
		pieceType: IBlueprintPieceType.Normal,
		enable: {
			start: isBeingQueued ? 0 : 'now',
			duration: !isBeingQueued && adLibPiece.lifespan === PieceLifespan.WithinPart ? duration : undefined,
		},
	}
}

/**
 * Setup a PieceInstance to be the start of an infinite chain
 * @param pieceInstance PieceInstance to setup
 */
export function setupPieceInstanceInfiniteProperties(pieceInstance: PieceInstance): void {
	if (pieceInstance.piece.lifespan !== PieceLifespan.WithinPart) {
		// Set it up as an infinite
		pieceInstance.infinite = {
			infiniteInstanceId: getRandomId(),
			infiniteInstanceIndex: 0,
			infinitePieceId: pieceInstance.piece._id,
			fromPreviousPart: false,
		}
	}
}
