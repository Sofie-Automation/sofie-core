/* eslint-disable */
/**
 * This file was automatically generated using and @asyncapi/parser @asyncapi/modelina.
 * DO NOT MODIFY IT BY HAND. Instead, modify the source AsyncAPI schema files,
 * and run "yarn generate-schema-types" to regenerate this file.
 */

type Subscriptions = SubscriptionStatusError | SubscriptionStatusSuccess

interface PingEvent {
	event: 'ping'
	/**
	 * Client originated ID reflected in response message.
	 */
	reqid: number
}

interface PongEvent {
	event: 'pong'
	/**
	 * Client originated ID reflected in response message.
	 */
	reqid: number
}

interface HeartbeatEvent {
	event: 'heartbeat'
}

interface SubscribeEvent {
	/**
	 * Name of the event when subscribing or unsubscribing to topics.
	 */
	event: SubscriptionEventName
	/**
	 * Client originated ID reflected in response message.
	 */
	reqid: number
	subscription: SubscriptionRequestDetails
}

/**
 * Name of the event when subscribing or unsubscribing to topics.
 */
enum SubscriptionEventName {
	SUBSCRIBE = 'subscribe',
	UNSUBSCRIBE = 'unsubscribe',
}

interface SubscriptionRequestDetails {
	/**
	 * The name of the topic related to this status.
	 */
	name: SubscriptionName
}

/**
 * The name of the topic related to this status.
 */
enum SubscriptionName {
	STUDIO = 'studio',
	ACTIVE_PLAYLIST = 'activePlaylist',
	ACTIVE_PIECES = 'activePieces',
	SEGMENTS = 'segments',
	AD_LIBS = 'adLibs',
	NOTIFICATIONS = 'notifications',
	BUCKETS = 'buckets',
	RESERVED_PACKAGES = 'packages',
}

interface SubscriptionStatusError {
	errorMessage: string
	event: 'subscriptionStatus'
	/**
	 * Client originated ID reflected in response message.
	 */
	reqid: number
	subscription: SubscriptionDetails
	additionalProperties?: Record<string, any>
}

interface SubscriptionDetails {
	/**
	 * The name of the topic related to this status.
	 */
	name: SubscriptionName
	/**
	 * The current status of the subscription
	 */
	status: SubscriptionStatus
}

/**
 * The current status of the subscription
 */
enum SubscriptionStatus {
	SUBSCRIBED = 'subscribed',
	UNSUBSCRIBED = 'unsubscribed',
}

interface SubscriptionStatusSuccess {
	event: 'subscriptionStatus'
	/**
	 * Client originated ID reflected in response message.
	 */
	reqid: number
	subscription: SubscriptionDetails
	additionalProperties?: Record<string, any>
}

interface StudioEvent {
	event: 'studio'
	/**
	 * Unique id of the studio
	 */
	id: string | null
	/**
	 * User-presentable name for the studio installation
	 */
	name: string
	/**
	 * The playlists that are currently loaded in the studio
	 */
	playlists: PlaylistStatus[]
	additionalProperties?: Record<string, any>
}

interface PlaylistStatus {
	/**
	 * Unique id of the playlist
	 */
	id: string
	/**
	 * Id normally sourced from the ingest system
	 */
	externalId: string
	/**
	 * The user defined playlist name
	 */
	name: string
	/**
	 * Whether this playlist is currently active or in rehearsal
	 */
	activationStatus: PlaylistActivationStatus
}

/**
 * Whether this playlist is currently active or in rehearsal
 */
enum PlaylistActivationStatus {
	DEACTIVATED = 'deactivated',
	REHEARSAL = 'rehearsal',
	ACTIVATED = 'activated',
}

interface ActivePlaylistEvent {
	event: 'activePlaylist'
	/**
	 * Unique id of the active playlist
	 */
	id: string | null
	/**
	 * Id normally sourced from the ingest system
	 */
	externalId: string | null
	/**
	 * User-presentable name for the active playlist
	 */
	name: string
	/**
	 * The set of rundownIds in the active playlist, in order
	 */
	rundownIds: string[]
	currentPart: CurrentPartStatus | null
	currentSegment: CurrentSegment | null
	nextPart: PartStatus | null
	/**
	 * Optional arbitrary data
	 */
	publicData?: any
	/**
	 * Timing information about the active playlist
	 */
	timing: ActivePlaylistTiming
	/**
	 * Information about the current quickLoop, if any
	 */
	quickLoop?: ActivePlaylistQuickLoop
	/**
	 * T-timers for the playlist. Always contains 3 elements (one for each timer slot).
	 */
	tTimers: TTimerStatus[]
}

