import { UserEditingDefinition, UserEditingProperties } from '../userEditing.js'

export enum SegmentDisplayMode {
	Timeline = 'timeline',
	Storyboard = 'storyboard',
	List = 'list',
}

export enum CountdownType {
	/** Should count down till the end of the current part */
	PART_EXPECTED_DURATION = 'part_expected_duration',
	/** Should count down till the end of the segment's budget */
	SEGMENT_BUDGET_DURATION = 'segment_budget_duration',
}

export interface SegmentTimingInfo {
	/** A unix timestamp of when the segment is expected to begin. Affects rundown timing. */
	expectedStart?: number

	/** A unix timestamp of when the segment is expected to end. Affects rundown timing. */
	expectedEnd?: number

	/** Budget duration of this segment, in milliseconds */
	budgetDuration?: number

	/** Defines the behavior of countdowns during this segment. Default: `CountdownType.PART_EXPECTED_DURATION` */
	countdownType?: CountdownType
}

/** The Segment generated from Blueprint */
export interface IBlueprintSegment<TPrivateData = unknown, TPublicData = unknown> {
	/** User-presentable name (Slug) for the Title */
	name: string
	/** Arbitraty data storage for internal use in the blueprints */
	privateData?: TPrivateData
	/** Arbitraty data relevant for other systems, made available to them through APIs */
	publicData?: TPublicData
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

	/**
	 * User editing definitions for this segment
	 */
	userEditOperations?: UserEditingDefinition[]

	/**
	 * Properties that are user editable from the properties panel in the Sofie UI, if the user saves changes to these
	 * it will trigger a user edit operation of type DefaultUserOperationEditProperties
	 */
	userEditProperties?: UserEditingProperties
}
/** The Segment sent from Core */
export interface IBlueprintSegmentDB<TPrivateData = unknown, TPublicData = unknown>
	extends IBlueprintSegment<TPrivateData, TPublicData> {
	_id: string
}
