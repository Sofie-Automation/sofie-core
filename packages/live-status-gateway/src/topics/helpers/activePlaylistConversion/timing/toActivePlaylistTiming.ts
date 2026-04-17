import { literal } from '@sofie-automation/shared-lib/dist/lib/lib'
import { PlaylistTimingType } from '@sofie-automation/blueprints-integration'
import type { ActivePlaylistEvent } from '@sofie-automation/live-status-gateway-api'
import type { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist/RundownPlaylist'

import { translatePlaylistTimingType } from './translatePlaylistTimingType.js'

/**
 * Properties required to convert playlist timing into API timing.
 *
 * @typedef {object} ToActivePlaylistTimingProps
 */
type ToActivePlaylistTimingProps = {
	startedPlaybackState: DBRundownPlaylist['startedPlayback']
	timingState: DBRundownPlaylist['timing']
}

/**
 * Converts internal playlist timing fields into API `ActivePlaylistEvent.timing`.
 *
 * @param {ToActivePlaylistTimingProps} props Playlist timing source fields.
 * @returns {ActivePlaylistEvent['timing']} Converted timing payload.
 */
export function toActivePlaylistTiming({
	startedPlaybackState,
	timingState,
}: ToActivePlaylistTimingProps): ActivePlaylistEvent['timing'] {
	const timingMode = translatePlaylistTimingType(timingState.type)
	const expectedStart = timingState.type !== PlaylistTimingType.None ? timingState.expectedStart : undefined
	const expectedEnd = timingState.type !== PlaylistTimingType.None ? timingState.expectedEnd : undefined

	return literal<ActivePlaylistEvent['timing']>({
		timingMode,
		startedPlayback: startedPlaybackState,
		expectedDurationMs: timingState.expectedDuration,
		expectedStart,
		expectedEnd,
	})
}
