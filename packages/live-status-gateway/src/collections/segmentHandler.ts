import { Logger } from 'winston'
import { CoreHandler } from '../coreHandler'
import { Collection, PickArr, PublicationCollection } from '../wsHandler'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { SelectedPartInstances } from './partInstancesHandler'
import { RundownId, SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
import areElementsShallowEqual from '@sofie-automation/shared-lib/dist/lib/isShallowEqual'
import { SegmentsHandler } from './segmentsHandler'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { CorelibPubSub } from '@sofie-automation/corelib/dist/pubsub'
import { CollectionHandlers } from '../liveStatusServer'

const PLAYLIST_KEYS = ['rundownIdsInOrder'] as const
type Playlist = PickArr<DBRundownPlaylist, typeof PLAYLIST_KEYS>

const PART_INSTANCES_KEYS = ['current'] as const
type PartInstances = PickArr<SelectedPartInstances, typeof PART_INSTANCES_KEYS>

export class SegmentHandler
	extends PublicationCollection<DBSegment, CorelibPubSub.segments, CollectionName.Segments>
	implements Collection<DBSegment>
{
	private _currentSegmentId: SegmentId | undefined
	private _rundownIds: RundownId[] = []

	constructor(logger: Logger, coreHandler: CoreHandler, private _segmentsHandler: SegmentsHandler) {
		super(CollectionName.Segments, CorelibPubSub.segments, logger, coreHandler)
	}

	init(handlers: CollectionHandlers): void {
		super.init(handlers)

		handlers.playlistHandler.subscribe(this.onPlaylistUpdate, PLAYLIST_KEYS)
		handlers.partInstancesHandler.subscribe(this.onPartInstancesUpdate, PART_INSTANCES_KEYS)
	}

	protected changed(): void {
		this.updateAndNotify()
	}

	private updateAndNotify() {
		const collection = this.getCollectionOrFail()
		const allSegments = collection.find(undefined)
		this._segmentsHandler.setSegments(allSegments)
		if (this._currentSegmentId && collection.findOne(this._currentSegmentId) !== this._collectionData) {
			this.updateAndNotifyCurrentSegment()
		}
	}

	private updateAndNotifyCurrentSegment() {
		const collection = this.getCollectionOrFail()
		if (this._currentSegmentId) {
			this._collectionData = collection.findOne(this._currentSegmentId)
			this.notify(this._collectionData)
		}
	}

	private onPlaylistUpdate = (playlist: Playlist | undefined): void => {
		const previousRundownIds = this._rundownIds

		this.logUpdateReceived('playlist')
		this._rundownIds = playlist?.rundownIdsInOrder ?? []

		const rundownsChanged = !areElementsShallowEqual(this._rundownIds, previousRundownIds)
		if (rundownsChanged) {
			this.stopSubscription()
			if (this._rundownIds.length) {
				this.setupSubscription(this._rundownIds, {
					omitHidden: true,
				})
			}
		}
	}

	private onPartInstancesUpdate = (data: PartInstances | undefined): void => {
		this.logUpdateReceived('partInstances')

		const previousSegmentId = this._currentSegmentId
		this._currentSegmentId = data?.current?.segmentId

		if (previousSegmentId !== this._currentSegmentId) {
			this.updateAndNotifyCurrentSegment()
		}
	}
}
