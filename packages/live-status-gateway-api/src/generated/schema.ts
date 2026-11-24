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
	RESOLVED_PLAYLIST = 'resolvedPlaylist',
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
	additionalProperties?: Record<string, any>
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
	 * Blueprint-defined playout state, used to expose arbitrary information about playout
	 */
	playoutState?: any
	/**
	 * Timing information about the active playlist
	 */
	timing: ActivePlaylistTiming
	/**
	 * Information about the current quickLoop, if any
	 */
	quickLoop?: ActivePlaylistQuickLoop
	/**
	 * Status of the 3 T-timers in the playlist
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
	 * Whether this part was created by an adlib
	 */
	createdByAdLib: boolean
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
	/**
	 * AB playback session assignments for this Piece
	 */
	abSessions?: AbSessionAssignment[]
}

interface AbSessionAssignment {
	/**
	 * The name of the AB Pool this session is for
	 */
	poolName: string
	/**
	 * Name of the session
	 */
	sessionName: string
	/**
	 * The assigned player ID
	 */
	playerId: string | number
}

/**
 * Timing information about the current part
 */
interface CurrentPartTiming {
	/**
	 * Expected duration of the part (milliseconds). For the on-air part in `currentPart.timing`, it is the duration as Sofie resolves it, and it is never the default duration of the Studio. For a part with an expected duration of its own, this is that expected duration with its transition. For a part with no expected duration of its own, it is its recorded duration after it has played. If it has not played, it is its share of its display-duration group: the time that the parts before it in the group leave. It is 0 for a part with none of these values, and until Sofie has published the timing for the playlist.
	 * For each part in `currentSegment.parts`, it is the expected duration as set on the part, without its transition. It is absent when the part has no expected duration.
	 */
	expectedDurationMs: number
	/**
	 * Unix timestamp (milliseconds) of the start of the on-air part: its planned start (`plannedStartedPlayback`). Sofie's own countdowns count from this start. With a single playout gateway, this is the start that the playout gateway reported. Until the playout gateway reports it, this is the send time of this message. In multi-gateway mode, it is the start that Sofie schedules at the take, a moment after the take. Thus, between the take and that start, it is in the future.
	 */
	startTime: number
	/**
	 * Unix timestamp (milliseconds) of the expected end of the on-air part. This is the time at which the countdown of the part on Sofie's screens reaches zero. When the start of the part is known, this value is fixed: that start plus the length that the countdown runs for. In multi-gateway mode, the start is known from the take. Thus, between the take and the start of the part, this value is already the start plus that length.
	 * With a single playout gateway, the start is known when the playout gateway reports it. Until then, this value is the send time of this message plus that length, so it moves later with each message. When there is no published countdown, for example before Sofie has published the timing for the playlist, it is `startTime` plus `expectedDurationMs`. It is a plain number, so it is accurate only at the send time of this message.
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
	 * Expected duration of the content of the segment (milliseconds). It is the sum of the expected durations of its parts as Sofie resolves them, as for `currentPart.timing.expectedDurationMs`. Each duration includes its transition and the effect of display-duration groups. The sum does not include untimed parts, parts that an adlib created, and parts that were removed from the rundown.
	 * It can change during the show, for example in a display-duration group. There, the share of a part without a length of its own depends on how long the parts before it ran. The value does not include a budget. The gateway sends the budget separately, in `budgetDurationMs`. It is 0 until Sofie has published the timing for the playlist. This can occur in the first message after the activation of a playlist, and a later message has the value.
	 */
	expectedDurationMs: number
	/**
	 * Budget duration of the segment (milliseconds)
	 */
	budgetDurationMs?: number
	/**
	 * Countdown type within the segment. Absent when the segment does not set one. Then Sofie uses `part_expected_duration`. Also absent when Sofie sends a countdown type that this version of the API does not know.
	 */
	countdownType?: SegmentCountdownType
	/**
	 * The time that the segment has played, as a timer that the client evaluates against its own clock. It is the sum of the played times of the parts, without the untimed parts. It counts up, so the duration that you read is *negative*, and the elapsed time is its negation. The duration that you read from a timer can hold or decrease, but it cannot increase.
	 * It runs while the on-air part of the segment plays, and it holds for all other segments. For a segment that counts down its budget (`countdownType` `segment_budget_duration`), it is always 0. Absent until Sofie has published the timing for the playlist.
	 */
	playedOut?: TimerStateRunning | TimerStatePaused | null
	/**
	 * The time that remains of the segment, as a timer: the remaining time in Sofie's segment header. It is the budget duration of the segment, or the sum of the expected durations set on the parts that `expectedDurationMs` counts. Each of these expected durations includes its transition. Sofie subtracts the time that has played (`playedOut`) from this value. A part with a retake counts two times.
	 * It runs while the on-air part of the segment plays, and it holds for all other segments. For a segment that counts down its budget (`countdownType` `segment_budget_duration`), it holds at the full budget, except while the segment is on air. Then it counts down from the start of the segment, after the playout gateway has reported that start. On the last segment of the playlist, it holds at the full budget, also while the segment is on air. It becomes negative when the segment overruns. Absent until Sofie has published the timing for the playlist.
	 */
	remaining?: TimerStateRunning | TimerStatePaused | null
	/**
	 * Unix timestamp (milliseconds) of the expected end of the on-air segment. This is the time at which its `remaining` timer reaches zero. At that time, the remaining time in Sofie's segment header also reaches zero. While that timer runs, this value is fixed. While the timer is paused, this value is the send time of this message plus the time that remains. Thus it moves later with each message.
	 * Exception: if the timer has a `resumesAt` that is still to come, this value is that moment plus the time that remains. The timer is paused from a take until the taken part starts. In multi-gateway mode, Sofie plans that start at the take, and the timer has it as its `resumesAt`. With one playout gateway, the start is known only when the playout gateway reports it. Until then, the timer has no `resumesAt`.
	 * For a segment that counts down its budget, the timer is paused only until the playout gateway reports the start of the segment. In multi-gateway mode, the timer has the planned start of the first part of the segment as its `resumesAt`. This applies from the take of that part until that planned start. On the last segment of the playlist, the timer stays paused, with no `resumesAt`.
	 * When there is no timing for the segment yet, this value is the send time of this message. It is a plain number, so it is accurate only at the send time of this message. Use `remaining` when the value must stay accurate.
	 */
	projectedEndTime: number
	additionalProperties?: Record<string, any>
}

