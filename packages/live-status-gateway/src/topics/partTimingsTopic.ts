import { Logger } from 'winston'
import { WebSocket } from 'ws'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist/RundownPlaylist'
import { unprotectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import { PickKeys } from '@sofie-automation/shared-lib/dist/lib/types'
import { PartTimingsEvent } from '@sofie-automation/live-status-gateway-api'
import { WebSocketTopicBase, WebSocketTopic } from '../wsHandler.js'
import { CollectionHandlers } from '../liveStatusServer.js'
import type { PlaylistTimingStates } from '../collections/playlistTimingStatesHandler.js'
import { toPartTiming } from './helpers/partTiming.js'

const THROTTLE_PERIOD_MS = 100

const PLAYLIST_KEYS = ['_id'] as const
type Playlist = PickKeys<DBRundownPlaylist, typeof PLAYLIST_KEYS>

/**
 * Publishes the `partTimings` topic: the timing of each Part of the active playlist, as Sofie resolved it.
 *
 * It is built from the timing publication alone, so that its timing does not wait for the playlist's
 * structure, nor the structure for its timing. A message is one calculation of Sofie's, so it is
 * consistent in itself; its `currentPartInstanceId` tells a consumer which on-air part it describes.
 */
export class PartTimingsTopic extends WebSocketTopicBase implements WebSocketTopic {
	private _activePlaylist: Playlist | undefined
	private _timingStates: PlaylistTimingStates | undefined

	constructor(logger: Logger, handlers: CollectionHandlers) {
		super(PartTimingsTopic.name, logger, THROTTLE_PERIOD_MS)

		handlers.playlistHandler.subscribe(this.onPlaylistUpdate, PLAYLIST_KEYS)
		handlers.playlistTimingStatesHandler.subscribe(this.onTimingStatesUpdate)
	}

	sendStatus(subscribers: Iterable<WebSocket>): void {
		const playlistId = this._activePlaylist?._id

		// After a switch of playlist, the previous playlist's documents can still be held until the new
		// subscription delivers, and they must not be reported as this playlist's
		const playlistTiming =
			this._timingStates?.playlist?.playlistId === playlistId ? this._timingStates?.playlist : undefined
		const partTimings = Array.from(this._timingStates?.parts.values() ?? [])
			.filter((timing) => timing.playlistId === playlistId)
			.sort((a, b) => a.rank - b.rank)

		const message: PartTimingsEvent = {
			event: 'partTimings',
			rundownPlaylistId: playlistId ? unprotectString(playlistId) : null,
			currentPartInstanceId: playlistTiming?.currentPartInstanceId
				? unprotectString(playlistTiming.currentPartInstanceId)
				: null,
			parts: partTimings.map((timing) => toPartTiming(timing, playlistTiming)),
		}

		this.sendMessage(subscribers, message)
	}

	/** The playlist handler holds the active playlist only */
	private onPlaylistUpdate = (rundownPlaylist: Playlist | undefined): void => {
		this.logUpdateReceived('playlist', `rundownPlaylistId ${rundownPlaylist?._id}`)
		this._activePlaylist = rundownPlaylist
		this.throttledSendStatusToAll()
	}

	private onTimingStatesUpdate = (timingStates: PlaylistTimingStates | undefined): void => {
		this.logUpdateReceived('playlistTimingStates')
		this._timingStates = timingStates
		this.throttledSendStatusToAll()
	}
}
