import { Logger } from 'winston'
import { WebSocket } from 'ws'
import { unprotectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import { DBStudio } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { literal } from '@sofie-automation/shared-lib/dist/lib/lib'
import { WebSocketTopicBase, WebSocketTopic } from '../wsHandler'
import { CollectionHandlers } from '../liveStatusServer'
import _ = require('underscore')

type PlaylistActivationStatus = 'deactivated' | 'rehearsal' | 'activated'

interface PlaylistStatus {
	id: string
	name: string
	activationStatus: PlaylistActivationStatus
}

interface StudioStatus {
	event: string
	id: string | null
	name: string
	playlists: PlaylistStatus[]
}

export class StudioTopic extends WebSocketTopicBase implements WebSocketTopic {
	private _studio: DBStudio | undefined
	private _playlists: PlaylistStatus[] = []
	private _lastSentPlaylists: PlaylistStatus[] = []

	constructor(logger: Logger, handlers: CollectionHandlers) {
		super(StudioTopic.name, logger)

		handlers.studioHandler.subscribe(this.onStudioUpdate)
		handlers.playlistsHandler.subscribe(this.onPlaylistsUpdate)
	}

	sendStatus(subscribers: Iterable<WebSocket>): void {
		const studioStatus: StudioStatus = this._studio
			? {
					event: 'studio',
					id: unprotectString(this._studio._id),
					name: this._studio.name,
					playlists: this._playlists,
			  }
			: {
					event: 'studio',
					id: null,
					name: '',
					playlists: [],
			  }

		this.sendMessage(subscribers, studioStatus)
	}

	private onStudioUpdate = (studio: DBStudio | undefined): void => {
		this.logUpdateReceived('studio', `studioId ${studio?._id}`)
		this._studio = studio
		this.sendStatusToAll()
	}

	private onPlaylistsUpdate = (rundownPlaylists: DBRundownPlaylist[] | undefined): void => {
		this.logUpdateReceived('playlists')
		this._playlists =
			rundownPlaylists?.map((p) => {
				let activationStatus: PlaylistActivationStatus =
					p.activationId === undefined ? 'deactivated' : 'activated'
				if (p.activationId && p.rehearsal) activationStatus = 'rehearsal'
				return literal<PlaylistStatus>({
					id: unprotectString(p._id),
					name: p.name,
					activationStatus: activationStatus,
				})
			}) ?? []
		this.sendStatusToAll()
	}

	protected sendStatusToAll = (): void => {
		const sameStatus =
			this._playlists.length === this._lastSentPlaylists.length &&
			_.isEqual(this._playlists, this._lastSentPlaylists)
		if (!sameStatus) {
			this.sendStatus(this._subscribers)
			this._lastSentPlaylists = this._playlists
		}
	}
}
