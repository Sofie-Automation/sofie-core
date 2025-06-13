import type { PieceStatusCode } from '@sofie-automation/corelib/dist/dataModel/Piece'
import type { BucketAdLib } from '@sofie-automation/corelib/dist/dataModel/BucketAdLibPiece'
import type { AdLibPiece } from '@sofie-automation/corelib/dist/dataModel/AdLibPiece'
import type { BucketAdLibAction } from '@sofie-automation/corelib/dist/dataModel/BucketAdLibAction'
import type { IOutputLayer, ISourceLayer } from '@sofie-automation/shared-lib/dist/core/model/ShowStyle'
import type {
	BucketId,
	ShowStyleBaseId,
	ShowStyleVariantId,
	StudioId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'

export interface BucketAdLibUi extends BucketAdLib {
	sourceLayer?: ISourceLayer
	outputLayer?: IOutputLayer
	status: PieceStatusCode
}

export interface BucketAdLibActionUi extends Omit<AdLibPiece, 'timelineObjectsString'> {
	bucketId: BucketId
	sourceLayer?: ISourceLayer
	outputLayer?: IOutputLayer
	isGlobal?: boolean
	isHidden?: boolean
	isSticky?: boolean
	isAction: true
	isClearSourceLayer?: boolean
	adlibAction: BucketAdLibAction
	message?: string | null
	showStyleBaseId: ShowStyleBaseId
	showStyleVariantId: ShowStyleVariantId | null
	studioId: StudioId
}

export type BucketAdLibItem = BucketAdLibUi | BucketAdLibActionUi
