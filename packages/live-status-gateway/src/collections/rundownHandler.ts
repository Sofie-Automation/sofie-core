import { Logger } from 'winston'
import { CoreHandler } from '../coreHandler.js'
import { PublicationCollection } from '../publicationCollection.js'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { RundownId, RundownPlaylistId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
import { RundownsHandler } from './rundownsHandler.js'
import { CorelibPubSub } from '@sofie-automation/corelib/dist/pubsub'
import { unprotectString } from '@sofie-automation/server-core-integration'
import { CollectionHandlers } from '../liveStatusServer.js'
import { PickKeys } from '@sofie-automation/shared-lib/dist/lib/types'

const PLAYLIST_KEYS = ['_id', 'currentPartInfo', 'nextPartInfo'] as const
type Playlist = PickKeys<DBRundownPlaylist, typeof PLAYLIST_KEYS>

export class RundownHandler extends PublicationCollection<
	DBRundown,
	CorelibPubSub.rundownsInPlaylists,
	CollectionName.Rundowns
> {
	private _currentPlaylistId: RundownPlaylistId | undefined
	private _currentRundownId: RundownId | undefined

	constructor(
		logger: Logger,
		coreHandler: CoreHandler,
		private _rundownsHandler?: RundownsHandler
	) {
		super(CollectionName.Rundowns, CorelibPubSub.rundownsInPlaylists, logger, coreHandler)
	}

	init(handlers: CollectionHandlers): void {
		super.init(handlers)

		handlers.playlistHandler.subscribe(this.onPlaylistUpdate, PLAYLIST_KEYS)
	}

	protected changed(): void {
		this.updateAndNotify()
	}

	private updateAndNotify(): void {
		const collection = this.getCollectionOrFail()
		this._rundownsHandler?.setRundowns(collection.find(undefined))
		if (this._currentRundownId) {
			this._collectionData = collection.findOne(this._currentRundownId)
		} else {
			this._collectionData = undefined
		}
		this.notify(this._collectionData)
	}

	private onPlaylistUpdate = (data: Playlist | undefined): void => {
		const prevPlaylistId = this._currentPlaylistId
		const prevCurRundownId = this._currentRundownId
		const rundownPlaylist = data

		this.logUpdateReceived('playlist', unprotectString(rundownPlaylist?._id))
		this._currentPlaylistId = rundownPlaylist?._id
		this._currentRundownId = rundownPlaylist?.currentPartInfo?.rundownId ?? rundownPlaylist?.nextPartInfo?.rundownId

		if (prevPlaylistId !== this._currentPlaylistId) {
			this.stopSubscription()
			if (this._currentPlaylistId) {
				this.setupSubscription([this._currentPlaylistId])
			}
			return
		}

		if (prevCurRundownId !== this._currentRundownId) {
			this.updateAndNotify()
		}
	}
}
