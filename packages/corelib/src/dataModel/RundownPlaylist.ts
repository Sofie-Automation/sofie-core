import { Time, TimelinePersistentState, RundownPlaylistTiming } from '@sofie-automation/blueprints-integration'
import {
	PartId,
	PieceInstanceInfiniteId,
	PartInstanceId,
	SegmentId,
	RundownPlaylistActivationId,
	RundownPlaylistId,
	StudioId,
	RundownId,
} from './Ids.js'
import { RundownPlaylistNote } from './Notes.js'
import { ForceQuickLoopAutoNext } from '@sofie-automation/shared-lib/dist/core/model/StudioSettings'

/** Details of an ab-session requested by the blueprints in onTimelineGenerate */
export interface ABSessionInfo {
	/** The unique id of the session. */
	id: string
	/** The name of the session from the blueprints */
	name: string
	/** Whether the name is treated as globally unique */
	isUniqueName: boolean
	/** Set if the session is being by lookahead for a future part */
	lookaheadForPartId?: PartId
	/** Set if the session is being used by an infinite PieceInstance */
	infiniteInstanceId?: PieceInstanceInfiniteId
	/** Set to the PartInstances this session is used by, if not just used for lookahead */
	partInstanceIds?: Array<PartInstanceId>
}

export interface ABSessionAssignment {
	sessionId: string
	sessionName: string
	playerId: number | string
	lookahead: boolean // purely informational for debugging
}

export interface ABSessionAssignments {
	[sessionId: string]: ABSessionAssignment | undefined
}

export enum RundownHoldState {
	NONE = 0,
	PENDING = 1, // During STK
	ACTIVE = 2, // During full, STK is played
	COMPLETE = 3, // During full, full is played
}

export enum QuickLoopMarkerType {
	PART = 'part',
	SEGMENT = 'segment',
	RUNDOWN = 'rundown',
	PLAYLIST = 'playlist',
}

interface QuickLoopPartMarker {
	type: QuickLoopMarkerType.PART
	id: PartId

	/** When a part is dynamically inserted after the marker, the user selected id gets persisted here for the next iteration */
	overridenId?: PartId
}

interface QuickLoopSegmentMarker {
	type: QuickLoopMarkerType.SEGMENT
	id: SegmentId
}

interface QuickLoopRundownMarker {
	type: QuickLoopMarkerType.RUNDOWN
	id: RundownId
}

interface QuickLoopPlaylistMarker {
	type: QuickLoopMarkerType.PLAYLIST
}

export type QuickLoopMarker =
	| QuickLoopPartMarker
	| QuickLoopSegmentMarker
	| QuickLoopRundownMarker
	| QuickLoopPlaylistMarker

export interface QuickLoopProps {
	/** The Start marker */
	start?: QuickLoopMarker
	/** The End marker */
	end?: QuickLoopMarker
	/** Whether the user is allowed to make alterations to the Start/End markers */
	locked: boolean
	/** Whether the loop has two valid markers and is currently running (the current Part is within the loop) */
	running: boolean
	/** Whether the loop has autoNext should force auto-next on contained Parts */
	forceAutoNext: ForceQuickLoopAutoNext
}

export type RundownTTimerMode = RundownTTimerModeFreeRun | RundownTTimerModeCountdown | RundownTTimerModeTimeOfDay

export interface RundownTTimerModeFreeRun {
	readonly type: 'freeRun'
}
export interface RundownTTimerModeCountdown {
	readonly type: 'countdown'
	/**
	 * The original duration of the countdown in milliseconds, so that we know what value to reset to
	 */
	readonly duration: number

	/**
	 * If the countdown should stop at zero, or continue into negative values
	 */
	readonly stopAtZero: boolean
}
export interface RundownTTimerModeTimeOfDay {
	readonly type: 'timeOfDay'

	/**
	 * The raw target string of the timer, as provided when setting the timer
	 * (e.g. "14:30", "2023-12-31T23:59:59Z", or a timestamp number)
	 */
	readonly targetRaw: string | number

	/**
	 * If the countdown should stop at zero, or continue into negative values
	 */
	readonly stopAtZero: boolean
}

