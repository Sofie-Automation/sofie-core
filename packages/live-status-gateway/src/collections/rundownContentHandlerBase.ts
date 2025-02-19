import { Logger } from 'winston'
import { CoreHandler } from '../coreHandler'
import { PublicationCollection } from '../publicationCollection'
import { CorelibPubSubCollections, CorelibPubSubTypes } from '@sofie-automation/corelib/dist/pubsub'
import { RundownId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { CollectionHandlers } from '../liveStatusServer'
import { PickKeys } from '@sofie-automation/shared-lib/dist/lib/types'
import { CollectionDocCheck } from '@sofie-automation/server-core-integration'
import { ParametersOfFunctionOrNever } from '@sofie-automation/server-core-integration/dist/lib/subscriptions'

const PLAYLIST_KEYS = ['currentPartInfo', 'nextPartInfo'] as const
type Playlist = PickKeys<DBRundownPlaylist, typeof PLAYLIST_KEYS>

type MatchingKeys<T, Args extends any[]> = {
	[K in keyof T]: T[K] extends (...args: Args) => any ? K : never
}[keyof T]

type RundownMatchingKeys = MatchingKeys<CorelibPubSubTypes, [RundownId[], (string | undefined)?]>

/**
 * For items whose `rundownId` should equal `rundownId` of the current Part (or next Part, if the firts Take was not performed)
 */
export abstract class RundownContentHandlerBase<TPubSub extends RundownMatchingKeys> extends PublicationCollection<
	CollectionDocCheck<CorelibPubSubCollections[ReturnType<CorelibPubSubTypes[TPubSub]>]>[],
	TPubSub,
	ReturnType<CorelibPubSubTypes[TPubSub]>
> {
	private _currentRundownId: RundownId | undefined

	constructor(
		collection: ReturnType<CorelibPubSubTypes[TPubSub]>,
		publication: TPubSub,
		logger: Logger,
		coreHandler: CoreHandler
	) {
		super(collection, publication, logger, coreHandler)
	}

	init(handlers: CollectionHandlers): void {
		super.init(handlers)

		handlers.playlistHandler.subscribe(this.onPlaylistUpdate, PLAYLIST_KEYS)
	}

	protected changed(): void {
		this.updateAndNotify()
	}

	private onPlaylistUpdate = (data: Playlist | undefined): void => {
		this.logUpdateReceived('playlist')
		const prevRundownId = this._currentRundownId

		const rundownPlaylist = data

		this._currentRundownId = rundownPlaylist?.currentPartInfo?.rundownId ?? rundownPlaylist?.nextPartInfo?.rundownId

		if (prevRundownId !== this._currentRundownId) {
			this.stopSubscription()
			if (this._currentRundownId) {
				const args = [[this._currentRundownId]] as unknown as ParametersOfFunctionOrNever<
					CorelibPubSubTypes[TPubSub]
				> // TODO: get rid of this type conversion
				this.setupSubscription(...args)
			}
			// no need to trigger updateAndNotify() because the subscription will take care of this
		}
	}

	private updateAndNotify(): void {
		const col = this.getCollectionOrFail()
		this._collectionData = col.find({ rundownId: this._currentRundownId })
		this.notify(this._collectionData)
	}
}
