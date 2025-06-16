import { Time } from '@sofie-automation/blueprints-integration'
import {
	ExpectedMediaItemId,
	StudioId,
	RundownId,
	PartId,
	BucketId,
	BucketAdLibId,
	BucketAdLibActionId,
} from './Ids.js'

/** @deprecated */
export interface ExpectedMediaItemBase {
	_id: ExpectedMediaItemId

	/** Source label that can be used to identify the EMI */
	label?: string

	/** Local path to the media object */
	path: string

	/** Global path to the media object */
	url: string

	/** The studio installation this ExpectedMediaItem was generated in */
	studioId: StudioId

	/** True if the media item has been marked as possibly unavailable */
	disabled: boolean

	/** A label defining a pool of resources */
	mediaFlowId: string

	/** The last time the object was seen / used in Core */
	lastSeen: Time

	/** Time to wait before removing file */
	lingerTime?: number

	/** Frame that media manager should grab for thumbnail preview */
	previewFrame?: number
}
/** @deprecated */
export interface ExpectedMediaItemRundown extends ExpectedMediaItemBase {
	/** The rundown id that is the source of this MediaItem */
	rundownId: RundownId

	/** The part id that is the source of this Media Item */
	partId: PartId | undefined
}
/** @deprecated */
export interface ExpectedMediaItemBucketPiece extends ExpectedMediaItemBase {
	/** The bucket id that is the source of this Media Item */
	bucketId: BucketId

	/** The bucked adLib piece that is the source of this Media Item */
	bucketAdLibPieceId: BucketAdLibId
}
/** @deprecated */
export interface ExpectedMediaItemBucketAction extends ExpectedMediaItemBase {
	/** The bucket id that is the source of this Media Item */
	bucketId: BucketId

	/** The bucked adLib piece that is the source of this Media Item */
	bucketAdLibActionId: BucketAdLibActionId
}
/** @deprecated */
export type ExpectedMediaItem = ExpectedMediaItemRundown | ExpectedMediaItemBucketPiece | ExpectedMediaItemBucketAction