interface CurrentPartStatus {
	/**
	 * Unique id of the part
	 */
	id: string
	/**
	 * User-presentable name of the part
	 */
	name: string
	/**
	 * If this part will progress to the next automatically
	 */
	autoNext?: boolean
	/**
	 * Unique id of the segment this part belongs to
	 */
	segmentId: string
	/**
	 * All pieces in this part
	 */
	pieces: PieceStatus[]
	/**
	 * Optional arbitrary data
	 */
	publicData?: any
	/**
	 * Timing information about the current part
	 */
	timing: CurrentPartTiming
	additionalProperties?: Record<string, any>
}

interface PieceStatus {
	/**
	 * Unique id of the Piece
	 */
	id: string
	/**
	 * User-facing name of the Piece
	 */
	name: string
	/**
	 * The source layer name for this Piece
	 */
	sourceLayer: string
	/**
	 * The output layer name for this Piece
	 */
	outputLayer: string
	/**
	 * Tags attached to this Piece
	 */
	tags?: string[]
	/**
	 * Optional arbitrary data
	 */
	publicData?: any
}

/**
 * Timing information about the current part
 */
interface CurrentPartTiming {
	/**
	 * Expected duration of the part (milliseconds)
	 */
	expectedDurationMs: number
	/**
	 * Unix timestamp of when the part started (milliseconds)
	 */
	startTime: number
	/**
	 * Unix timestamp of when the part is projected to end (milliseconds). A sum of `startTime` and `expectedDurationMs`.
	 */
	projectedEndTime: number
	additionalProperties?: Record<string, any>
}

interface CurrentSegment {
	/**
	 * Unique id of the segment
	 */
	id: string
	/**
	 * Timing information about the current segment
	 */
	timing: CurrentSegmentTiming
	parts: CurrentSegmentPart[]
	additionalProperties?: Record<string, any>
}

/**
 * Timing information about the current segment
 */
interface CurrentSegmentTiming {
	/**
	 * Expected duration of the segment (milliseconds)
	 */
	expectedDurationMs: number
	/**
	 * Budget duration of the segment (milliseconds)
	 */
	budgetDurationMs?: number
	/**
	 * Countdown type within the segment. Default: `part_expected_duration`
	 */
	countdownType?: SegmentCountdownType
	/**
	 * Unix timestamp of when the segment is projected to end (milliseconds). The time this segment started, offset by its budget duration, if the segment has a defined budget duration. Otherwise, the time the current part started, offset by the difference between expected durations of all parts in this segment and the as-played durations of the parts that already stopped.
	 */
	projectedEndTime: number
	additionalProperties?: Record<string, any>
}

/**
 * Countdown type within the segment. Default: `part_expected_duration`
 */
enum SegmentCountdownType {
	PART_EXPECTED_DURATION = 'part_expected_duration',
	SEGMENT_BUDGET_DURATION = 'segment_budget_duration',
}

interface CurrentSegmentPart {
	/**
	 * Unique id of the part
	 */
	id: string
	/**
	 * User-presentable name of the part
	 */
	name: string
	/**
	 * If this part will progress to the next automatically
	 */
	autoNext?: boolean
	timing: CurrentSegmentPartTiming
	additionalProperties?: Record<string, any>
}

interface CurrentSegmentPartTiming {
	/**
	 * Expected duration of the part (milliseconds)
	 */
	expectedDurationMs?: number
	additionalProperties?: Record<string, any>
}

interface PartStatus {
	/**
	 * Unique id of the part
	 */
	id: string
	/**
	 * User-presentable name of the part
	 */
	name: string
	/**
	 * If this part will progress to the next automatically
	 */
	autoNext?: boolean
	/**
	 * Unique id of the segment this part belongs to
	 */
	segmentId: string
	/**
	 * All pieces in this part
	 */
	pieces: PieceStatus[]
	/**
	 * Optional arbitrary data
	 */
	publicData?: any
	additionalProperties?: Record<string, any>
}

