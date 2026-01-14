import { ExpectedPackage, Time } from '@sofie-automation/blueprints-integration'
import { protectString, unprotectString } from '../protectedString.js'
import { getHash, assertNever } from '../lib.js'
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

	package: ReadonlyDeep<ExpectedPackage.Any>

	// Future: This should be ExpectedPackageIngestSource[], but for the first iteration this is limited to a single source
	ingestSources: [ExpectedPackageIngestSource]

	// playoutSources: {
	// 	/** Any playout PieceInstance. This is limited to the current and next partInstances */
	// 	pieceInstanceIds: PieceInstanceId[]
	// }
}

export interface ExpectedPackageIngestSourceBucketPiece {
	fromPieceType: ExpectedPackageDBType.BUCKET_ADLIB
	/** The Bucket adlib this package belongs to */
	pieceId: BucketAdLibId
	/** The `externalId` of the Bucket adlib this package belongs to */
	pieceExternalId: string
}
export interface ExpectedPackageIngestSourceBucketAdlibAction {
	fromPieceType: ExpectedPackageDBType.BUCKET_ADLIB_ACTION
	/** The Bucket adlib-action this package belongs to */
	pieceId: BucketAdLibActionId
	/** The `externalId` of the Bucket adlib-action this package belongs to */
	pieceExternalId: string
}

export interface ExpectedPackageIngestSourcePiece {
	fromPieceType: ExpectedPackageDBType.PIECE | ExpectedPackageDBType.ADLIB_PIECE
	/** The Piece this package belongs to */
	pieceId: PieceId
	/** The Part this package belongs to */
	partId: PartId
	/** The Segment this package belongs to */
	segmentId: SegmentId
}
export interface ExpectedPackageIngestSourceAdlibAction {
	fromPieceType: ExpectedPackageDBType.ADLIB_ACTION
	/** The Piece this package belongs to */
	pieceId: AdLibActionId
	/** The Part this package belongs to */
	partId: PartId
	/** The Segment this package belongs to */
	segmentId: SegmentId
}
export interface ExpectedPackageIngestSourceBaselinePiece {
	fromPieceType: ExpectedPackageDBType.BASELINE_PIECE
	/** The Piece this package belongs to */
	pieceId: PieceId
}
export interface ExpectedPackageIngestSourceBaselineAdlibPiece {
	fromPieceType: ExpectedPackageDBType.BASELINE_ADLIB_PIECE
	/** The Piece this package belongs to */
	pieceId: PieceId
}
export interface ExpectedPackageIngestSourceBaselineAdlibAction {
	fromPieceType: ExpectedPackageDBType.BASELINE_ADLIB_ACTION
	/** The Piece this package belongs to */
	pieceId: RundownBaselineAdLibActionId
}
export interface ExpectedPackageIngestSourceBaselineObjects {
	fromPieceType: ExpectedPackageDBType.RUNDOWN_BASELINE_OBJECTS
}

export interface ExpectedPackageIngestSourceStudioBaseline {
	// Future: Technically this is a playout source, but for now it needs to be treated as an ingest source
	fromPieceType: ExpectedPackageDBType.STUDIO_BASELINE_OBJECTS
}

export type ExpectedPackageIngestSourcePart = ExpectedPackageIngestSourcePiece | ExpectedPackageIngestSourceAdlibAction

export type ExpectedPackageIngestSourceBucket =
	| ExpectedPackageIngestSourceBucketPiece
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
 * Generate the expectedPackageId for the given piece instance.
 * Note: This will soon be replaced with a new flow based on the contentVersionHash once shared ownership is implemented.
 */
export function getExpectedPackageIdForPieceInstance(
	/** _id of the owner (the piece, adlib etc..) */
	ownerId: PieceInstanceId,
	/** The locally unique id of the expectedPackage */
	localExpectedPackageId: ExpectedPackage.Base['_id']
): ExpectedPackageId {
	return protectString(`${ownerId}_${getHash(localExpectedPackageId)}`)
}

/**
 * Generate the temporary expectedPackageId for the given package.
 * Note: This will soon be replaced with a new flow based on the contentVersionHash once shared ownership is implemented.
 */
export function getExpectedPackageIdFromIngestSource(
	/** Preferably a RundownId or BucketId, but StudioId is allowed when not owned by a rundown or bucket */
	parentId: RundownId | StudioId | BucketId,
	source: ExpectedPackageIngestSource,
	/** The locally unique id of the expectedPackage */
	localExpectedPackageId: ExpectedPackage.Base['_id']
): ExpectedPackageId {
	let ownerId: string
	const ownerPieceType = source.fromPieceType
	switch (source.fromPieceType) {
		case ExpectedPackageDBType.PIECE:
		case ExpectedPackageDBType.ADLIB_PIECE:
		case ExpectedPackageDBType.ADLIB_ACTION:
		case ExpectedPackageDBType.BASELINE_PIECE:
		case ExpectedPackageDBType.BASELINE_ADLIB_PIECE:
		case ExpectedPackageDBType.BASELINE_ADLIB_ACTION:
			ownerId = unprotectString(source.pieceId)
			break
		case ExpectedPackageDBType.RUNDOWN_BASELINE_OBJECTS:
			ownerId = 'rundownBaselineObjects'
			break
		case ExpectedPackageDBType.STUDIO_BASELINE_OBJECTS:
			ownerId = 'studioBaseline'
			break
		case ExpectedPackageDBType.BUCKET_ADLIB:
		case ExpectedPackageDBType.BUCKET_ADLIB_ACTION:
			ownerId = unprotectString(source.pieceId)
			break

		default:
			assertNever(source)
			throw new Error(`Unknown fromPieceType "${ownerPieceType}"`)
	}
	return protectString(`${parentId}_${ownerId}_${getHash(localExpectedPackageId)}`)
}

// Future implementation of id generation, once shared ownership is implemented
// export function getExpectedPackageIdNew(
// 	/** _id of the rundown*/
// 	rundownId: RundownId,
// 	/** The locally unique id of the expectedPackage */
// 	expectedPackage: ReadonlyDeep<ExpectedPackage.Any>
// ): ExpectedPackageId {
// 	// This may be too agressive, but we don't know how to merge some of the properties
// 	const objHash = hashObj({
// 		...expectedPackage,
// 		listenToPackageInfoUpdates: false, // Not relevant for the hash
// 	} satisfies ReadonlyDeep<ExpectedPackage.Any>)

// 	return protectString(`${rundownId}_${getHash(objHash)}`)
// }
