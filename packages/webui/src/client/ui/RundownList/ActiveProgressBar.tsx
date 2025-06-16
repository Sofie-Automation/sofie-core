import { PlaylistTiming } from '@sofie-automation/corelib/dist/playout/rundownTiming'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { useCurrentTime } from '../../lib/lib.js'

export function ActiveProgressBar({
	rundownPlaylist,
}: Readonly<{ rundownPlaylist: DBRundownPlaylist }>): JSX.Element | null {
	const currentTime = useCurrentTime()

	const { startedPlayback, timing } = rundownPlaylist
	const expectedDuration = PlaylistTiming.getExpectedDuration(timing)
	if (startedPlayback && expectedDuration) {
		const progress = Math.min(((currentTime - startedPlayback) / expectedDuration) * 100, 100)

		return (
			<div className="rundown-progress-bar">
				<div className="rundown-progress-bar-indicator" style={{ width: `${progress}%` }} />
			</div>
		)
	}

	return null
}