/**
 * Timing information about the active playlist
 */
interface ActivePlaylistTiming {
	/**
	 * Timing mode for the playlist.
	 */
	timingMode: ActivePlaylistTimingMode
	/**
	 * Unix timestamp of when the playlist started (milliseconds)
	 */
	startedPlayback?: number
	/**
	 * Unix timestamp of when the playlist is expected to start (milliseconds). Required when the timingMode is set to forward-time.
	 */
	expectedStart?: number
	/**
	 * Duration of the playlist in ms
	 */
	expectedDurationMs?: number
	/**
	 * Unix timestamp of when the playlist is expected to end (milliseconds) Required when the timingMode is set to back-time.
	 */
	expectedEnd?: number
}

/**
 * Timing mode for the playlist.
 */
enum ActivePlaylistTimingMode {
	NONE = 'none',
	FORWARD_MINUS_TIME = 'forward-time',
	BACK_MINUS_TIME = 'back-time',
}

/**
 * Information about the current quickLoop, if any
 */
interface ActivePlaylistQuickLoop {
	/**
	 * Whether the user is allowed to make alterations to the Start/End markers
	 */
	locked: boolean
	/**
	 * Whether the loop has two valid markers and is currently running
	 */
	running: boolean
	/**
	 * Represents a positional marker used to define the start or end of a Quick Loop by referencing a rundown, segment, or part.
	 */
	start?: QuickLoopMarker
	/**
	 * Represents a positional marker used to define the start or end of a Quick Loop by referencing a rundown, segment, or part.
	 */
	end?: QuickLoopMarker
	additionalProperties?: Record<string, any>
}

/**
 * Represents a positional marker used to define the start or end of a Quick Loop by referencing a rundown, segment, or part.
 */
interface QuickLoopMarker {
	/**
	 * The type of entity the marker is locked to
	 */
	markerType: QuickLoopMarkerType
	/**
	 * The rundown that this marker references. This will be set for rundown, segment and part markers
	 */
	rundownId?: string
	/**
	 * The segment that this marker references. This will be set for segment and part markers
	 */
	segmentId?: string
	/**
	 * The part that this marker references. This will be set for only part markers
	 */
	partId?: string
	additionalProperties?: Record<string, any>
}

/**
 * The type of entity the marker is locked to
 */
enum QuickLoopMarkerType {
	PLAYLIST = 'playlist',
	RUNDOWN = 'rundown',
	SEGMENT = 'segment',
	PART = 'part',
}

/**
 * Status of a single T-timer in the playlist
 */
interface TTimerStatus {
	/**
	 * Timer index (1-3). The playlist always has 3 T-timer slots.
	 */
	index: TTimerIndex
	/**
	 * User-defined label for the timer
	 */
	label: string
	/**
	 * Whether the timer has been configured (mode is not null)
	 */
	configured: boolean
	/**
	 * Timer mode and timing state. Null if not configured.
	 */
	mode?: TTimerModeCountdown | TTimerModeFreeRun | null
}

/**
 * Timer index (1-3). The playlist always has 3 T-timer slots.
 */
enum TTimerIndex {
	NUMBER_1 = 1,
	NUMBER_2 = 2,
	NUMBER_3 = 3,
}

/**
 * Countdown timer mode - counts down from a duration
 */
interface TTimerModeCountdown {
	type: 'countdown'
	/**
	 * Unix timestamp when timer started (milliseconds). May be adjusted when pausing/resuming.
	 */
	startTime: number
	/**
	 * Unix timestamp when paused (milliseconds), or null if running
	 */
	pauseTime: number | null
	/**
	 * Total countdown duration in milliseconds
	 */
	durationMs: number
	/**
	 * Whether timer stops at zero or continues into negative values
	 */
	stopAtZero: boolean
}

/**
 * Free-running timer mode - counts up from start time
 */
interface TTimerModeFreeRun {
	type: 'freeRun'
	/**
	 * Unix timestamp when timer started (milliseconds). May be adjusted when pausing/resuming.
	 */
	startTime: number
	/**
	 * Unix timestamp when paused (milliseconds), or null if running
	 */
	pauseTime: number | null
}