/**
 * Timing state for a timer, optimized for efficient client rendering.
 * When running, the client calculates current time from zeroTime.
 * When paused, the duration is frozen and sent directly.
 * pauseTime indicates when the timer should automatically pause (when current part ends and overrun begins).
 *
 * Client rendering logic:
 * ```typescript
 * if (state.paused === true) {
 *   // Manually paused by user or already pushing/overrun
 *   duration = state.duration
 * } else if (state.pauseTime && now >= state.pauseTime) {
 *   // Auto-pause at overrun (current part ended)
 *   duration = state.zeroTime - state.pauseTime
 * } else {
 *   // Running normally
 *   duration = state.zeroTime - now
 * }
 * ```
 */
export type TimerState =
	| {
			/** Whether the timer is paused */
			paused: false
			/** The absolute timestamp (ms) when the timer reaches/reached zero */
			zeroTime: number
			/** Optional timestamp when the timer should pause (when current part ends) */
			pauseTime?: number | null
	  }
	| {
			/** Whether the timer is paused */
			paused: true
			/** The frozen duration value in milliseconds */
			duration: number
			/** Optional timestamp when the timer should pause (null when already paused/pushing) */
			pauseTime?: number | null
	  }

/**
 * Calculate the current duration for a timer state.
 * Handles paused, auto-pause (pauseTime), and running states.
 *
 * @param state The timer state
 * @param now Current timestamp in milliseconds
 * @returns The current duration in milliseconds
 */
export function timerStateToDuration(state: TimerState, now: number): number {
	if (state.paused) {
		// Manually paused by user or already pushing/overrun
		return state.duration
	} else if (state.pauseTime && now >= state.pauseTime) {
		// Auto-pause at overrun (current part ended)
		return state.zeroTime - state.pauseTime
	} else {
		// Running normally
		return state.zeroTime - now
	}
}

export type RundownTTimerIndex = 1 | 2 | 3

export interface RundownTTimer {
	readonly index: RundownTTimerIndex

	/** A label for the timer */
	label: string

	/** The current mode of the timer, or null if not configured
	 *
	 * This defines how the timer behaves
	 */
	mode: RundownTTimerMode | null

	/** The current state of the timer, or null if not configured
	 *
	 * This contains the information needed to calculate the current time of the timer
	 */
	state: TimerState | null

	/** The projected time when we expect to reach the anchor part, for calculating over/under diff.
	 *
	 * Based on scheduled durations of remaining parts and segments up to the anchor.
	 * The over/under diff is calculated as the difference between this projection and the timer's target (state.zeroTime).
	 *
	 * Running means we are progressing towards the anchor (projection moves with real time)
	 * Paused means we are pushing (e.g. overrunning the current segment, so the anchor is being delayed)
	 *
	 * Calculated automatically when anchorPartId is set, or can be set manually by a blueprint if custom logic is needed.
	 */
	projectedState?: TimerState

	/** The target Part that this timer is counting towards (the "timing anchor")
	 *
	 * This is typically a "break" part or other milestone in the rundown.
	 * When set, the server calculates projectedState based on when we expect to reach this part.
	 * If not set, projectedState is not calculated automatically but can still be set manually by a blueprint.
	 */
	anchorPartId?: PartId

	/*
	 * Future ideas:
	 * allowUiControl: boolean
	 * display: { ... } // some kind of options for how to display in the ui
	 */
}

export interface DBRundownPlaylist {
	_id: RundownPlaylistId
	/** External ID (source) of the playlist */
	externalId: string
	/** Studio that this playlist is assigned to */
	studioId: StudioId

	restoredFromSnapshotId?: RundownPlaylistId