/**
 * Countdown type within the segment. Absent when the segment does not set one. Then Sofie uses `part_expected_duration`. Also absent when Sofie sends a countdown type that this version of the API does not know.
 */
enum SegmentCountdownType {
	PART_EXPECTED_DURATION = 'part_expected_duration',
	SEGMENT_BUDGET_DURATION = 'segment_budget_duration',
}

/**
 * Timer state when running (progressing with real time)
 */
interface TimerStateRunning {
	/**
	 * Whether the timer is paused
	 */
	paused: boolean
	/**
	 * Unix timestamp (ms) when the timer reaches/reached zero. For countdown timers, this is when time runs out. For free-run timers, this is when the timer started. Client calculates current value relative to this timestamp.
	 */
	zeroTime: number
	/**
	 * Optional timestamp at which the timer pauses automatically, for example when the on-air part ends and its overrun starts. After that time, its value holds at `zeroTime - pauseTime`.
	 */
	pauseTime?: number | null
	/**
	 * Not applicable while the timer runs, because a running timer has no scheduled start. Always null when present.
	 */
	resumesAt?: number | null
}

/**
 * Timer state when paused: it holds at `duration`, until `resumesAt` if `resumesAt` is set
 */
interface TimerStatePaused {
	/**
	 * Whether the timer is paused
	 */
	paused: boolean
	/**
	 * The duration value in milliseconds at which the timer holds. For countdown timers, this is the remaining time. For free-run timers, this is the elapsed time. If `resumesAt` is set, this is the value until that moment. After that moment, the value counts down from here, as the value of a running timer does.
	 */
	duration: number
	/**
	 * Not applicable while the timer is paused, because a paused timer has already stopped. Always null when present.
	 */
	pauseTime?: number | null
	/**
	 * Optional timestamp at which the timer starts to run, if this time is known in advance, for example a scheduled start. After this timestamp, the timer runs, and its current value is `duration - (now - resumesAt)`. If it is null or absent, the timer holds until Sofie publishes a new state.
	 */
	resumesAt?: number | null
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
	 * Whether this part was created by an adlib
	 */
	createdByAdLib: boolean
	/**
	 * If this part will progress to the next automatically
	 */
	autoNext?: boolean
	timing: CurrentSegmentPartTiming
	additionalProperties?: Record<string, any>
}

