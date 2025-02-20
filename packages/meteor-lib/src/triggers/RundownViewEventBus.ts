import * as EventEmitter from 'events'
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
import type { PieceUi } from '../uiTypes/Piece'
import type { ShelfTabs } from '../uiTypes/ShelfTabs'
import type { IAdLibListItem } from '../uiTypes/Adlib'
import type { BucketAdLibItem } from '../uiTypes/Bucket'
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

class RundownViewEventBus0 extends EventEmitter {
	emit(event: RundownViewEvents.ACTIVATE_RUNDOWN_PLAYLIST, e: ActivateRundownPlaylistEvent): boolean
	emit(event: RundownViewEvents.DEACTIVATE_RUNDOWN_PLAYLIST, e: DeactivateRundownPlaylistEvent): boolean
	emit(event: RundownViewEvents.RESYNC_RUNDOWN_PLAYLIST, e: BaseEvent): boolean
	emit(event: RundownViewEvents.RESET_RUNDOWN_PLAYLIST, e: BaseEvent): boolean
	emit(event: RundownViewEvents.TAKE, e: BaseEvent): boolean
	emit(event: RundownViewEvents.REWIND_SEGMENTS): boolean
	emit(event: RundownViewEvents.GO_TO_LIVE_SEGMENT): boolean
	emit(event: RundownViewEvents.GO_TO_TOP): boolean
	emit(event: RundownViewEvents.SEGMENT_ZOOM_ON): boolean
	emit(event: RundownViewEvents.SEGMENT_ZOOM_OFF): boolean
	emit(event: RundownViewEvents.SHELF_STATE, e: ShelfStateEvent): boolean
	emit(event: RundownViewEvents.REVEAL_IN_SHELF, e: RevealInShelfEvent): boolean
	emit(event: RundownViewEvents.SWITCH_SHELF_TAB, e: SwitchToShelfTabEvent): boolean
	emit(event: RundownViewEvents.MINI_SHELF_QUEUE_ADLIB, e: MiniShelfQueueAdLibEvent): boolean
	emit(event: RundownViewEvents.GO_TO_PART, e: GoToPartEvent): boolean
	emit(event: RundownViewEvents.GO_TO_PART_INSTANCE, e: GoToPartInstanceEvent): boolean
	emit(event: RundownViewEvents.SELECT_PIECE, e: SelectPieceEvent): boolean
	emit(event: RundownViewEvents.HIGHLIGHT, e: HighlightEvent): boolean
	emit(event: RundownViewEvents.TRIGGER_ACTION, e: TriggerActionEvent): boolean
	emit(event: RundownViewEvents.EMPTY_BUCKET, e: BucketEvent): boolean
	emit(event: RundownViewEvents.DELETE_BUCKET, e: BucketEvent): boolean
	emit(event: RundownViewEvents.RENAME_BUCKET, e: BucketEvent): boolean
	emit(event: RundownViewEvents.CREATE_BUCKET, e: IEventContext): boolean
	emit(event: RundownViewEvents.DELETE_BUCKET_ADLIB, e: BucketAdLibEvent): boolean
	emit(event: RundownViewEvents.RENAME_BUCKET_ADLIB, e: BucketAdLibEvent): boolean
	emit(event: RundownViewEvents.CREATE_SNAPSHOT_FOR_DEBUG, e: BaseEvent): boolean
	emit(event: RundownViewEvents.TOGGLE_SHELF_DROPZONE, e: ToggleShelfDropzoneEvent): boolean
	emit(event: RundownViewEvents.ITEM_DROPPED, e: ItemDroppedEvent): boolean
	emit(event: string, ...args: any[]) {
		return super.emit(event, ...args)
	}

	on(event: RundownViewEvents.ACTIVATE_RUNDOWN_PLAYLIST, listener: (e: ActivateRundownPlaylistEvent) => void): this
	on(
		event: RundownViewEvents.DEACTIVATE_RUNDOWN_PLAYLIST,
		listener: (e: DeactivateRundownPlaylistEvent) => void
	): this
	on(event: RundownViewEvents.RESYNC_RUNDOWN_PLAYLIST, listener: (e: BaseEvent) => void): this
	on(event: RundownViewEvents.RESET_RUNDOWN_PLAYLIST, listener: (e: BaseEvent) => void): this
	on(event: RundownViewEvents.TAKE, listener: (e: BaseEvent) => void): this
	on(event: RundownViewEvents.REWIND_SEGMENTS, listener: () => void): this
	on(event: RundownViewEvents.GO_TO_LIVE_SEGMENT, listener: () => void): this
	on(event: RundownViewEvents.GO_TO_TOP, listener: () => void): this
	on(event: RundownViewEvents.SEGMENT_ZOOM_ON, listener: () => void): this
	on(event: RundownViewEvents.SEGMENT_ZOOM_OFF, listener: () => void): this
	on(event: RundownViewEvents.REVEAL_IN_SHELF, listener: (e: RevealInShelfEvent) => void): this
	on(event: RundownViewEvents.SHELF_STATE, listener: (e: ShelfStateEvent) => void): this
	on(event: RundownViewEvents.SWITCH_SHELF_TAB, listener: (e: SwitchToShelfTabEvent) => void): this
	on(event: RundownViewEvents.MINI_SHELF_QUEUE_ADLIB, listener: (e: MiniShelfQueueAdLibEvent) => void): this
	on(event: RundownViewEvents.GO_TO_PART, listener: (e: GoToPartEvent) => void): this
	on(event: RundownViewEvents.GO_TO_PART_INSTANCE, listener: (e: GoToPartInstanceEvent) => void): this
	on(event: RundownViewEvents.SELECT_PIECE, listener: (e: SelectPieceEvent) => void): this
	on(event: RundownViewEvents.HIGHLIGHT, listener: (e: HighlightEvent) => void): this
	on(event: RundownViewEvents.TRIGGER_ACTION, listener: (e: TriggerActionEvent) => void): this
	on(event: RundownViewEvents.EMPTY_BUCKET, listener: (e: BucketEvent) => void): this
	on(event: RundownViewEvents.DELETE_BUCKET, listener: (e: BucketEvent) => void): this
	on(event: RundownViewEvents.RENAME_BUCKET, listener: (e: BucketEvent) => void): this
	on(event: RundownViewEvents.CREATE_BUCKET, listener: (e: IEventContext) => void): this
	on(event: RundownViewEvents.DELETE_BUCKET_ADLIB, listener: (e: BucketAdLibEvent) => void): this
	on(event: RundownViewEvents.RENAME_BUCKET_ADLIB, listener: (e: BucketAdLibEvent) => void): this
	on(event: RundownViewEvents.CREATE_SNAPSHOT_FOR_DEBUG, listener: (e: BaseEvent) => void): this
	on(event: RundownViewEvents.TOGGLE_SHELF_DROPZONE, listener: (e: ToggleShelfDropzoneEvent) => void): this
	on(event: RundownViewEvents.ITEM_DROPPED, listener: (e: ItemDroppedEvent) => void): this
	on(event: string, listener: (...args: any[]) => void) {
		return super.on(event, listener)
	}
}

const RundownViewEventBus = new RundownViewEventBus0()
RundownViewEventBus.setMaxListeners(Number.MAX_SAFE_INTEGER)

export default RundownViewEventBus
