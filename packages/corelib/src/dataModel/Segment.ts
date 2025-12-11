import { SegmentDisplayMode, SegmentTimingInfo } from '@sofie-automation/blueprints-integration'
import { SegmentId, RundownId } from './Ids.js'
import { SegmentNote } from './Notes.js'
import { CoreUserEditingDefinition, CoreUserEditingProperties } from './UserEditingDefinitions.js'

export enum SegmentOrphanedReason {
	/** Segment is deleted from the NRCS but we still need it */
	DELETED = 'deleted',
	/** Blueprints want the Segment to be hidden, but it is still playing so is must not be hidden right now. */
	HIDDEN = 'hidden',
	/** Segment is owned by playout, and is for AdlibTesting in its rundown */
	ADLIB_TESTING = 'adlib-testing',
}

/** A "Title" in NRK Lingo / "Stories" in ENPS Lingo. */
export interface DBSegment {
	_id: SegmentId
	/** Position inside rundown */
	_rank: number
	/** ID of the source object in the gateway */
	externalId: string
	/** The rundown this segment belongs to */
	rundownId: RundownId

	/** User-presentable name (Slug) for the Title */
	name: string
	/** Arbitraty data storage for internal use in the blueprints */
	privateData?: unknown
	/** Arbitraty data relevant for other systems, made available to them through APIs */
	publicData?: unknown
	/** Hide the Segment in the UI */
	isHidden?: boolean
	/** User-facing identifier that can be used by the User to identify the contents of a segment in the Rundown source system */
	identifier?: string

	/** Show the minishelf of the segment */
	showShelf?: boolean
	/** Segment display mode. Default mode is *SegmentDisplayMode.Timeline* */
	displayAs?: SegmentDisplayMode

	/** Contains properties related to the timing of the segment */
	segmentTiming?: SegmentTimingInfo

	/** Is the segment in an unsynced state? */
	orphaned?: SegmentOrphanedReason

	/** Holds notes (warnings / errors) thrown by the blueprints during creation */
	notes?: Array<SegmentNote>

	/**
	 * User editing definitions for this segment
	 */
	userEditOperations?: CoreUserEditingDefinition[]

	/**
	 * Properties that are user editable from the properties panel in the Sofie UI, if the user saves changes to these
	 * it will trigger a user edit operation of type DefaultUserOperationEditProperties
	 */
	userEditProperties?: CoreUserEditingProperties
}
