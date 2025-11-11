import { Logger } from 'winston'
import { CoreHandler } from '../coreHandler.js'
import { PublicationCollection } from '../publicationCollection.js'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { SelectedPartInstances } from './partInstancesHandler.js'
import { PartsHandler } from './partsHandler.js'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
import { CorelibPubSub } from '@sofie-automation/corelib/dist/pubsub'
import { CollectionHandlers } from '../liveStatusServer.js'
import { PickKeys } from '@sofie-automation/shared-lib/dist/lib/types'

const PLAYLIST_KEYS = ['_id', 'rundownIdsInOrder'] as const
type Playlist = PickKeys<DBRundownPlaylist, typeof PLAYLIST_KEYS>

const PART_INSTANCES_KEYS = ['current'] as const
type PartInstances = PickKeys<SelectedPartInstances, typeof PART_INSTANCES_KEYS>

export class PartHandler extends PublicationCollection<DBPart, CorelibPubSub.parts, CollectionName.Parts> {
	private _activePlaylist: Playlist | undefined
	private _currentPartInstance: DBPartInstance | undefined

	constructor(
		logger: Logger,
		coreHandler: CoreHandler,
		private _partsHandler: PartsHandler
	) {
		super(CollectionName.Parts, CorelibPubSub.parts, logger, coreHandler)
	}

	init(handlers: CollectionHandlers): void {
		super.init(handlers)

		handlers.playlistHandler.subscribe(this.onPlaylistUpdate, PLAYLIST_KEYS)
		handlers.partInstancesHandler.subscribe(this.onPartInstanceUpdate, PART_INSTANCES_KEYS)
	}

	protected changed(): void {
		const collection = this.getCollectionOrFail()
		const allParts = collection.find(undefined)
		this._partsHandler.setParts(allParts)
		if (this._collectionData) {
			this._collectionData = collection.findOne(this._collectionData._id)
			this.notify(this._collectionData)
		}
	}

	private onPlaylistUpdate = (rundownPlaylist: Playlist | undefined): void => {
		this.logUpdateReceived('playlist', `rundownPlaylistId ${rundownPlaylist?._id}`)
		this._activePlaylist = rundownPlaylist

		this.stopSubscription()
		if (this._activePlaylist) {
			const rundownIds = this._activePlaylist.rundownIdsInOrder
			this.setupSubscription(rundownIds, null)
		}
	}

	private onPartInstanceUpdate = (partInstances: PartInstances | SelectedPartInstances | undefined): void => {
		if (!partInstances) return

		this.logUpdateReceived('partInstances')
		this._currentPartInstance = partInstances.current

		const collection = this.getCollectionOrFail()

		if (this._currentPartInstance) {
			this._collectionData = collection.findOne(this._currentPartInstance.part._id)
			this.notify(this._collectionData)
		}
	}
}
