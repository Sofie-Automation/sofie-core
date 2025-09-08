import { Time, TimelinePersistentState, RundownPlaylistTiming } from '@sofie-automation/blueprints-integration'
import {
	PartId,
	PieceInstanceInfiniteId,
	PartInstanceId,
	SegmentId,
	RundownPlaylistActivationId,
	OrganizationId,
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

export interface DBRundownPlaylist {
	_id: RundownPlaylistId
	/** External ID (source) of the playlist */
	externalId: string
	/** ID of the organization that owns the playlist */
	organizationId?: OrganizationId | null
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
	/** the id of the Previous Part */
	previousPartInfo: SelectedPartInstance | null

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
	previousPersistentState?: TimelinePersistentState
	/** AB playback sessions calculated in the last timeline genertaion */
	trackedAbSessions?: ABSessionInfo[]
	/** AB playback sessions assigned in the last timeline generation */
	assignedAbSessions?: Record<string, ABSessionAssignments>
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
