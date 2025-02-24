import { Logger } from 'winston'
import { CoreHandler } from '../coreHandler'
import { PublicationCollection } from '../publicationCollection'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
import areElementsShallowEqual from '@sofie-automation/shared-lib/dist/lib/isShallowEqual'
import _ = require('underscore')
import throttleToNextTick from '@sofie-automation/shared-lib/dist/lib/throttleToNextTick'
import { CorelibPubSub } from '@sofie-automation/corelib/dist/pubsub'
import { RundownId, RundownPlaylistActivationId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { CollectionHandlers } from '../liveStatusServer'
import { PickKeys } from '@sofie-automation/shared-lib/dist/lib/types'

export interface SelectedPartInstances {
	previous: DBPartInstance | undefined
	current: DBPartInstance | undefined
	next: DBPartInstance | undefined
	firstInSegmentPlayout: DBPartInstance | undefined
	inCurrentSegment: DBPartInstance[]
}

const PLAYLIST_KEYS = [
	'_id',
	'activationId',
	'previousPartInfo',
	'currentPartInfo',
	'nextPartInfo',
	'rundownIdsInOrder',
] as const
type Playlist = PickKeys<DBRundownPlaylist, typeof PLAYLIST_KEYS>

export class PartInstancesHandler extends PublicationCollection<
	SelectedPartInstances,
	CorelibPubSub.partInstances,
	CollectionName.PartInstances
> {
	private _currentPlaylist: Playlist | undefined
	private _rundownIds: RundownId[] = []
	private _activationId: RundownPlaylistActivationId | undefined

	private _throttledUpdateAndNotify = throttleToNextTick(() => {
		this.updateCollectionData()
		this.notify(this._collectionData)
	})

	constructor(logger: Logger, coreHandler: CoreHandler) {
		super(CollectionName.PartInstances, CorelibPubSub.partInstances, logger, coreHandler)
		this._collectionData = {
			previous: undefined,
			current: undefined,
			next: undefined,
			firstInSegmentPlayout: undefined,
			inCurrentSegment: [],
		}
	}

	init(handlers: CollectionHandlers): void {
		super.init(handlers)

		handlers.playlistHandler.subscribe(this.onPlaylistUpdate, PLAYLIST_KEYS)
	}

	protected changed(): void {
		this._throttledUpdateAndNotify()
	}

	private updateCollectionData(): boolean {
		if (!this._collectionData) return false
		const collection = this.getCollectionOrFail()
		const previousPartInstance = this._currentPlaylist?.previousPartInfo?.partInstanceId
			? collection.findOne(this._currentPlaylist.previousPartInfo.partInstanceId)
			: undefined
		const currentPartInstance = this._currentPlaylist?.currentPartInfo?.partInstanceId
			? collection.findOne(this._currentPlaylist.currentPartInfo.partInstanceId)
			: undefined
		const nextPartInstance = this._currentPlaylist?.nextPartInfo?.partInstanceId
			? collection.findOne(this._currentPlaylist.nextPartInfo.partInstanceId)
			: undefined
		const partInstancesInSegmentPlayout = currentPartInstance
			? collection.find({ segmentPlayoutId: currentPartInstance.segmentPlayoutId })
			: []

		const firstPartInstanceInSegmentPlayout = _.min(
			partInstancesInSegmentPlayout,
			(partInstance) => partInstance.takeCount
		) as DBPartInstance

		let hasAnythingChanged = false
		if (previousPartInstance !== this._collectionData.previous) {
			this._collectionData.previous = previousPartInstance
			hasAnythingChanged = true
		}
		if (currentPartInstance !== this._collectionData.current) {
			this._collectionData.current = currentPartInstance
			hasAnythingChanged = true
		}
		if (this._collectionData.next !== nextPartInstance) {
			this._collectionData.next = nextPartInstance
			hasAnythingChanged = true
		}
		if (this._collectionData.firstInSegmentPlayout !== firstPartInstanceInSegmentPlayout) {
			this._collectionData.firstInSegmentPlayout = firstPartInstanceInSegmentPlayout
			hasAnythingChanged = true
		}
		if (!areElementsShallowEqual(this._collectionData.inCurrentSegment, partInstancesInSegmentPlayout)) {
			this._collectionData.inCurrentSegment = partInstancesInSegmentPlayout
			hasAnythingChanged = true
		}
		return hasAnythingChanged
	}

	private clearCollectionData() {
		if (!this._collectionData) return
		this._collectionData = {
			previous: undefined,
			current: undefined,
			next: undefined,
			firstInSegmentPlayout: undefined,
			inCurrentSegment: [],
		}
	}

	private onPlaylistUpdate = (data: Playlist | undefined): void => {
		const prevRundownIds = [...this._rundownIds]
		const prevActivationId = this._activationId

		this.logUpdateReceived(
			'playlist',
			`rundownPlaylistId ${data?._id}, active ${data?.activationId ? true : false}`
		)
		this._currentPlaylist = data

		this._rundownIds = this._currentPlaylist ? this._currentPlaylist.rundownIdsInOrder : []
		this._activationId = this._currentPlaylist?.activationId
		if (this._currentPlaylist && this._rundownIds.length && this._activationId) {
			const sameSubscription =
				areElementsShallowEqual(this._rundownIds, prevRundownIds) && prevActivationId === this._activationId
			if (!sameSubscription) {
				this.stopSubscription()
				this.setupSubscription(this._rundownIds, this._activationId)
			} else if (this._subscriptionId) {
				this.updateAndNotify()
			} else {
				this.clearAndNotify()
			}
		} else {
			this.clearAndNotify()
		}
	}

	private clearAndNotify() {
		this.clearCollectionData()
		this.notify(this._collectionData)
	}

	private updateAndNotify() {
		const hasAnythingChanged = this.updateCollectionData()
		if (hasAnythingChanged) {
			this.notify(this._collectionData)
		}
	}
}
