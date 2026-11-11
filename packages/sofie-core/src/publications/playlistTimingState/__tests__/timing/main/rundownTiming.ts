/**
 * Main's over/under, frozen for the comparison with main: getPlaylistTimingDiff, copied unchanged from
 * packages/webui/src/client/lib/rundownTiming.ts at main d40ae733fefdd831ce614792b65e8434778b2757. Only the imports
 * differ: PlaylistTiming is main's (the frozen copy next to this file), the timing context is the calculator's, which
 * moved into the server with its tests, and the clock is the server's.
 *
 * The timing publication replaced this function with a time-in-hand timer state. Main's header, Director screen,
 * Prompter and shelf showed this function's value as the over/under. The function is lines 738 to 797 of that file; to
 * see that it is unchanged, set them beside the function below:
 *
 *   git show d40ae733f:packages/webui/src/client/lib/rundownTiming.ts | sed -n 738,797p
 */

import type { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist/RundownPlaylist'
import { getCurrentTime } from '../../../../../lib/lib'
import type { RundownTimingContext } from '../../../rundownTiming'
import { PlaylistTiming } from './playlistTiming'

export function getPlaylistTimingDiff(
	playlist: Pick<DBRundownPlaylist, 'timing' | 'startedPlayback' | 'activationId'>,
	timingContext: RundownTimingContext
): number | undefined {
	const { timing, startedPlayback, activationId } = playlist
	const active = !!activationId
	const currentTime = timingContext.currentTime || getCurrentTime()
	let frontAnchor: number = currentTime
	let backAnchor: number = currentTime
	if (PlaylistTiming.isPlaylistTimingForwardTime(timing)) {
		backAnchor =
			timing.expectedEnd ??
			(startedPlayback ?? Math.max(timing.expectedStart, currentTime)) +
				(timing.expectedDuration ?? timingContext.totalPlaylistDuration ?? 0)
		frontAnchor = Math.max(currentTime, playlist.startedPlayback ?? Math.max(timing.expectedStart, currentTime))
	} else if (PlaylistTiming.isPlaylistTimingBackTime(timing)) {
		backAnchor = timing.expectedEnd
	}

	let diff = 0
	if (PlaylistTiming.isPlaylistTimingNone(timing)) {
		diff =
			(timingContext.asPlayedPlaylistDuration || 0) -
			(timing.expectedDuration ?? timingContext.totalPlaylistDuration ?? 0)
	} else if (PlaylistTiming.isPlaylistDurationTimed(timing)) {
		diff =
			(timingContext.asPlayedPlaylistDuration || 0) -
			(timing.expectedDuration ?? timingContext.totalPlaylistDuration ?? 0)
	} else {
		diff = frontAnchor + (timingContext.remainingPlaylistDuration || 0) - backAnchor
	}

	// handle special cases

	// the rundown has been played out and now has been deactivated
	if (!active && startedPlayback) {
		if (PlaylistTiming.isPlaylistTimingForwardTime(timing)) {
			// we want to know how heavy/light we were compared to the original plan
			diff =
				(timingContext.asPlayedPlaylistDuration || 0) -
				(timing.expectedDuration ?? timingContext.totalPlaylistDuration ?? 0)

			if (timing.expectedEnd) {
				diff = startedPlayback + (timingContext.asPlayedPlaylistDuration || 0) - timing.expectedEnd
			}
		} else if (PlaylistTiming.isPlaylistTimingNone(timing)) {
			//  we want to know how heavy/light we were compared to the original plan
			diff =
				(timingContext.asPlayedPlaylistDuration || 0) -
				(timing.expectedDuration ?? timingContext.totalPlaylistDuration ?? 0)
		} else if (PlaylistTiming.isPlaylistDurationTimed(timing)) {
			//  we want to know how heavy/light we were compared to the original plan
			diff =
				(timingContext.asPlayedPlaylistDuration || 0) -
				(timing.expectedDuration ?? timingContext.totalPlaylistDuration ?? 0)
		}
	}

	return diff
}