interface ActivePiecesEvent {
	event: 'activePieces'
	/**
	 * Unique id of the rundown playlist, or null if no playlist is active
	 */
	rundownPlaylistId: string | null
	/**
	 * Pieces that are currently active (on air)
	 */
	activePieces: PieceStatus[]
}

interface SegmentsEvent {
	event: 'segments'
	/**
	 * Unique id of the rundown playlist, or null if no playlist is active
	 */
	rundownPlaylistId: string | null
	/**
	 * The segments that are in the currently active rundown playlist, in order
	 */
	segments: Segment[]
	additionalProperties?: Record<string, any>
}

interface Segment {
	/**
	 * Unique id of the segment
	 */
	id: string
	/**
	 * User-facing identifier that can be used to identify the contents of a segment in the Rundown source system
	 */
	identifier?: string
	/**
	 * Unique id of the rundown this segment belongs to
	 */
	rundownId: string
	/**
	 * Name of the segment
	 */
	name: string
	timing: SegmentTiming
	/**
	 * Optional arbitrary data
	 */
	publicData?: any
	additionalProperties?: Record<string, any>
}

interface SegmentTiming {
	/**
	 * Expected duration of the segment (milliseconds)
	 */
	expectedDurationMs: number
	/**
	 * Budget duration of the segment (milliseconds)
	 */
	budgetDurationMs?: number
	/**
	 * Countdown type within the segment. Default: `part_expected_duration`
	 */
	countdownType?: SegmentCountdownType
	additionalProperties?: Record<string, any>
}

interface AdLibsEvent {
	event: 'adLibs'
	/**
	 * Unique id of the rundown playlist, or null if no playlist is active
	 */
	rundownPlaylistId: string | null
	/**
	 * The available AdLibs for this playlist
	 */
	adLibs: AdLibStatus[]
	/**
	 * The available Global AdLibs for this playlist
	 */
	globalAdLibs: GlobalAdLibStatus[]
}

interface AdLibStatus {
	/**
	 * Unique id of the AdLib
	 */
	id: string
	/**
	 * The user defined AdLib name
	 */
	name: string
	/**
	 * The source layer name for this AdLib
	 */
	sourceLayer: string
	/**
	 * The output layer name for this AdLib
	 */
	outputLayer?: string
	/**
	 * The available action type names that can be used to modify the execution of the AdLib
	 */
	actionType: AdLibActionType[]
	/**
	 * Tags attached to this AdLib
	 */
	tags?: string[]
	/**
	 * Optional arbitrary data
	 */
	publicData?: any
	/**
	 * JSON schema definition of the adLib properties that can be modified using the adLibOptions property in executeAdLib
	 */
	optionsSchema?: string
	/**
	 * Unique id of the segment this adLib belongs to
	 */
	segmentId: string
	/**
	 * Unique id of the part this adLib belongs to
	 */
	partId: string
	additionalProperties?: Record<string, any>
}

interface AdLibActionType {
	/**
	 * The string to be passed to the ExecuteAdlib function
	 */
	name: string
	/**
	 * The label for the AdLib type
	 */
	label: string
}

interface GlobalAdLibStatus {
	/**
	 * Unique id of the AdLib
	 */
	id: string
	/**
	 * The user defined AdLib name
	 */
	name: string
	/**
	 * The source layer name for this AdLib
	 */
	sourceLayer: string
	/**
	 * The output layer name for this AdLib
	 */
	outputLayer?: string
	/**
	 * The available action type names that can be used to modify the execution of the AdLib
	 */
	actionType: AdLibActionType[]
	/**
	 * Tags attached to this AdLib
	 */
	tags?: string[]
	/**
	 * Optional arbitrary data
	 */
	publicData?: any
	/**
	 * JSON schema definition of the adLib properties that can be modified using the adLibOptions property in executeAdLib
	 */
	optionsSchema?: string
	additionalProperties?: Record<string, any>
}

interface PackagesEvent {
	event: 'packages'
	/**
	 * Unique id of the rundown playlist, or null if no playlist is active
	 */
	rundownPlaylistId: string | null
	/**
	 * The Package statuses for this playlist
	 */
	packages: PackageInfoStatus[]
}

