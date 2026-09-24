import { PackageInfo } from './packageInfo'
import { ITranslatableMessage } from './translations'

export interface PieceContentStatusObj {
	status: PieceStatusCode
	messages: ITranslatableMessage[]

	freezes: Array<PackageInfo.Anomaly>
	blacks: Array<PackageInfo.Anomaly>
	scenes: Array<number>

	thumbnailUrl: string | undefined
	previewUrl: string | undefined

	packageName: string | null

	contentDuration: number | undefined

	progress: number | undefined

	/**
	 * Per-box preview URLs for SPLITS pieces.
	 * Same length and order as `SplitsContent.boxSourceConfiguration`.
	 * Non-file boxes (camera, remote, etc.) use `{}`.
	 */
	boxPreviews?: SplitBoxPreviewUrls[]
}

/** A generic list of playback availability statuses for a Piece */
export enum PieceStatusCode {
	// Note: Higher is worse

	/** No status has been determined (yet) */
	UNKNOWN = -1,

	/** No fault with piece, can be played */
	OK = 0,

	/** The source exists but can't be played for a non-technical reason. E.G. A placeholder clip with no content. */
	SOURCE_NOT_READY = 5,

	/** The source can be played, but some issues have been detected with it. It can be played fine from a technical standpoint, but the user should be notified. */
	SOURCE_HAS_ISSUES = 10,

	/** The source is present, but should not be played due to a technical malfunction (file is broken, camera robotics failed, REMOTE input is just bars, etc.) */
	SOURCE_BROKEN = 20,

	/** The source (file, live input) is missing and cannot be played, as it would result in BTA */
	SOURCE_MISSING = 30,

	/** The source is in a reported, but unrecognized state */
	SOURCE_UNKNOWN_STATE = 35,

	/** Source not set - the source object is not set to an actual source */
	SOURCE_NOT_SET = 40,
}
export interface SplitBoxPreviewUrls {
	thumbnailUrl?: string
	previewUrl?: string
}