interface CurrentSegmentPartTiming {
	/**
	 * Expected duration of the part (milliseconds). For the on-air part in `currentPart.timing`, it is the duration as Sofie resolves it, and it is never the default duration of the Studio. For a part with an expected duration of its own, this is that expected duration with its transition. For a part with no expected duration of its own, it is its recorded duration after it has played. If it has not played, it is its share of its display-duration group: the time that the parts before it in the group leave. It is 0 for a part with none of these values, and until Sofie has published the timing for the playlist.
	 * For each part in `currentSegment.parts`, it is the expected duration as set on the part, without its transition. It is absent when the part has no expected duration.
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
	 * Whether this part was created by an adlib
	 */
	createdByAdLib: boolean
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
	/**
	 * The time that remains to play in the playlist, as a timer that the client evaluates against its own clock. It is the remaining duration in Sofie's rundown header. It holds before the show starts. It counts down while the on-air part, or the budget of the on-air segment, is within its planned length. It holds again when the on-air part or the budget overruns.
	 * A take in a multi-gateway studio schedules the start of its part a moment ahead, and this wait also counts. A take with a time offset plans that start in the past. In both cases, it counts down from the take. This is also true for the first take. It also counts down before the show starts while an untimed opening part plays in a segment with a budget. This is because the budget runs from the start of the segment.
	 * In the `duration` timing mode with a planned duration, it is the planned duration instead. It then counts down from the start of playback, and it becomes negative when the show overruns. Null when no playlist is active, and until Sofie has published the timing for the active playlist.
	 */
	remainingDuration?: TimerStateRunning | TimerStatePaused | null
	/**
	 * The time at which the playlist is now expected to end, as a timer. Read its zero time for the timestamp. It is the estimated end in Sofie's rundown header. It is different from `expectedEnd`, because it includes the time that has played. It moves later in real time while the on-air part overruns.
	 * Before the show starts, it is the planned start plus `remainingDuration`. When the planned start has passed, or when there is no planned start, it moves with the clock. Sometimes `remainingDuration` counts down before the show starts. This occurs from the first take in a multi-gateway studio or with a time offset. It also occurs while an untimed opening part plays in a segment with a budget. In these cases, the estimated end is now plus `remainingDuration`, which holds, as after the show has started.
	 * In the `duration` timing mode with a planned duration, it is the start of playback plus the planned duration, and it does not move. Before playback, it is the same sum from the planned start, if there is a planned start. Null when no playlist is active, and until Sofie has published the timing for the active playlist.
	 */
	estimatedEnd?: TimerStateRunning | TimerStatePaused | null
	/**
	 * The time in hand of the playlist, as a timer. A positive value means ahead of schedule, and a negative value means behind schedule. The over/under on Sofie's screens is the same value with the opposite sign. Thus 10 s over on the screens is a time in hand of -10 s.
	 * It holds while the show is on schedule. It decreases while the show moves its end later, for example while the on-air part overruns. Sometimes Sofie knows in advance when the time in hand will start to decrease. Then Sofie sends it as a paused timer, with `resumesAt` set to that moment. Null for a playlist with the `none` timing mode, no planned duration and no playback yet. Also null when no playlist is active, and until Sofie has published the timing for the active playlist.
	 */
	timeInHand?: TimerStateRunning | TimerStatePaused | null
}

/**
 * Timing mode for the playlist.
 */
