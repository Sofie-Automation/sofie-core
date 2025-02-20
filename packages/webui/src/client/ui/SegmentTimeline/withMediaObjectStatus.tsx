import { PieceUi } from './SegmentTimelineContainer'
import { RundownUtils } from '../../lib/rundown'
import { IAdLibListItem } from '../Shelf/AdLibListItem'
import { BucketAdLibUi, BucketAdLibActionUi } from '../Shelf/RundownViewBuckets'
import { AdLibPieceUi } from '../../lib/shelf'
import { UIBucketContentStatuses, UIPieceContentStatuses } from '../Collections'
import { Piece } from '@sofie-automation/corelib/dist/dataModel/Piece'
import {
	PieceContentStatusObj,
	UIPieceContentStatus,
} from '@sofie-automation/corelib/dist/dataModel/PieceContentStatus'
import { useTracker } from '../../lib/ReactMeteorData/ReactMeteorData'
import { PieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { UIBucketContentStatus } from '@sofie-automation/meteor-lib/dist/api/rundownNotifications'
import { AdLibPiece } from '@sofie-automation/corelib/dist/dataModel/AdLibPiece'
import { ReadonlyDeep } from 'type-fest'

function unwrapPieceInstance(piece: BucketAdLibUi | IAdLibListItem | AdLibPieceUi | PieceUi | BucketAdLibActionUi) {
	if (RundownUtils.isPieceInstance(piece)) {
		return piece.instance.piece
	} else {
		return piece
	}
}

function getStatusDocForPiece(
	piece: BucketAdLibUi | IAdLibListItem | AdLibPieceUi | PieceUi | BucketAdLibActionUi
): UIPieceContentStatus | UIBucketContentStatus | undefined {
	const pieceUnwrapped = unwrapPieceInstance(piece)

	// Bucket items use a different collection
	if (RundownUtils.isBucketAdLibItem(piece)) {
		return UIBucketContentStatuses.findOne({
			bucketId: piece.bucketId,
			docId: pieceUnwrapped._id,
		})
	}

	// PieceInstance's might have a dedicated status
	if (RundownUtils.isPieceInstance(piece)) {
		const status = UIPieceContentStatuses.findOne({
			// Future: It would be good for this to be stricter.
			pieceId: piece.instance._id,
		})
		if (status) return status
	}

	// Fallback to using the one from the source piece
	return UIPieceContentStatuses.findOne({
		// Future: It would be good for this to be stricter.
		pieceId: pieceUnwrapped._id,
	})
}

/** @deprecated */
export interface WithMediaObjectStatusProps {
	contentStatus: ReadonlyDeep<PieceContentStatusObj> | undefined
}

export function useContentStatusForAdlibPiece(
	piece: Pick<AdLibPiece, '_id' | 'rundownId'> | undefined
): PieceContentStatusObj | undefined {
	return useTracker(
		() =>
			piece
				? UIPieceContentStatuses.findOne({
						pieceId: piece._id,
						rundownId: piece.rundownId || { $exists: false },
				  })?.status
				: undefined,
		[piece?._id, piece?.rundownId]
	)
}

export function useContentStatusForPiece(
	piece: Pick<Piece, '_id' | 'startRundownId' | 'startSegmentId'> | undefined
): PieceContentStatusObj | undefined {
	return useTracker(
		() =>
			piece
				? UIPieceContentStatuses.findOne({
						pieceId: piece._id,
						rundownId: piece.startRundownId || { $exists: false },
						segmentId: piece.startSegmentId || { $exists: false },
				  })?.status
				: undefined,
		[piece?._id, piece?.startRundownId, piece?.startSegmentId]
	)
}

export function useContentStatusForPieceInstance(
	piece: (Pick<PieceInstance, '_id' | 'rundownId'> & { piece: Pick<Piece, '_id'> }) | undefined
): PieceContentStatusObj | undefined {
	return useTracker(() => {
		if (!piece) return undefined

		// PieceInstance's might have a dedicated status
		const instanceStatus = UIPieceContentStatuses.findOne({
			pieceId: piece._id,
			rundownId: piece.rundownId || { $exists: false },
		})

		if (instanceStatus) return instanceStatus.status

		// Fallback to using the one from the source piece
		return UIPieceContentStatuses.findOne({
			pieceId: piece.piece._id,
			// Future: It would be good for this to be stricter.
			rundownId: piece.rundownId || { $exists: false },
		})?.status
	}, [piece?._id, piece?.rundownId])
}

export function useContentStatusForItem(
	piece: BucketAdLibUi | IAdLibListItem | AdLibPieceUi | PieceUi | BucketAdLibActionUi | undefined
): ReadonlyDeep<PieceContentStatusObj> | undefined {
	return useTracker(() => piece && getStatusDocForPiece(piece)?.status, [piece])
}
