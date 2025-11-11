import type { OnGenerateTimelineObj, TSR } from '../timeline.js'
import type { IBlueprintPartInstance, IBlueprintPieceInstance, IBlueprintSegmentDB } from '../documents/index.js'
import type { IRundownContext } from './rundownContext.js'
import type { IBlueprintExternalMessageQueueObj } from '../message.js'
import { BlueprintQuickLookInfo } from './quickLoopInfo.js'

export interface IEventContext {
	getCurrentTime(): number
}

export interface ITimelineEventContext extends IEventContext, IRundownContext {
	readonly currentPartInstance: Readonly<IBlueprintPartInstance> | undefined
	readonly nextPartInstance: Readonly<IBlueprintPartInstance> | undefined
	readonly previousPartInstance: Readonly<IBlueprintPartInstance> | undefined

	/** Information about the current loop, if there is one */
	readonly quickLoopInfo: BlueprintQuickLookInfo | null

	/**
	 * Get the full session id for an ab playback session.
	 * Note: sessionName should be unique within the segment unless pieces want to share a session
	 * @deprecated use the core provided AB implementation instead
	 */
	getPieceABSessionId(piece: IBlueprintPieceInstance, sessionName: string): string
	/**
	 * Get the full session id for a timelineobject that belongs to an ab playback session
	 * sessionName should also be used in calls to getPieceABSessionId for the owning piece
	 * @deprecated use the core provided AB implementation instead
	 */
	getTimelineObjectAbSessionId(
		obj: OnGenerateTimelineObj<TSR.TSRTimelineContent, any, any>,
		sessionName: string
	): string | undefined
}

export interface IPartEventContext extends IEventContext, IRundownContext {
	readonly part: Readonly<IBlueprintPartInstance>
}

export interface IRundownDataChangedEventContext extends IEventContext, IRundownContext {
	formatDateAsTimecode(time: number): string
	formatDurationAsTimecode(time: number): string

	/** Get all unsent and queued messages in the rundown */
	getAllUnsentQueuedMessages(): Promise<Readonly<IBlueprintExternalMessageQueueObj[]>>
}

export interface IRundownTimingEventContext extends IRundownDataChangedEventContext {
	readonly previousPart: Readonly<IBlueprintPartInstance> | undefined
	readonly currentPart: Readonly<IBlueprintPartInstance>
	readonly nextPart: Readonly<IBlueprintPartInstance> | undefined

	/**
	 * Returns the first PartInstance in the Rundown within the current playlist activation.
	 * This allows for a start time for the Rundown to be determined
	 * @param allowUntimed Whether to consider a Part which has the untimed property set
	 */
	getFirstPartInstanceInRundown(allowUntimed?: boolean): Promise<Readonly<IBlueprintPartInstance>>

	/**
	 * Returns the partInstances in the Segment, limited to the playthrough of the segment that refPartInstance is part of
	 * @param refPartInstance PartInstance to use as the basis of the search
	 */
	getPartInstancesInSegmentPlayoutId(
		refPartInstance: Readonly<IBlueprintPartInstance>
	): Promise<Readonly<IBlueprintPartInstance[]>>

	/**
	 * Returns pieces in a partInstance
	 * @param id Id of partInstance to fetch items in
	 */
	getPieceInstances(...partInstanceIds: string[]): Promise<Readonly<IBlueprintPieceInstance[]>>

	/**
	 * Returns a segment
	 * @param id Id of segment to fetch
	 */
	getSegment(id: string): Promise<Readonly<IBlueprintSegmentDB> | undefined>
}
