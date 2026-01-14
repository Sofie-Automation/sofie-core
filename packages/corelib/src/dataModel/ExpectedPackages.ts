import { ExpectedPackage, Time } from '@sofie-automation/blueprints-integration'
import { protectString } from '../protectedString.js'
import { getHash, hashObj } from '../lib.js'
import {
	AdLibActionId,
	BucketAdLibActionId,
	BucketAdLibId,
	BucketId,
	ExpectedPackageId,
	PartId,
	PieceId,
	PieceInstanceId,
	RundownBaselineAdLibActionId,
	RundownId,
	SegmentId,
	StudioId,
} from './Ids.js'
import { ReadonlyDeep } from 'type-fest'

/*
 Expected Packages are created from Pieces and other content in the rundown.
 A "Package" is a generic term for a "thing that can be played", such as media files, audio, graphics etc..
 The blueprints generate Pieces with expectedPackages on them.
 These are then picked up by a Package Manager who then tries to fullfill the expectations.
 Example: An ExpectedPackage could be a "Media file to be present on the location used by a playout device".
   The Package Manager will then copy the file to the right place.
*/

export enum ExpectedPackageDBType {
	PIECE = 'piece',
	ADLIB_PIECE = 'adlib_piece',
	ADLIB_ACTION = 'adlib_action',
	BASELINE_ADLIB_PIECE = 'baseline_adlib_piece',
	BASELINE_ADLIB_ACTION = 'baseline_adlib_action',
	BASELINE_PIECE = 'baseline_piece',
	BUCKET_ADLIB = 'bucket_adlib',
	BUCKET_ADLIB_ACTION = 'bucket_adlib_action',
	RUNDOWN_BASELINE_OBJECTS = 'rundown_baseline_objects',
	STUDIO_BASELINE_OBJECTS = 'studio_baseline_objects',
}

export interface ExpectedPackageDB {
	_id: ExpectedPackageId // derived from rundownId and hash of `package`

	/** The studio of the Rundown of the Piece this package belongs to */
	studioId: StudioId

	/** The rundown this package belongs to, if any. Must not be set when bucketId is set */
	rundownId: RundownId | null
	/** The bucket this package belongs to, if any. Must not be set when rundownId is set */
	bucketId: BucketId | null

	created: Time

	package: ReadonlyDeep<Omit<ExpectedPackage.Base, 'listenToPackageInfoUpdates'>>

	/**
	 * The ingest sources that generated this package.
	 */
	ingestSources: ExpectedPackageIngestSource[]

	playoutSources: {
		/**
		 * Any playout PieceInstance. This can be any non-reset pieceInstance in the rundown.
		 * Due to the update flow, this can contain some stale data for a few seconds after a playout operation.
		 */
		pieceInstanceIds: PieceInstanceId[]
	}
}

export interface ExpectedPackageIngestSourceBase {
	/** The id of the package as known by the blueprints */
	blueprintPackageId: string

	/** Whether the blueprints are listening for updates to packageInfos for this package */
	listenToPackageInfoUpdates: boolean | undefined
}

export interface ExpectedPackageIngestSourceBucketAdlibPiece extends ExpectedPackageIngestSourceBase {
	fromPieceType: ExpectedPackageDBType.BUCKET_ADLIB
	/** The Bucket adlib this package belongs to */
	pieceId: BucketAdLibId
	/** The `externalId` of the Bucket adlib this package belongs to */
	pieceExternalId: string
}
export interface ExpectedPackageIngestSourceBucketAdlibAction extends ExpectedPackageIngestSourceBase {
	fromPieceType: ExpectedPackageDBType.BUCKET_ADLIB_ACTION
	/** The Bucket adlib-action this package belongs to */
	pieceId: BucketAdLibActionId
	/** The `externalId` of the Bucket adlib-action this package belongs to */
	pieceExternalId: string
}

