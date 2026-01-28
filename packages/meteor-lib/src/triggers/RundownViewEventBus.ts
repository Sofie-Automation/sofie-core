import { EventEmitter } from 'events'
import {
	BucketId,
	PartId,
	PartInstanceId,
	PieceId,
	PieceInstanceId,
	RundownId,
	SegmentId,
	TriggeredActionId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import type { PieceUi } from '../uiTypes/Piece.js'
import type { ShelfTabs } from '../uiTypes/ShelfTabs.js'
import type { IAdLibListItem } from '../uiTypes/Adlib.js'
import type { BucketAdLibItem } from '../uiTypes/Bucket.js'
import { Bucket } from '@sofie-automation/corelib/dist/dataModel/Bucket'

export enum RundownViewEvents {
	ACTIVATE_RUNDOWN_PLAYLIST = 'activateRundownPlaylist',
	DEACTIVATE_RUNDOWN_PLAYLIST = 'deactivateRundownPlaylist',
	RESYNC_RUNDOWN_PLAYLIST = 'resyncRundownPlaylist',
	RESET_RUNDOWN_PLAYLIST = 'resetRundownPlaylist',
	TAKE = 'take',
	REWIND_SEGMENTS = 'rundownRewindSegments',
	GO_TO_LIVE_SEGMENT = 'goToLiveSegment',
	GO_TO_TOP = 'goToTop',
	SEGMENT_ZOOM_ON = 'segmentZoomOn',
	SEGMENT_ZOOM_OFF = 'segmentZoomOff',
	REVEAL_IN_SHELF = 'revealInShelf',
	SWITCH_SHELF_TAB = 'switchShelfTab',
	SHELF_STATE = 'shelfState',
	EDIT_MODE = 'editMode',
	MINI_SHELF_QUEUE_ADLIB = 'miniShelfQueueAdLib',
	GO_TO_PART = 'goToPart',
	GO_TO_PART_INSTANCE = 'goToPartInstance',
	SELECT_PIECE = 'selectPiece',
	HIGHLIGHT = 'highlight',
	TRIGGER_ACTION = 'triggerAction',

	RENAME_BUCKET_ADLIB = 'renameBucketAdLib',
	DELETE_BUCKET_ADLIB = 'deleteBucketAdLib',

	EMPTY_BUCKET = 'emptyBucket',
	RENAME_BUCKET = 'renameBucket',
	DELETE_BUCKET = 'deleteBucket',
	CREATE_BUCKET = 'createBucket',

	CREATE_SNAPSHOT_FOR_DEBUG = 'createSnapshotForDebug',

	TOGGLE_SHELF_DROPZONE = 'toggleShelfDropzone',
	ITEM_DROPPED = 'itemDropped',
	CLOSE_NOTIFICATIONS = 'closeNotifications',
}

export interface IEventContext {
	context?: any
}

type BaseEvent = IEventContext

export interface ActivateRundownPlaylistEvent extends IEventContext {
	rehearsal?: boolean
}

export type DeactivateRundownPlaylistEvent = IEventContext

export interface RevealInShelfEvent extends IEventContext {
	pieceId: PieceId
}

export interface SwitchToShelfTabEvent extends IEventContext {
	tab: ShelfTabs | string
}

export interface ShelfStateEvent extends IEventContext {
	state: boolean | 'toggle'
}

export interface EditModeEvent extends IEventContext {
	state: boolean | 'toggle'
}

export interface MiniShelfQueueAdLibEvent extends IEventContext {
	forward: boolean
}

export interface GoToPartEvent extends IEventContext {
	segmentId: SegmentId
	partId: PartId
	zoomInToFit?: boolean
}

export interface GoToPartInstanceEvent extends IEventContext {
	segmentId: SegmentId
	partInstanceId: PartInstanceId
	zoomInToFit?: boolean
}

export interface SelectPieceEvent extends IEventContext {
	piece: PieceUi | BucketAdLibItem | IAdLibListItem
}

export interface HighlightEvent extends IEventContext {
	rundownId?: RundownId
	segmentId?: SegmentId
	partId?: PartId
	pieceId?: PieceId | PieceInstanceId
}

export interface BucketAdLibEvent extends IEventContext {
	bucket: Bucket
	piece: BucketAdLibItem
}

export interface BucketEvent extends IEventContext {
	bucket: Bucket
}

export interface TriggerActionEvent extends IEventContext {
	actionId: TriggeredActionId
}

export interface ToggleShelfDropzoneEvent extends IEventContext {
	display: boolean
	id: string
}

export interface ItemDroppedEvent extends IEventContext {
	id: string
	message?: string
	error?: string
	bucketId: BucketId
	ev: any
}

export interface RundownViewEventBusEvents {
	[RundownViewEvents.ACTIVATE_RUNDOWN_PLAYLIST]: [e: ActivateRundownPlaylistEvent]
	[RundownViewEvents.DEACTIVATE_RUNDOWN_PLAYLIST]: [e: DeactivateRundownPlaylistEvent]
	[RundownViewEvents.RESYNC_RUNDOWN_PLAYLIST]: [e: BaseEvent]
	[RundownViewEvents.RESET_RUNDOWN_PLAYLIST]: [e: BaseEvent]
	[RundownViewEvents.TAKE]: [e: BaseEvent]
	[RundownViewEvents.REWIND_SEGMENTS]: []
	[RundownViewEvents.GO_TO_LIVE_SEGMENT]: []
	[RundownViewEvents.GO_TO_TOP]: []
	[RundownViewEvents.SEGMENT_ZOOM_ON]: []
	[RundownViewEvents.SEGMENT_ZOOM_OFF]: []
	[RundownViewEvents.SHELF_STATE]: [e: ShelfStateEvent]
	[RundownViewEvents.EDIT_MODE]: [e: EditModeEvent]
	[RundownViewEvents.REVEAL_IN_SHELF]: [e: RevealInShelfEvent]
	[RundownViewEvents.SWITCH_SHELF_TAB]: [e: SwitchToShelfTabEvent]
	[RundownViewEvents.MINI_SHELF_QUEUE_ADLIB]: [e: MiniShelfQueueAdLibEvent]
	[RundownViewEvents.GO_TO_PART]: [e: GoToPartEvent]
	[RundownViewEvents.GO_TO_PART_INSTANCE]: [e: GoToPartInstanceEvent]
	[RundownViewEvents.SELECT_PIECE]: [e: SelectPieceEvent]
	[RundownViewEvents.HIGHLIGHT]: [e: HighlightEvent]
	[RundownViewEvents.TRIGGER_ACTION]: [e: TriggerActionEvent]
	[RundownViewEvents.EMPTY_BUCKET]: [e: BucketEvent]
	[RundownViewEvents.DELETE_BUCKET]: [e: BucketEvent]
	[RundownViewEvents.RENAME_BUCKET]: [e: BucketEvent]
	[RundownViewEvents.CREATE_BUCKET]: [e: IEventContext]
	[RundownViewEvents.DELETE_BUCKET_ADLIB]: [e: BucketAdLibEvent]
	[RundownViewEvents.RENAME_BUCKET_ADLIB]: [e: BucketAdLibEvent]
	[RundownViewEvents.CREATE_SNAPSHOT_FOR_DEBUG]: [e: BaseEvent]
	[RundownViewEvents.TOGGLE_SHELF_DROPZONE]: [e: ToggleShelfDropzoneEvent]
	[RundownViewEvents.ITEM_DROPPED]: [e: ItemDroppedEvent]
	[RundownViewEvents.CLOSE_NOTIFICATIONS]: []
}

class RundownViewEventBus0 extends EventEmitter<RundownViewEventBusEvents> {}

const RundownViewEventBus = new RundownViewEventBus0()
RundownViewEventBus.setMaxListeners(Number.MAX_SAFE_INTEGER)

export default RundownViewEventBus
