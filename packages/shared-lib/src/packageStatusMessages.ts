/**
 * The possible statuses of a Package/media object status that can be translated.
 * In all cases the following strings will be available in the translation context, some keys add additional context:
 * - sourceLayer: The name of the source layer
 * - pieceName: The name of the piece the package belongs to
 * - fileName: The name of the file
 * - containerLabels: The labels of the container(s) that report this status
 *
 * For statuses not reported by Package Manager, the `containerLabels` will be an empty string.
 */
export enum PackageStatusMessage {
	// Media Manager
	/**
	 * The File Path is missing
	 * Note: Only used for Media Manager flow
	 * The `fileName` property will always be an empty string
	 */
	MISSING_FILE_PATH = 'MISSING_FILE_PATH',
	/**
	 * The file is not yet ready on the playout system
	 * Note: Only used for Media Manager flow
	 */
	FILE_NOT_YET_READY_ON_PLAYOUT_SYSTEM = 'FILE_NOT_YET_READY_ON_PLAYOUT_SYSTEM',
	/**
	 * The file is being ingested
	 * Note: Only used for Media Manager flow
	 */
	FILE_IS_BEING_INGESTED = 'FILE_IS_BEING_INGESTED',
	/**
	 * The file is missing
	 * Note: Only used for Media Manager flow
	 */
	FILE_IS_MISSING = 'FILE_IS_MISSING',

	// Package manager
	/**
	 * The file has no valid source package containers
	 */
	FILE_MISSING_SOURCE_CONTAINERS = 'FILE_MISSING_SOURCE_CONTAINERS',
	/**
	 * The file can't be found on the playout system
	 */
	FILE_CANT_BE_FOUND_ON_PLAYOUT_SYSTEM = 'FILE_CANT_BE_FOUND_ON_PLAYOUT_SYSTEM',
	/**
	 * The file exists, but is not yet ready on the playout system
	 * This has an extra `reason` property in the translation context, provided by the Package Manager
	 */
	FILE_EXISTS_BUT_IS_NOT_READY_ON_PLAYOUT_SYSTEM = 'FILE_EXISTS_BUT_IS_NOT_READY_ON_PLAYOUT_SYSTEM',
	/**
	 * The file is in a placeholder state for an unknown workflow-defined reason
	 * This is typically replaced by a more speific message provided by the Package Manager
	 */
	FILE_IS_IN_PLACEHOLDER_STATE = 'FILE_IS_IN_PLACEHOLDER_STATE',
	/**
	 * The file is transferring to the playout system
	 */
	FILE_IS_TRANSFERRING_TO_PLAYOUT_SYSTEM = 'FILE_IS_TRANSFERRING_TO_PLAYOUT_SYSTEM',
	/**
	 * The file is transferring to the playout system but cannot be played yet
	 */
	FILE_IS_TRANSFERRING_TO_PLAYOUT_SYSTEM_NOT_READY = 'FILE_IS_TRANSFERRING_TO_PLAYOUT_SYSTEM_NOT_READY',
	/**
	 * The file is in an unknown state
	 * This has an extra `status` property in the translation context, for the unhandled state.
	 * Seeing this message means the Sofie code is missing handling this status, and is a bug or indicates mismatched versions.
	 */
	FILE_IS_IN_UNKNOWN_STATE = 'FILE_IS_IN_UNKNOWN_STATE',

	// Common
	/**
	 * The file doesn't have both audio and video streams
	 */
	FILE_DOESNT_HAVE_BOTH_VIDEO_AND_AUDIO = 'FILE_DOESNT_HAVE_BOTH_VIDEO_AND_AUDIO',
	/**
	 * The file has the wrong format
	 * This has an extra `format` property in the translation context, a user friendly representation of the scanned format
	 */
	FILE_HAS_WRONG_FORMAT = 'FILE_HAS_WRONG_FORMAT',
	/**
	 * The file has the wrong number of audio streams
	 * This has an extra `audioStreams` property in the translation context, the number of audio streams found in the file
	 */
	FILE_HAS_WRONG_AUDIO_STREAMS = 'FILE_HAS_WRONG_AUDIO_STREAMS',

	/**
	 * The clip starts with black frames
	 * This has extra `frames` and `seconds` properties in the translation context, describing the duration of the black region
	 */
	CLIP_STARTS_WITH_BLACK_FRAMES = 'CLIP_STARTS_WITH_BLACK_FRAMES',
	/**
	 * The clip ends with black frames
	 * This has extra `frames` and `seconds` properties in the translation context, describing the duration of the black region
	 */
	CLIP_ENDS_WITH_BLACK_FRAMES = 'CLIP_ENDS_WITH_BLACK_FRAMES',
	/**
	 * The clip has a single region of black frames
	 * This has extra `frames` and `seconds` properties in the translation context, describing the duration of the black region
	 */
	CLIP_HAS_SINGLE_BLACK_FRAMES_REGION = 'CLIP_HAS_SINGLE_BLACK_FRAMES_REGION',
	/**
	 * The clip has multiple regions of black frames
	 * This has extra `frames` and `seconds` properties in the translation context, describing the total duration of all black regions
	 */
	CLIP_HAS_MULTIPLE_BLACK_FRAMES_REGIONS = 'CLIP_HAS_MULTIPLE_BLACK_FRAMES_REGIONS',

	/**
	 * The clip starts with freeze frames
	 * This has extra `frames` and `seconds` properties in the translation context, describing the duration of the freeze region
	 */
	CLIP_STARTS_WITH_FREEZE_FRAMES = 'CLIP_STARTS_WITH_FREEZE_FRAMES',
	/**
	 * The clip ends with freeze frames
	 * This has extra `frames` and `seconds` properties in the translation context, describing the duration of the freeze region
	 */
	CLIP_ENDS_WITH_FREEZE_FRAMES = 'CLIP_ENDS_WITH_FREEZE_FRAMES',
	/**
	 * The clip has a single region of freeze frames
	 * This has extra `frames` and `seconds` properties in the translation context, describing the duration of the freeze region
	 */
	CLIP_HAS_SINGLE_FREEZE_FRAMES_REGION = 'CLIP_HAS_SINGLE_FREEZE_FRAMES_REGION',
	/**
	 * The clip has multiple regions of freeze frames
	 * This has extra `frames` and `seconds` properties in the translation context, describing the total duration of all freeze regions
	 */
	CLIP_HAS_MULTIPLE_FREEZE_FRAMES_REGIONS = 'CLIP_HAS_MULTIPLE_FREEZE_FRAMES_REGIONS',
}
