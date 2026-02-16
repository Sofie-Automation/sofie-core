import { unprotectString, protectString } from '../../lib/protectedString.js'
import { TSR } from '../../tsr.js'
import { MappingsHash, PeripheralDeviceId, StudioId, TimelineBlob, TimelineHash } from './Ids.js'

/**
 * This defines a session, indicating that this TimelineObject uses an AB player
 */
export interface TimelineObjectAbSessionInfo {
	/**
	 * Name for this session
	 * This should be the same for other pieces/objects which should share this session
	 * This name is scoped to the Segment, any unrelated sessions in the segment must use different names
	 */
	sessionName: string
	/**
	 * The name of the AB Pool this session is for
	 */
	poolName: string

	/**
	 * Whether the `sessionName` of this session is globally unique
	 * This means that every usage of this name will be treated as the same session, regardless of where it is used
	 * This should typically only be used when generating a unique id in an adlib-action, if used during ingest
	 * then replaying a part will often cause the session to be reused which is likely not the desired behaviour
	 */
	sessionNameIsGloballyUnique?: boolean
}

export enum TimelineObjHoldMode {
	/** Default: The object is played as usual (behaviour is not affected by Hold)  */
	NORMAL = 0,
	/** The object is played ONLY when doing a Hold */
	ONLY = 1,
	/** The object is played when NOT doing a Hold */
	EXCEPT = 2,
}

export interface TimelineObjectCoreExt<
	TContent extends { deviceType: TSR.DeviceTypeExt },
	TMetadata = unknown,
	TKeyframeMetadata = unknown,
> extends TSR.TSRTimelineObj<TContent> {
	/**
	 * AB playback sessions needed for this Object
	 */
	abSessions?: Array<TimelineObjectAbSessionInfo>

	/** Restrict object usage according to whether we are currently in a hold */
	holdMode?: TimelineObjHoldMode
	/** Arbitrary data storage for plugins */
	metaData?: TMetadata
	/** Keyframes: Arbitrary data storage for plugins */
	keyframes?: Array<TimelineKeyframeCoreExt<TContent, TKeyframeMetadata>>
	/**
	 * Priority of the object. When multiple overlap in the resolved timeline, highest priority wins.
	 * Lookahead objects have a value of 0.1 (or slightly lower). Your baseline should be using a priority of 0, with other objects using 1 or higher.
	 */
	priority: number
}

export interface TimelineKeyframeCoreExt<
	TContent extends { deviceType: TSR.DeviceTypeExt },
	TKeyframeMetadata = unknown,
> extends TSR.Timeline.TimelineKeyframe<Partial<TContent>> {
	metaData?: TKeyframeMetadata
	/** Whether to keep this keyframe when the object is copied for lookahead. By default all keyframes are removed */
	preserveForLookahead?: boolean

	abSession?: {
		poolName: string
		playerId: number | string
	}
}

export type TimelineEnableExt = TSR.Timeline.TimelineEnable & { setFromNow?: boolean }

export enum TimelineObjType {
	/** Objects played in a rundown */
	RUNDOWN = 'rundown',
}
export interface TimelineObjGeneric extends TimelineObjectCoreExt<TSR.TSRTimelineContent> {
	/** Unique within a timeline (ie within a studio) */
	id: string
	/** Set when the id of the object is prefixed */
	originalId?: string

	objectType: TimelineObjType

	enable: TimelineEnableExt | TimelineEnableExt[]

	/** The id of the group object this object is in  */
	inGroup?: string
}

/** This is the data-object published from Core */
export interface RoutedTimeline {
	_id: StudioId
	/** Hash of the studio mappings */
	mappingsHash: MappingsHash | undefined

	/** Hash of the Timeline */
	timelineHash: TimelineHash

	/** serialized JSON Array containing all timeline-objects */
	timelineBlob: TimelineBlob
	generated: number
}

export enum LookaheadMode {
	// System documentation for lookaheads: https://sofie-automation.github.io/sofie-core/docs/for-developers/for-blueprint-developers/lookahead

	/**
	 * Disable lookahead for this layer
	 */
	NONE = 0,

	/**
	 * Preload content with a secondary layer.
	 * This requires support from the TSR device, to allow for preloading on a resource at the same time as it being on air.
	 * For example, this allows for your TimelineObjects to control the foreground of a CasparCG layer, with lookahead controlling the background of the same layer.
	 */
	PRELOAD = 1,

	// RETAIN = 2, // Removed due to complexity and it being possible to emulate with WHEN_CLEAR and infinites

	/**
	 * Fill the gaps between the planned objects on a layer.
	 * This is the primary lookahead mode, and appears to TSR devices as a single layer of simple objects.
	 */
	WHEN_CLEAR = 3,
}

export interface BlueprintMappings extends TSR.Mappings {
	[layerName: string]: BlueprintMapping
}
export interface BlueprintMapping<
	TOptions extends { mappingType: string } | unknown = TSR.TSRMappingOptions,
> extends TSR.Mapping<TOptions> {
	/** What method core should use to create lookahead objects for this layer */
	lookahead: LookaheadMode
	/** How many lookahead objects to create for this layer. Default = 1 */
	lookaheadDepth?: number
	/** Maximum distance to search for lookahead. Default = 10 */
	lookaheadMaxSearchDistance?: number
}

export interface MappingsExt {
	[layerName: string]: MappingExt
}
export interface MappingExt<TOptions extends { mappingType: string } | unknown = TSR.TSRMappingOptions> extends Omit<
	BlueprintMapping<TOptions>,
	'deviceId'
> {
	deviceId: PeripheralDeviceId
}
export interface RoutedMappings {
	_id: StudioId
	mappingsHash: MappingsHash | undefined
	mappings: MappingsExt
}

export function deserializeTimelineBlob(timelineBlob: TimelineBlob): TimelineObjGeneric[] {
	return JSON.parse(unprotectString(timelineBlob)) as Array<TimelineObjGeneric>
}
export function serializeTimelineBlob(timeline: TimelineObjGeneric[]): TimelineBlob {
	return protectString(JSON.stringify(timeline))
}