enum ActivePlaylistTimingMode {
	NONE = 'none',
	FORWARD_MINUS_TIME = 'forward-time',
	BACK_MINUS_TIME = 'back-time',
	DURATION = 'duration',
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
	 * Whether the timer has been configured (mode and state are not null)
	 */
	configured: boolean
	/**
	 * Timer configuration/mode defining the timer's behavior. Null if not configured.
	 */
	mode: TimerModeCountdown | TimerModeFreeRun | TimerModeTimeOfDay | null
	/**
	 * Current runtime state of the timer. Null if not configured.
	 */
	state: TimerStateRunning | TimerStatePaused | null
	/**
	 * Projected timing for when we expect to reach an anchor part. Used to calculate over/under diff. Has the same structure as state. Running means progressing towards anchor, paused means pushing/delaying anchor.
	 */
	projected?: TimerStateRunning | TimerStatePaused | null
	/**
	 * The ID of the target Part that this timer is counting towards (the "timing anchor"). Optional - null if no anchor is set.
	 */
	anchorPartId?: string | null
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
 * Countdown timer mode - counts down from a duration to zero
 */
interface TimerModeCountdown {
	type: 'countdown'
	/**
	 * The original countdown duration in milliseconds (used for reset)
	 */
	duration: number
	/**
	 * Whether timer stops at zero or continues into negative values
	 */
	stopAtZero: boolean
}

/**
 * Free-running timer mode - counts up from start time
 */
interface TimerModeFreeRun {
	type: 'freeRun'
}

/**
 * Time-of-day timer mode - counts down/up to a specific time
 */
interface TimerModeTimeOfDay {
	type: 'timeOfDay'
	/**
	 * The raw target string as provided when setting the timer (e.g. "14:30", "2023-12-31T23:59:59Z", or a timestamp number)
	 */
	targetRaw: string | number
	/**
	 * Whether timer stops at zero or continues into negative values
	 */
	stopAtZero: boolean
}

/**
 * Resolved playlist details, including the base playlist status.
 */
interface ResolvedPlaylistEvent {
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
	event: 'resolvedPlaylist'
	/**
	 * Instance id of the current part, if any
	 */
	currentPartInstanceId: string | null
	/**
	 * Instance id of the next part, if any
	 */
	nextPartInstanceId: string | null
	/**
	 * Blueprint-defined playout state, used to expose arbitrary information about playout
	 */
	playoutState?: any
	/**
	 * Optional arbitrary data
	 */
	publicData?: any
	/**
	 * Timing information about the playlist using absolute Unix timestamps (ms) and expected duration.
	 */
	timing: ResolvedPlaylistTiming
	/**
	 * Status of the 3 T-timers in the playlist
	 */
	tTimers: TTimerStatus[]
	/**
	 * Information about the current quickLoop, if any
	 */
	quickLoop?: ActivePlaylistQuickLoop | null
	/**
	 * The rundowns in the playlist, in rank order
	 */
	rundowns: ResolvedRundown[]
	additionalProperties?: Record<string, any>
}

/**
 * Timing information about the playlist using absolute Unix timestamps (ms) and expected duration.
 */
interface ResolvedPlaylistTiming {
	/**
	 * Whether the playlist is forward-timed from a start time or back-timed from an end time
	 */
	type: ResolvedPlaylistTimingType
	/**
	 * Unix timestamp (ms) when the playlist actually started playback (first timed part confirmed started). Null until known.
	 */
	startedPlayback: number | null
	/**
	 * Expected duration of the playlist (ms). Null when unknown/unavailable.
	 */
	expectedDurationMs: number | null
	/**
	 * Unix timestamp (ms) when the playlist is expected/projected to end. Null when it cannot be resolved from timing configuration.
	 */
	expectedEnd: number | null
}

/**
 * Whether the playlist is forward-timed from a start time or back-timed from an end time
 */
enum ResolvedPlaylistTimingType {
	FORWARD = 'forward',
	BACK = 'back',
}

/**
 * A rundown within a resolved playlist
 */
interface ResolvedRundown {
	/**
	 * Unique id of the rundown
	 */
	id: string
	/**
	 * Id normally sourced from the ingest system
	 */
	externalId: string
	/**
	 * User-presentable name of the rundown
	 */
	name: string
	/**
	 * Rank for ordering
	 */
	rank: number
	/**
	 * Optional description
	 */
	description?: string
	/**
	 * Optional arbitrary data
	 */
	publicData?: any
	/**
	 * Segments in this rundown
	 */
	segments: ResolvedSegment[]
}

/**
 * A segment within a resolved rundown
 */
interface ResolvedSegment {
	/**
	 * Unique id of the segment
	 */
	id: string
	/**
	 * Id normally sourced from the ingest system
	 */
	externalId: string
	/**
	 * User-facing identifier from the source system
	 */
	identifier: string
	/**
	 * Name of the segment
	 */
	name: string
	/**
	 * Rank for ordering
	 */
	rank: number
	/**
	 * Whether the segment is hidden
	 */
	isHidden: boolean
	/**
	 * Source layers used in this segment
	 */
	sourceLayers: SourceLayer[]
	/**
	 * Output layers used in this segment
	 */
	outputLayers: OutputLayer[]
	/**
	 * Optional arbitrary data
	 */
	publicData?: any
	/**
	 * Timing information about the segment, relative to the start of the segment
	 */
	timing: ResolvedSegmentTiming
	/**
	 * Parts in this segment
	 */
	parts: ResolvedPart[]
	additionalProperties?: Record<string, any>
}

/**
 * Definition of a source layer used in a segment
 */
interface SourceLayer {
	/**
	 * Unique id of the source layer
	 */
	id: string
	/**
	 * User-presentable name of the source layer
	 */
	name: string
	/**
	 * Abbreviation for display
	 */
	abbreviation: string
	/**
	 * Whether the source layer is hidden in the UI
	 */
	isHidden: boolean
	/**
	 * Source layer content type (numeric enum)
	 */
	type: number
	/**
	 * Rank for ordering
	 */
	rank: number
}

/**
 * Definition of an output layer used in a segment
 */
interface OutputLayer {
	/**
	 * Unique id of the output layer
	 */
	id: string
	/**
	 * User-presentable name of the output layer
	 */
	name: string
	/**
	 * Whether the output layer is flattened
	 */
	isFlattened: boolean
	/**
	 * Whether PGM treatment should be in effect
	 */
	isPGM: boolean
	/**
	 * The set of sourceLayer ids that feed this output layer
	 */
	sourceLayerIds: string[]
}

/**
 * Timing information about the segment, relative to the start of the segment
 */
interface ResolvedSegmentTiming {
	/**
	 * Start offset of the segment (ms). For segments, this is typically 0.
	 */
	startMs: number
	/**
	 * End offset of the segment (ms) from the beginning of the segment
	 */
	endMs: number
	/**
	 * Planned/budget duration for the segment (ms)
	 */
	budgetDurationMs: number
}

/**
 * A part within a resolved segment
 */
interface ResolvedPart {
	/**
	 * Unique id of the part
	 */
	id: string
	/**
	 * User-presentable name of the part
	 */
	name: string
	/**
	 * Whether this part was created by an adlib
	 */
	createdByAdLib: boolean
	/**
	 * If this part will progress to the next automatically
	 */
	autoNext?: boolean
	/**
	 * Unique id of the part instance
	 */
	instanceId: string
	/**
	 * Id normally sourced from the ingest system
	 */
	externalId: string
	/**
	 * Rank for ordering
	 */
	rank: number
	/**
	 * Whether this part is invalid and should not be taken
	 */
	invalid: boolean
	/**
	 * Whether this part is floated and cannot be taken/nexted
	 */
	floated: boolean
	/**
	 * Whether this part is excluded from normal timing calculations
	 */
	untimed: boolean
	/**
	 * Optional explanation for why the part is invalid
	 */
	invalidReason?: PartInvalidReason
	/**
	 * Set only for the current or next part
	 */
	state?: ResolvedPartState
	/**
	 * Optional arbitrary data
	 */
	publicData?: any
	/**
	 * Timing information about the part, relative to the start of the segment
	 */
	timing: ResolvedPartTiming
	/**
	 * The rundown timing of the part, as Sofie resolves it: durations and countdowns. It is different from `timing`, which describes the position of this part in the resolved playout.
	 */
	rundownTiming?: PartRundownTiming
	/**
	 * Pieces in this part
	 */
	pieces: ResolvedPiece[]
	additionalProperties?: Record<string, any>
}

/**
 * Optional explanation for why the part is invalid
 */
interface PartInvalidReason {
	/**
	 * Human-readable message explaining why the part is invalid
	 */
	message: string
	/**
	 * Severity hint for displaying the invalid reason
	 */
	severity?: NotificationSeverity
	/**
	 * Optional UI color hint
	 */
	color?: string
}

/**
 * Severity level of the notification.
 */
enum NotificationSeverity {
	WARNING = 'warning',
	ERROR = 'error',
	INFO = 'info',
}

/**
 * Set only for the current or next part
 */
enum ResolvedPartState {
	CURRENT = 'current',
	NEXT = 'next',
}

/**
 * Timing information about the part, relative to the start of the segment
 */
interface ResolvedPartTiming {
	/**
	 * Start offset of the part (ms) from the beginning of the segment
	 */
	startMs: number
	/**
	 * Resolved duration of the part (ms)
	 */
	durationMs: number
	/**
	 * Unix timestamp (ms) when the part was planned to start playback
	 */
	plannedStartedPlayback?: number
	/**
	 * Unix timestamp (ms) when the part was reported when it actually started playback
	 */
	reportedStartedPlayback?: number
	/**
	 * Milliseconds into the part where playback started when taken (eg via “Play/Set Next from Here”; 0 = from the beginning)
	 */
	playOffsetMs?: number
	/**
	 * Unix timestamp (ms) when the part was set as next
	 */
	setAsNext?: number
	/**
	 * Unix timestamp (ms) when the part was taken
	 */
	take?: number
}

/**
 * The rundown timing of the part, as Sofie resolves it: durations and countdowns. It is different from `timing`, which describes the position of this part in the resolved playout.
 */
interface PartRundownTiming {
	/**
	 * The resolved expected duration of the part (milliseconds), as for `currentPart.timing.expectedDurationMs` on the `activePlaylist` topic. For a part with an expected duration of its own, it is that expected duration with its transition. For a part with no expected duration of its own, it is its recorded duration after it has played. If it has not played, it is its share of its display-duration group. It is 0 for a part with none of these values, and until Sofie has published the timing for the playlist.
	 */
	expectedDurationMs: number
	/**
	 * The resolved space that the part uses in a rundown display, as if the part does not play (milliseconds). See `liveDisplayDuration` for the value that increases while the part is on air.
	 */
	displayDurationMs: number
	/**
	 * True when the part is in the QuickLoop
	 */
	isInQuickLoop: boolean
	/**
	 * True when the totals of the playlist and the rundown include the part. False for parts that the rundown skips when it plays in order, unless the playlist allows out-of-order timing.
	 */
	countsTowardsTiming: boolean
	/**
	 * Time until this part goes on air, as a timer that the client evaluates against its own clock. When the on-air part overruns, it holds at the remaining wait of this part. A countdown cannot decrease below the waits that must still occur. Absent when the part will probably not play out if the rundown plays in order. A display uses this to decide not to show a countdown.
	 */
	countdown?: TimerStateRunning | TimerStatePaused | null
	/**
	 * The time that the part has played, as a timer. It counts up, so the duration that you read is *negative*, and the elapsed time is its negation. The duration that you read from a timer can hold or decrease, but it cannot increase. It runs freely while the part is on air. When the part is done, it holds at the recorded duration.
	 */
	played?: TimerStateRunning | TimerStatePaused | null
	/**
	 * The duration of the part. After the part has played, it is the as-run duration. Before that, it is the as-planned duration. While the part overruns, it increases past the planned value. It counts up, so it reads *negative*. See `played`.
	 */
	duration?: TimerStateRunning | TimerStatePaused | null
	/**
	 * `displayDurationMs` while the part is on air. It increases when the part passes its planned end. Thus a part that overruns continues to use more space, and the display does not draw it as finished. It counts up, so it reads *negative*. See `played`.
	 */
	liveDisplayDuration?: TimerStateRunning | TimerStatePaused | null
}

/**
 * A piece within a resolved part
 */
interface ResolvedPiece {
	/**
	 * Unique id of the piece
	 */
	id: string
	/**
	 * Unique id of the piece instance
	 */
	instanceId?: string
	/**
	 * Id normally sourced from the ingest system
	 */
	externalId: string
	/**
	 * User-facing name of the piece
	 */
	name: string
	/**
	 * Priority of the piece
	 */
	priority: number
	/**
	 * Id of the source layer for this piece
	 */
	sourceLayerId: string
	/**
	 * Id of the output layer for this piece
	 */
	outputLayerId: string
	/**
	 * Whether this piece was created by an adlib
	 */
	createdByAdLib: boolean
	/**
	 * Whether this piece is invalid and should be ignored
	 */
	invalid: boolean
	/**
	 * Optional arbitrary data
	 */
	publicData?: any
	/**
	 * Timing information about the piece, relative to the start of the part
	 */
	timing: ResolvedPieceTiming
	/**
	 * Optional tags attached to this piece
	 */
	tags?: string[]
	/**
	 * Optional AB playback session assignments for this piece
	 */
	abSessions?: AbSessionAssignment[]
}

/**
 * Timing information about the piece, relative to the start of the part
 */
interface ResolvedPieceTiming {
	/**
	 * Start offset of the piece (ms) from the beginning of the part
	 */
	startMs?: number
	/**
	 * Resolved duration of the piece (ms)
	 */
	durationMs?: number
	/**
	 * Preroll duration for the piece (ms)
	 */
	prerollMs?: number
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
	 * Expected duration of the content of the segment (milliseconds). It is the sum of the expected durations of its parts as Sofie resolves them, as for `currentPart.timing.expectedDurationMs`. Each duration includes its transition and the effect of display-duration groups. The sum does not include untimed parts, parts that an adlib created, and parts that were removed from the rundown.
	 * It can change during the show, for example in a display-duration group. There, the share of a part without a length of its own depends on how long the parts before it ran. The value does not include a budget. The gateway sends the budget separately, in `budgetDurationMs`. It is 0 until Sofie has published the timing for the playlist. This can occur in the first message after the activation of a playlist, and a later message has the value.
	 */
	expectedDurationMs: number
	/**
	 * Budget duration of the segment (milliseconds)
	 */
	budgetDurationMs?: number
	/**
	 * Countdown type within the segment. Absent when the segment does not set one. Then Sofie uses `part_expected_duration`. Also absent when Sofie sends a countdown type that this version of the API does not know.
	 */
	countdownType?: SegmentCountdownType
	/**
	 * The time that the segment has played, as a timer that the client evaluates against its own clock. It is the sum of the played times of the parts, without the untimed parts. It counts up, so the duration that you read is *negative*, and the elapsed time is its negation. The duration that you read from a timer can hold or decrease, but it cannot increase.
	 * It runs while the on-air part of the segment plays, and it holds for all other segments. For a segment that counts down its budget (`countdownType` `segment_budget_duration`), it is always 0. Absent until Sofie has published the timing for the playlist.
	 */
	playedOut?: TimerStateRunning | TimerStatePaused | null
	/**
	 * The time that remains of the segment, as a timer: the remaining time in Sofie's segment header. It is the budget duration of the segment, or the sum of the expected durations set on the parts that `expectedDurationMs` counts. Each of these expected durations includes its transition. Sofie subtracts the time that has played (`playedOut`) from this value. A part with a retake counts two times.
	 * It runs while the on-air part of the segment plays, and it holds for all other segments. For a segment that counts down its budget (`countdownType` `segment_budget_duration`), it holds at the full budget, except while the segment is on air. Then it counts down from the start of the segment, after the playout gateway has reported that start. On the last segment of the playlist, it holds at the full budget, also while the segment is on air. It becomes negative when the segment overruns. Absent until Sofie has published the timing for the playlist.
	 */
	remaining?: TimerStateRunning | TimerStatePaused | null
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
	| ResolvedPlaylistEvent
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
	AbSessionAssignment,
	CurrentPartTiming,
	CurrentSegment,
	CurrentSegmentTiming,
	SegmentCountdownType,
	TimerStateRunning,
	TimerStatePaused,
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
	TimerModeCountdown,
	TimerModeFreeRun,
	TimerModeTimeOfDay,
	ResolvedPlaylistEvent,
	ResolvedPlaylistTiming,
	ResolvedPlaylistTimingType,
	ResolvedRundown,
	ResolvedSegment,
	SourceLayer,
	OutputLayer,
	ResolvedSegmentTiming,
	ResolvedPart,
	PartInvalidReason,
	NotificationSeverity,
	ResolvedPartState,
	ResolvedPartTiming,
	PartRundownTiming,
	ResolvedPiece,
	ResolvedPieceTiming,
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
	NotificationTargetRundown,
	NotificationTargetType,
	NotificationTargetRundownPlaylist,
	NotificationTargetPartInstance,
	NotificationTargetPieceInstance,
	NotificationTargetUnknown,
}
