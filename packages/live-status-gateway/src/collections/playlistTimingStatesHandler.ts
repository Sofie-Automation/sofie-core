import { CustomCollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
import { PartId, RundownPlaylistId, SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import {
	isPartTimingStateDoc,
	isPlaylistTimingStateDoc,
	isSegmentTimingStateDoc,
	PartTimingStateDoc,
	PlaylistTimingStateDoc,
	SegmentTimingStateDoc,
	TimingStateDoc,
} from '@sofie-automation/corelib/dist/dataModel/TimingState'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist/RundownPlaylist'
import { CorelibPubSub } from '@sofie-automation/corelib/dist/pubsub'
import throttleToNextTick from '@sofie-automation/shared-lib/dist/lib/throttleToNextTick'
import { PickKeys } from '@sofie-automation/shared-lib/dist/lib/types'
import { Logger } from 'winston'
import { CoreHandler } from '../coreHandler.js'
import { CollectionHandlers } from '../liveStatusServer.js'
import { PublicationCollection } from '../publicationCollection.js'

const PLAYLIST_KEYS = ['_id'] as const
type Playlist = PickKeys<DBRundownPlaylist, typeof PLAYLIST_KEYS>

/**
 * The playlist's timing, split by what it describes.
 *
 * The publication sends a discriminated union into one collection; splitting it here means a topic
 * can ask for "this segment's timing" rather than filtering a mixed array itself.
 */
export interface PlaylistTimingStates {
	playlist: PlaylistTimingStateDoc | undefined
	segments: Map<SegmentId, SegmentTimingStateDoc>
	parts: Map<PartId, PartTimingStateDoc>
}

/**
 * Every timing value Sofie computes for the active playlist, as published by `playlistTimingState`.
 *
 * The values are `TimerState`s - anchors describing how a value moves - rather than numbers, so this
 * only receives an update when playout or ingest state changes, not on a clock tick. Topics should
 * forward the states to subscribers rather than evaluating them, or the gateway would have to tick
 * and re-send to stay accurate.
 */
export class PlaylistTimingStatesHandler extends PublicationCollection<
	PlaylistTimingStates,
	CorelibPubSub.playlistTimingState,
	CustomCollectionName.PlaylistTimingState
> {
	private _currentPlaylistId: RundownPlaylistId | undefined

	private _throttledUpdateAndNotify = throttleToNextTick(() => {
		this.updateAndNotify()
	})

	constructor(logger: Logger, coreHandler: CoreHandler) {
		super(CustomCollectionName.PlaylistTimingState, CorelibPubSub.playlistTimingState, logger, coreHandler)
	}

	init(handlers: CollectionHandlers): void {
		super.init(handlers)

		handlers.playlistHandler.subscribe(this.onPlaylistUpdated, PLAYLIST_KEYS)
	}

	protected changed(): void {
		this._throttledUpdateAndNotify()
	}

	private updateCollectionData() {
		const collection = this.getCollectionOrFail()

		this._collectionData = splitTimingStates(collection.find({}))
	}

	private clearCollectionData() {
		this._collectionData = emptyTimingStates()
	}

	onPlaylistUpdated = (playlist: Playlist | undefined): void => {
		this.logUpdateReceived('playlist', `rundownPlaylistId ${playlist?._id}`)
		const prevPlaylistId = this._currentPlaylistId
		this._currentPlaylistId = playlist?._id

		if (this._currentPlaylistId) {
			if (prevPlaylistId !== this._currentPlaylistId) {
				this.stopSubscription()
				this.setupSubscription(this._currentPlaylistId)
			}
		} else {
			this.stopSubscription()
			this.clearAndNotify()
		}
	}

	private clearAndNotify() {
		this.clearCollectionData()
		this.notify(this._collectionData)
	}

	private updateAndNotify() {
		this.updateCollectionData()
		this.notify(this._collectionData)
	}
}

function emptyTimingStates(): PlaylistTimingStates {
	return { playlist: undefined, segments: new Map(), parts: new Map() }
}

/** Split the published union by what each document describes. Exported for testing. */
export function splitTimingStates(docs: TimingStateDoc[]): PlaylistTimingStates {
	const states = emptyTimingStates()

	for (const doc of docs) {
		if (isPlaylistTimingStateDoc(doc)) {
			states.playlist = doc
		} else if (isSegmentTimingStateDoc(doc)) {
			states.segments.set(doc.segmentId, doc)
		} else if (isPartTimingStateDoc(doc)) {
			states.parts.set(doc.partId, doc)
		}
	}

	return states
}
