import { Time } from '../common.js'

export enum PlaylistTimingType {
	None = 'none',
	ForwardTime = 'forward-time',
	BackTime = 'back-time',
}

export interface PlaylistTimingBase {
	type: PlaylistTimingType
}

export interface PlaylistTimingNone {
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

export type RundownPlaylistTiming = PlaylistTimingNone | PlaylistTimingForwardTime | PlaylistTimingBackTime
