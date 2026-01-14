import type { ExpectedPackage, Time } from '@sofie-automation/blueprints-integration'
import type {
	AdLibActionId,
	BucketAdLibActionId,
	BucketAdLibId,
	BucketId,
	ExpectedPackageId,
	PartId,
	PieceId,
	RundownBaselineAdLibActionId,
	RundownId,
	SegmentId,
	StudioId,
} from '../Ids.js'

/**
 * Warning: This is a snapshot of the ExpectedPackage interface from before the rework in R53.
 * This should not be modified and should only be used in code performing fixup operations.
 */

/*
 Expected Packages are created from Pieces in the rundown.
 A "Package" is a generic term for a "thing that can be played", such as media files, audio, graphics etc..
 The blueprints generate Pieces with expectedPackages on them.
 These are then picked up by a Package Manager who then tries to fullfill the expectations.
 Example: An ExpectedPackage could be a "Media file to be present on the location used by a playout device".
   The Package Manager will then copy the file to the right place.
*/

export type ExpectedPackageFromRundown = ExpectedPackageDBFromPiece | ExpectedPackageDBFromAdLibAction

export type ExpectedPackageFromRundownBaseline =
	| ExpectedPackageDBFromBaselineAdLibAction
	| ExpectedPackageDBFromBaselineAdLibPiece
	| ExpectedPackageDBFromRundownBaselineObjects

export type ExpectedPackageDBFromBucket = ExpectedPackageDBFromBucketAdLib | ExpectedPackageDBFromBucketAdLibAction

export type ExpectedPackageDB =
	| ExpectedPackageFromRundown
	| ExpectedPackageDBFromBucket
	| ExpectedPackageFromRundownBaseline
	| ExpectedPackageDBFromStudioBaselineObjects

export enum ExpectedPackageDBType {
	PIECE = 'piece',
	ADLIB_PIECE = 'adlib_piece',
	ADLIB_ACTION = 'adlib_action',
	BASELINE_ADLIB_PIECE = 'baseline_adlib_piece',
	BASELINE_ADLIB_ACTION = 'baseline_adlib_action',
	BUCKET_ADLIB = 'bucket_adlib',
	BUCKET_ADLIB_ACTION = 'bucket_adlib_action',
	RUNDOWN_BASELINE_OBJECTS = 'rundown_baseline_objects',
	STUDIO_BASELINE_OBJECTS = 'studio_baseline_objects',
}
export interface ExpectedPackageDBBase extends Omit<ExpectedPackage.Base, '_id'> {
	_id: ExpectedPackageId
	/** The local package id - as given by the blueprints */
	blueprintPackageId: string

	/** The studio of the Rundown of the Piece this package belongs to */
	studioId: StudioId

	/** Hash that changes whenever the content or version changes. See getContentVersionHash() */
	contentVersionHash: string

	// pieceId: ProtectedString<any> | null
	fromPieceType: ExpectedPackageDBType

	created: Time
}
export interface ExpectedPackageDBFromPiece extends ExpectedPackageDBBase {
	fromPieceType: ExpectedPackageDBType.PIECE | ExpectedPackageDBType.ADLIB_PIECE
	/** The Piece this package belongs to */
	pieceId: PieceId
	/** The Part this package belongs to */
	partId: PartId
	/** The Segment this package belongs to */
	segmentId: SegmentId
	/** The rundown of the Piece this package belongs to */
	rundownId: RundownId
}

export interface ExpectedPackageDBFromBaselineAdLibPiece extends ExpectedPackageDBBase {
	fromPieceType: ExpectedPackageDBType.BASELINE_ADLIB_PIECE
	/** The Piece this package belongs to */
	pieceId: PieceId
	/** The rundown of the Piece this package belongs to */
	rundownId: RundownId
}

export interface ExpectedPackageDBFromAdLibAction extends ExpectedPackageDBBase {
	fromPieceType: ExpectedPackageDBType.ADLIB_ACTION
	/** The Adlib Action this package belongs to */
	pieceId: AdLibActionId
	/** The Part this package belongs to */
	partId: PartId
	/** The Segment this package belongs to */
	segmentId: SegmentId
	/** The rundown of the Piece this package belongs to */
	rundownId: RundownId
}
export interface ExpectedPackageDBFromBaselineAdLibAction extends ExpectedPackageDBBase {
	fromPieceType: ExpectedPackageDBType.BASELINE_ADLIB_ACTION
	/** The Piece this package belongs to */
	pieceId: RundownBaselineAdLibActionId
	/** The rundown of the Piece this package belongs to */
	rundownId: RundownId
}

export interface ExpectedPackageDBFromRundownBaselineObjects extends ExpectedPackageDBBase {
	fromPieceType: ExpectedPackageDBType.RUNDOWN_BASELINE_OBJECTS
	/** The rundown of the Piece this package belongs to */
	rundownId: RundownId
	pieceId: null
}
export interface ExpectedPackageDBFromStudioBaselineObjects extends ExpectedPackageDBBase {
	fromPieceType: ExpectedPackageDBType.STUDIO_BASELINE_OBJECTS
	pieceId: null
}

export interface ExpectedPackageDBFromBucketAdLib extends ExpectedPackageDBBase {
	fromPieceType: ExpectedPackageDBType.BUCKET_ADLIB
	bucketId: BucketId
	/** The Bucket adlib this package belongs to */
	pieceId: BucketAdLibId
	/** The `externalId` of the Bucket adlib this package belongs to */
	pieceExternalId: string
}
export interface ExpectedPackageDBFromBucketAdLibAction extends ExpectedPackageDBBase {
	fromPieceType: ExpectedPackageDBType.BUCKET_ADLIB_ACTION
	bucketId: BucketId
	/** The Bucket adlib-action this package belongs to */
	pieceId: BucketAdLibActionId
	/** The `externalId` of the Bucket adlib-action this package belongs to */
	pieceExternalId: string
}