interface PackageInfoStatus {
	/**
	 * Name of the package
	 */
	packageName?: string
	/**
	 * Status:
	 * * `unknown` - status not determined (yet)
	 * * `ok` - no faults, can be played
	 * * `source_broken` - the source is present, but should not be played due to a technical malfunction (file is broken, camera robotics failed, REMOTE input is just bars, etc.)
	 * * `source_has_issues` - technically it can be played, but some issues with it were detected
	 * * `source_missing` - the source (file, live input) is missing and cannot be played
	 * * `source_not_ready` - can't be played for a non-technical reason (e.g. a placeholder clip with no content)
	 * * `source_not_set` - missing a file path
	 * * `source_unknown_state` - reported, but unrecognized state
	 */
	status: PackageStatus
	/**
	 * Id of the Rundown that a Piece (or AdLib) expecting this package belongs to
	 */
	rundownId: string
	/**
	 * Id of the Part that a Piece (or AdLib) expecting this package belongs to. It could be an Id of a Part from the Active Playlist topic, or a Part not exposed otherwise by the LSG.
	 */
	partId?: string
	/**
	 * Id of the Segment that a Piece (or AdLib) expecting this package belongs to
	 */
	segmentId?: string
	/**
	 * Id of the Piece or AdLib that expects this package. It could be an Id of a Piece from the Active Pieces and Active Playlist topics, or an Id of an AdLib from the AdLibs topic. It could also be an Id of a Piece not exposed otherwise by the LSG, but still relevant, e.g. to summarize the status of packages within a specific Part/Segment.
	 */
	pieceOrAdLibId: string
	/**
	 * URL where the thumbnail can be accessed
	 */
	thumbnailUrl?: string
	/**
	 * URL where the preview can be accessed
	 */
	previewUrl?: string
}

/**
 * Status:
 * * `unknown` - status not determined (yet)
 * * `ok` - no faults, can be played
 * * `source_broken` - the source is present, but should not be played due to a technical malfunction (file is broken, camera robotics failed, REMOTE input is just bars, etc.)
 * * `source_has_issues` - technically it can be played, but some issues with it were detected
 * * `source_missing` - the source (file, live input) is missing and cannot be played
 * * `source_not_ready` - can't be played for a non-technical reason (e.g. a placeholder clip with no content)
 * * `source_not_set` - missing a file path
 * * `source_unknown_state` - reported, but unrecognized state
 */
enum PackageStatus {
	UNKNOWN = 'unknown',
	OK = 'ok',
	SOURCE_BROKEN = 'source_broken',
	SOURCE_HAS_ISSUES = 'source_has_issues',
	SOURCE_MISSING = 'source_missing',
	SOURCE_NOT_READY = 'source_not_ready',
	SOURCE_NOT_SET = 'source_not_set',
	SOURCE_UNKNOWN_STATE = 'source_unknown_state',
}

interface BucketsEvent {
	event: 'buckets'
	/**
	 * Buckets available in the Studio
	 */
	buckets: BucketStatus[]
}

interface BucketStatus {
	/**
	 * Unique id of the bucket
	 */
	id: string
	/**
	 * The user defined bucket name
	 */
	name: string
	/**
	 * The AdLibs in this bucket
	 */
	adLibs: BucketAdLibStatus[]
}

interface BucketAdLibStatus {
	/**
	 * Unique id of the AdLib
	 */
	id: string
	/**
	 * The user defined AdLib name
	 */
	name: string
	/**
	 * The source layer name for this AdLib
	 */
	sourceLayer: string
	/**
	 * The output layer name for this AdLib
	 */
	outputLayer?: string
	/**
	 * The available action type names that can be used to modify the execution of the AdLib
	 */
	actionType: AdLibActionType[]
	/**
	 * Tags attached to this AdLib
	 */
	tags?: string[]
	/**
	 * Optional arbitrary data
	 */
	publicData?: any
	/**
	 * JSON schema definition of the adLib properties that can be modified using the adLibOptions property in executeAdLib
	 */
	optionsSchema?: string
	/**
	 * Id of the adLib recognizable by the external source. Unique within a bucket.
	 */
	externalId: string
	additionalProperties?: Record<string, any>
}

/**
 * Active notifications in Sofie
 */
interface NotificationsEvent {
	event: 'notifications'
	/**
	 * Active notifications in Sofie
	 */
	activeNotifications: NotificationObj[]
}

/**
 * This describes a notification that should be shown to a user. These can come from various sources, and are added and removed dynamically during system usage
 */