	/** A name to be displayed to the user */
	name: string
	/** Created timestamp */
	created: Time
	/** Last modified timestamp */
	modified: Time
	/** Rundown timing information */
	timing: RundownPlaylistTiming
	/** Is the playlist in rehearsal mode (can be used, when active: true) */
	rehearsal?: boolean
	/** Playout hold state */
	holdState?: RundownHoldState
	/** Truthy when the playlist is currently active in the studio. This is regenerated upon each activation/reset. */
	activationId?: RundownPlaylistActivationId
	/** Timestamp when the playlist was last reset. Used to silence a few errors upon reset.*/
	resetTime?: Time
	/** Marker indicating if unplayed parts behind the onAir part, should be treated as "still to be played" or "skipped" in terms of timing calculations */
	outOfOrderTiming?: boolean
	/** Should time-of-day clocks be used instead of countdowns by default */
	timeOfDayCountdowns?: boolean
	/** Arbitraty data storage for internal use in the blueprints */
	privateData?: unknown
	/** Arbitraty data relevant for other systems and exposed to them via APIs */
	publicData?: unknown

	/** the id of the Live Part - if empty, no part in this rundown is live */
	currentPartInfo: SelectedPartInstance | null
	/** the id of the Next Part - if empty, no segment will follow Live Part */
	nextPartInfo: SelectedPartInstance | null
	/** The time offset of the next line */
	nextTimeOffset?: number | null
	/**
	 * Previously played PartInstances, ordered most-recent-first (index 0 = the one taken from most recently).
	 * There may be more than one entry when keepalive/postroll/preroll cause PartInstances to overlap:
	 * e.g. if Part A is still audible due to postroll when Part C is taken, both A and B are retained here
	 * until their timeline contribution has fully ended.
	 */
	previousPartsInfo: SelectedPartInstance[]

	/**
	 * The id of the Queued Segment. If set, the Next point will jump to that segment when reaching the end of the currently playing segment.
	 * In general this should only be set/cleared by a useraction, or during the take logic. This ensures that it isnt lost when doing manual set-next actions
	 */
	queuedSegmentId?: SegmentId

	/** Holds notes (warnings / errors) thrown by the blueprints during creation */
	notes?: Array<RundownPlaylistNote>

	quickLoop?: QuickLoopProps

	/** Actual time of playback starting */
	startedPlayback?: Time
	/** Timestamp for the last time an incorrect part was reported as started */
	lastIncorrectPartPlaybackReported?: Time
	/** Actual time of each rundown starting playback */
	rundownsStartedPlayback?: Record<string, Time>
	/**
	 * Actual time of SOME segments starting playback - usually just the previous and current one
	 * This is not using SegmentId, but SegmentPlayoutId
	 */
	segmentsStartedPlayback?: Record<string, Time>
	/** Time of the last take */
	lastTakeTime?: Time

	/** If the order of rundowns in this playlist has ben set manually by a user in Sofie */
	rundownRanksAreSetInSofie?: boolean
	/** If the order of rundowns in this playlist has ben set manually by a user/blueprints in Sofie */
	rundownIdsInOrder: RundownId[]

	/**
	 * Persistent state belong to blueprint playout methods
	 * This can be accessed and modified by the blueprints in various methods
	 */
	privatePlayoutPersistentState?: TimelinePersistentState
	/**
	 * Persistent state belong to blueprint playout methods, but exposed to APIs such as the LSG
	 * This can be accessed and modified by the blueprints in various methods, but is also exposed to APIs such as the LSG
	 */
	publicPlayoutPersistentState?: TimelinePersistentState

	/** AB playback sessions calculated in the last timeline genertaion */
	trackedAbSessions?: ABSessionInfo[]
	/** AB playback sessions assigned in the last timeline generation */
	assignedAbSessions?: Record<string, ABSessionAssignments>

	/**
	 * T-timers for the Playlist.
	 * This is a fixed size pool with 3 being chosen as a likely good amount, that can be used for any purpose.
	 */
	tTimers: [RundownTTimer, RundownTTimer, RundownTTimer]
}

// Information about a 'selected' PartInstance for the Playlist
export type SelectedPartInstance = Readonly<{
	partInstanceId: PartInstanceId
	rundownId: RundownId

	/** if nextPartId was set manually (ie from a user action) */
	manuallySelected: boolean

	/** Whether this instance was selected because of RundownPlaylist.queuedSegmentId. This will cause it to clear that property as part of the take operation */
	consumesQueuedSegmentId: boolean
}>
