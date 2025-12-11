import { useTranslation } from 'react-i18next'
import ClassNames from 'classnames'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { LoopingIcon } from '../../../lib/ui/icons/looping.js'
import { Rundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { RundownUtils } from '../../../lib/rundown.js'
import { getCurrentTime } from '../../../lib/systemTime.js'
import { PlaylistTiming } from '@sofie-automation/corelib/dist/playout/rundownTiming'
import { isLoopDefined } from '../../../lib/RundownResolver.js'

interface IRundownNameProps {
	rundownPlaylist: DBRundownPlaylist
	currentRundown?: Rundown
	rundownCount: number
	hideDiff?: boolean
}

export function RundownName({
	rundownPlaylist,
	currentRundown,
	rundownCount,
	hideDiff,
}: IRundownNameProps): JSX.Element {
	const { t } = useTranslation()

	const expectedStart = PlaylistTiming.getExpectedStart(rundownPlaylist.timing)
	const isPlaylistLooping = isLoopDefined(rundownPlaylist)

	return (
		<div
			className={ClassNames('timing-clock countdown left', {
				'plan-start': !(
					rundownPlaylist.startedPlayback &&
					rundownPlaylist.activationId &&
					!rundownPlaylist.activationId
				),
				'playback-started': !(
					rundownPlaylist.startedPlayback &&
					rundownPlaylist.activationId &&
					!rundownPlaylist.activationId
				),
				heavy: expectedStart && getCurrentTime() > expectedStart,
			})}
		>
			{currentRundown && (rundownPlaylist.name !== currentRundown.name || rundownCount > 1) ? (
				<h1
					className="timing-clock-label left hide-overflow rundown-name"
					title={
						isPlaylistLooping
							? t('{{currentRundownName}} - {{rundownPlaylistName}} (Looping)', {
									currentRundownName: currentRundown.name,
									rundownPlaylistName: rundownPlaylist.name,
								})
							: t('{{currentRundownName}} - {{rundownPlaylistName}}', {
									currentRundownName: currentRundown.name,
									rundownPlaylistName: rundownPlaylist.name,
								})
					}
					id="rundown-playlist-name"
				>
					{isPlaylistLooping && <LoopingIcon />} <strong>{currentRundown.name}</strong> {rundownPlaylist.name}
				</h1>
			) : (
				<h1
					className="timing-clock-label left hide-overflow rundown-name"
					title={
						isPlaylistLooping
							? t('{{rundownPlaylistName}} (Looping)', {
									rundownPlaylistName: rundownPlaylist.name,
								})
							: rundownPlaylist.name
					}
					id="rundown-playlist-name"
				>
					{isPlaylistLooping && <LoopingIcon />} {rundownPlaylist.name}
				</h1>
			)}
			{!hideDiff && rundownPlaylist.startedPlayback && rundownPlaylist.activationId && !rundownPlaylist.rehearsal
				? expectedStart &&
					RundownUtils.formatDiffToTimecode(
						rundownPlaylist.startedPlayback - expectedStart,
						true,
						false,
						true,
						true,
						true
					)
				: expectedStart &&
					RundownUtils.formatDiffToTimecode(getCurrentTime() - expectedStart, true, false, true, true, true)}
		</div>
	)
}
