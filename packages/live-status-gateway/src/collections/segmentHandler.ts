import { Logger } from 'winston'
import { CoreHandler } from '../coreHandler'
import { CollectionBase, Collection, CollectionObserver } from '../wsHandler'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { PartInstancesHandler, SelectedPartInstances } from './partInstancesHandler'
import { RundownId, SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
import areElementsShallowEqual from '@sofie-automation/shared-lib/dist/lib/isShallowEqual'
import { SegmentsHandler } from './segmentsHandler'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { PlaylistHandler } from './playlistHandler'
import { CorelibPubSub } from '@sofie-automation/corelib/dist/pubsub'

export class SegmentHandler
	extends CollectionBase<DBSegment, CorelibPubSub.segments, CollectionName.Segments>
	implements Collection<DBSegment>, CollectionObserver<SelectedPartInstances>, CollectionObserver<DBRundownPlaylist>
{
	public observerName: string
	private _currentSegmentId: SegmentId | undefined
	private _rundownIds: RundownId[] = []

	constructor(logger: Logger, coreHandler: CoreHandler, private _segmentsHandler: SegmentsHandler) {
		super(SegmentHandler.name, CollectionName.Segments, CorelibPubSub.segments, logger, coreHandler)
		this.observerName = this._name
	}

	async changed(id: SegmentId, changeType: string): Promise<void> {
		this.logDocumentChange(id, changeType)
		if (!this._collectionName) return
		const collection = this._core.getCollection(this._collectionName)
		if (!collection) throw new Error(`collection '${this._collectionName}' not found!`)
		const allSegments = collection.find(undefined)
		await this._segmentsHandler.setSegments(allSegments)
		await this.updateAndNotify()
	}

	private async updateAndNotify() {
		const collection = this._core.getCollection(this._collectionName)
		const newData = this._currentSegmentId ? collection.findOne(this._currentSegmentId) : undefined
		if (this._collectionData !== newData) {
			this._collectionData = newData
			await this.notify(this._collectionData)
		}
	}

	async update(source: string, data: SelectedPartInstances | DBRundownPlaylist | undefined): Promise<void> {
		const previousRundownIds = this._rundownIds

		switch (source) {
			case PartInstancesHandler.name: {
				this.logUpdateReceived('partInstances', source)
				const partInstanceMap = data as SelectedPartInstances
				this._currentSegmentId = data ? partInstanceMap.current?.segmentId : undefined
				break
			}
			case PlaylistHandler.name: {
				this.logUpdateReceived('playlist', source)
				this._rundownIds = (data as DBRundownPlaylist | undefined)?.rundownIdsInOrder ?? []
				break
			}
			default:
				throw new Error(`${this._name} received unsupported update from ${source}}`)
		}
		await new Promise(process.nextTick.bind(this))
		if (!this._collectionName) return
		if (!this._publicationName) return

		const rundownsChanged = !areElementsShallowEqual(this._rundownIds, previousRundownIds)
		if (rundownsChanged) {
			if (this._subscriptionId) this._coreHandler.unsubscribe(this._subscriptionId)
			if (this._dbObserver) this._dbObserver.stop()
			if (this._rundownIds.length) {
				this._subscriptionId = await this._coreHandler.setupSubscription(
					this._publicationName,
					this._rundownIds,
					{
						omitHidden: true,
					}
				)
				this._dbObserver = this._coreHandler.setupObserver(this._collectionName)
				this._dbObserver.added = (id) => {
					void this.changed(id, 'added').catch(this._logger.error)
				}
				this._dbObserver.changed = (id) => {
					void this.changed(id, 'changed').catch(this._logger.error)
				}
				this._dbObserver.removed = (id) => {
					void this.changed(id, 'removed').catch(this._logger.error)
				}
			}
		}

		const collection = this._core.getCollection(this._collectionName)
		if (!collection) throw new Error(`collection '${this._collectionName}' not found!`)
		if (rundownsChanged) {
			const allSegments = collection.find(undefined)
			await this._segmentsHandler.setSegments(allSegments)
		}
		await this.updateAndNotify()
	}
}