interface NotificationObj {
	/**
	 * Unique identifier for the notification
	 */
	_id: string
	/**
	 * Severity level of the notification.
	 */
	severity: NotificationSeverity
	/**
	 * The message of the notification
	 */
	message: string
	/**
	 * Describes what the notification is related to
	 */
	relatedTo:
		| NotificationTargetRundown
		| NotificationTargetRundownPlaylist
		| NotificationTargetPartInstance
		| NotificationTargetPieceInstance
		| NotificationTargetUnknown
	/**
	 * Unix timestamp of creation
	 */
	created: number
	/**
	 * Unix timestamp of last modification
	 */
	modified?: number
}

/**
 * Severity level of the notification.
 */
enum NotificationSeverity {
	WARNING = 'warning',
	ERROR = 'error',
	INFO = 'info',
}

interface NotificationTargetRundown {
	/**
	 * Possible NotificationTarget types
	 */
	type: NotificationTargetType.RUNDOWN
	studioId: string
	rundownId: string
}

/**
 * Possible NotificationTarget types
 */
enum NotificationTargetType {
	RUNDOWN = 'rundown',
	PLAYLIST = 'playlist',
	PART_INSTANCE = 'partInstance',
	PIECE_INSTANCE = 'pieceInstance',
	UNKNOWN = 'unknown',
}

interface NotificationTargetRundownPlaylist {
	/**
	 * Possible NotificationTarget types
	 */
	type: NotificationTargetType.PLAYLIST
	studioId: string
	playlistId: string
}

interface NotificationTargetPartInstance {
	/**
	 * Possible NotificationTarget types
	 */
	type: NotificationTargetType.PART_INSTANCE
	studioId: string
	rundownId: string
	partInstanceId: string
}

interface NotificationTargetPieceInstance {
	/**
	 * Possible NotificationTarget types
	 */
	type: NotificationTargetType.PIECE_INSTANCE
	studioId: string
	rundownId: string
	partInstanceId: string
	pieceInstanceId: string
}

interface NotificationTargetUnknown {
	/**
	 * Possible NotificationTarget types
	 */
	type: NotificationTargetType.UNKNOWN
}

export type Slash =
	| ActivePiecesEvent
	| ActivePlaylistEvent
	| AdLibsEvent
	| BucketsEvent
	| HeartbeatEvent
	| NotificationsEvent
	| PackagesEvent
	| PongEvent
	| SegmentsEvent
	| StudioEvent
	| SubscriptionStatusError
	| SubscriptionStatusSuccess

export {
	Subscriptions,
	PingEvent,
	PongEvent,
	HeartbeatEvent,
	SubscribeEvent,
	SubscriptionEventName,
	SubscriptionRequestDetails,
	SubscriptionName,
	SubscriptionStatusError,
	SubscriptionDetails,
	SubscriptionStatus,
	SubscriptionStatusSuccess,
	StudioEvent,
	PlaylistStatus,
	PlaylistActivationStatus,
	ActivePlaylistEvent,
	CurrentPartStatus,
	PieceStatus,
	CurrentPartTiming,
	CurrentSegment,
	CurrentSegmentTiming,
	SegmentCountdownType,
	CurrentSegmentPart,
	CurrentSegmentPartTiming,
	PartStatus,
	ActivePlaylistTiming,
	ActivePlaylistTimingMode,
	ActivePlaylistQuickLoop,
	QuickLoopMarker,
	QuickLoopMarkerType,
	TTimerStatus,
	TTimerIndex,
	TTimerModeCountdown,
	TTimerModeFreeRun,
	ActivePiecesEvent,
	SegmentsEvent,
	Segment,
	SegmentTiming,
	AdLibsEvent,
	AdLibStatus,
	AdLibActionType,
	GlobalAdLibStatus,
	PackagesEvent,
	PackageInfoStatus,
	PackageStatus,
	BucketsEvent,
	BucketStatus,
	BucketAdLibStatus,
	NotificationsEvent,
	NotificationObj,
	NotificationSeverity,
	NotificationTargetRundown,
	NotificationTargetType,
	NotificationTargetRundownPlaylist,
	NotificationTargetPartInstance,
	NotificationTargetPieceInstance,
	NotificationTargetUnknown,
}
