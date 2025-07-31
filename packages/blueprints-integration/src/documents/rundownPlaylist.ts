import type { Time } from '../common.js'
import type { RundownPlaylistTiming } from './playlistTiming.js'

/** Playlist, as generated from Blueprints */

export interface IBlueprintResultRundownPlaylist {
	/** Rundown playlist slug - user-presentable name */
	name: string

	/** Playlist timing information */
	timing: RundownPlaylistTiming
	/** Should the rundown playlist use out-of-order timing mode (unplayed content will be played eventually) as opposed to normal timing mode (unplayed content behind the OnAir line has been skipped) */
	outOfOrderTiming?: boolean
	/** Should the rundown playlist loop at the end */
	loop?: boolean
	/** Should time-of-day clocks be used instead of countdowns by default */
	timeOfDayCountdowns?: boolean

	/** Arbitraty data storage for internal use in the blueprints */
	privateData?: unknown
	/** Arbitraty data relevant for other systems and exposed to them via APIs */
	publicData?: unknown
}

/** Playlist, when reported from Core  */
export interface IBlueprintRundownPlaylist extends IBlueprintResultRundownPlaylist {
	_id: string
	/** External ID (source) of the playlist */
	externalId: string
	created: Time
	modified: Time
	/** If the playlist is active or not */
	isActive: boolean
	/** Is the playlist in rehearsal mode (can be used, when active: true) */
	rehearsal: boolean
	/** Actual time of playback starting */
	startedPlayback?: Time

	/** The number of rundowns in the playlist */
	rundownCount: number
}