export interface ExpectedPackageIngestSourcePiece extends ExpectedPackageIngestSourceBase {
	fromPieceType: ExpectedPackageDBType.PIECE | ExpectedPackageDBType.ADLIB_PIECE
	/** The Piece this package belongs to */
	pieceId: PieceId
	/** The Part this package belongs to */
	partId: PartId
	/** The Segment this package belongs to */
	segmentId: SegmentId
}
export interface ExpectedPackageIngestSourceAdlibAction extends ExpectedPackageIngestSourceBase {
	fromPieceType: ExpectedPackageDBType.ADLIB_ACTION
	/** The Piece this package belongs to */
	pieceId: AdLibActionId
	/** The Part this package belongs to */
	partId: PartId
	/** The Segment this package belongs to */
	segmentId: SegmentId
}
export interface ExpectedPackageIngestSourceBaselinePiece extends ExpectedPackageIngestSourceBase {
	fromPieceType: ExpectedPackageDBType.BASELINE_PIECE
	/** The Piece this package belongs to */
	pieceId: PieceId
}
export interface ExpectedPackageIngestSourceBaselineAdlibPiece extends ExpectedPackageIngestSourceBase {
	fromPieceType: ExpectedPackageDBType.BASELINE_ADLIB_PIECE
	/** The Piece this package belongs to */
	pieceId: PieceId
}
export interface ExpectedPackageIngestSourceBaselineAdlibAction extends ExpectedPackageIngestSourceBase {
	fromPieceType: ExpectedPackageDBType.BASELINE_ADLIB_ACTION
	/** The Piece this package belongs to */
	pieceId: RundownBaselineAdLibActionId
}
export interface ExpectedPackageIngestSourceBaselineObjects extends ExpectedPackageIngestSourceBase {
	fromPieceType: ExpectedPackageDBType.RUNDOWN_BASELINE_OBJECTS
}

export interface ExpectedPackageIngestSourceStudioBaseline extends ExpectedPackageIngestSourceBase {
	// Future: Technically this is a playout source, but for now it needs to be treated as an ingest source
	fromPieceType: ExpectedPackageDBType.STUDIO_BASELINE_OBJECTS
}

export type ExpectedPackageIngestSourcePart = ExpectedPackageIngestSourcePiece | ExpectedPackageIngestSourceAdlibAction

export type ExpectedPackageIngestSourceBucket =
	| ExpectedPackageIngestSourceBucketAdlibPiece
	| ExpectedPackageIngestSourceBucketAdlibAction

export type ExpectedPackageIngestSourceRundownBaseline =
	| ExpectedPackageIngestSourceBaselinePiece
	| ExpectedPackageIngestSourceBaselineAdlibPiece
	| ExpectedPackageIngestSourceBaselineAdlibAction
	| ExpectedPackageIngestSourceBaselineObjects

export type ExpectedPackageIngestSource =
	| ExpectedPackageIngestSourcePart
	| ExpectedPackageIngestSourceRundownBaseline
	| ExpectedPackageIngestSourceBucket
	| ExpectedPackageIngestSourceStudioBaseline

/**
 * Generate the expectedPackageId for the given expectedPackage.
 * This is a stable id derived from the package and its parent. This document is expected to be owned by multiple sources.
 */
export function getExpectedPackageId(
	/** Preferably a RundownId or BucketId, but StudioId is allowed when not owned by a rundown or bucket */
	parentId: RundownId | StudioId | BucketId,
	/** The locally unique id of the expectedPackage */
	expectedPackage: ReadonlyDeep<Omit<ExpectedPackage.Base, 'listenToPackageInfoUpdates'>>
): ExpectedPackageId {
	// This may be too agressive, but we don't know how to merge some of the properties
	const objHash = hashObj({
		...expectedPackage,
		_id: '', // Ignore the _id, this is not guaranteed to be stable
		listenToPackageInfoUpdates: false, // Not relevant for the hash
	} satisfies ReadonlyDeep<ExpectedPackage.Base>)

	return protectString(`${parentId}_${getHash(objHash)}`)
}

export function isPackageReferencedByPlayout(expectedPackage: Pick<ExpectedPackageDB, 'playoutSources'>): boolean {
	return expectedPackage.playoutSources.pieceInstanceIds.length > 0
}
