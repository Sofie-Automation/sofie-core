import { Time } from '../common.js'

export enum PlaylistTimingType {
	None = 'none',
	ForwardTime = 'forward-time',
	BackTime = 'back-time',
	Duration = 'duration',
}

export interface PlaylistTimingBase {
	type: PlaylistTimingType
}

export interface PlaylistTimingNone extends PlaylistTimingBase {
	type: PlaylistTimingType.None
	/** Expected duration of the rundown playlist
	 *  If set, the over/under diff will be calculated based on this value. Otherwise it will be planned content duration - played out duration.
	 */
	expectedDuration?: number
}

export interface PlaylistTimingForwardTime extends PlaylistTimingBase {
	type: PlaylistTimingType.ForwardTime
	/** Expected start should be set to the expected time this rundown playlist should run on air */
	expectedStart: Time
	/** Expected duration of the rundown playlist
	 *  If set, the over/under diff will be calculated based on this value. Otherwise it will be planned content duration - played out duration.
	 */
	expectedDuration?: number
	/** Expected end time of the rundown playlist
	 *  In this timing mode this is only for display before the show starts as an "expected" end time,
	 *  during the show this display value will be calculated from expected start + remaining playlist duration.
	 *  If this is not set, `expectedDuration` will be used (if set) in addition to expectedStart.
	 */
	expectedEnd?: Time
}

export interface PlaylistTimingBackTime extends PlaylistTimingBase {
	type: PlaylistTimingType.BackTime
	/** Expected start should be set to the expected time this rundown playlist should run on air
	 *  In this timing mode this is only for display before the show starts as an "expected" start time,
	 *  during the show this display will be set to when the show actually started.
	 */
	expectedStart?: Time
	/** Expected duration of the rundown playlist
	 *  If set, the over/under diff will be calculated based on this value. Otherwise it will be planned content duration - played out duration.
	 */
	expectedDuration?: number
	/** Expected end time of the rundown playlist */
	expectedEnd: Time
}

/**
 * This mode is intended for shows with a "floating start",
 * meaning they will start based on when the show before them on the channel ends.
 * In this mode, we will preserve the Duration and automatically calculate the expectedEnd
 * based on the _actual_ start of the show (playlist.startedPlayback).
 *
 * The optional expectedStart property allows setting a start property of the show that will not affect
 * timing calculations, only purpose is to drive UI and inform the users about the preliminary plan as
 * planned in the editorial planning tool.
 */
export interface PlaylistTimingDuration extends PlaylistTimingBase {
	type: PlaylistTimingType.Duration
	/** A stipulated start time, to drive UIs pre-show, but not affecting calculations during the show.
	 */
	expectedStart?: Time
	/** Planned duration of the rundown playlist
	 *  When the show starts, an expectedEnd gets automatically calculated with this as an offset from that starting point
	 */
	expectedDuration: number
}

export type RundownPlaylistTiming =
	| PlaylistTimingNone
	| PlaylistTimingForwardTime
	| PlaylistTimingBackTime
	| PlaylistTimingDuration
