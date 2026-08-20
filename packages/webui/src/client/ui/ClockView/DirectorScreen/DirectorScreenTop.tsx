import { PlannedEndComponent, TimeToFromPlannedEndComponent } from '../../../lib/Components/CounterComponents'
import { useTiming } from '../../RundownView/RundownTiming/withTiming.js'
import { getPlaylistTimingDiff } from '../../../lib/rundownTiming.js'
import { PlaylistTiming } from '@sofie-automation/corelib/dist/playout/rundownTiming'
import type { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist/RundownPlaylist'
import { getCurrentTime } from '../../../lib/systemTime.js'
import { useTranslation } from 'react-i18next'
import { OverUnderChip } from '../../../lib/Components/OverUnderChip.js'

export interface DirectorScreenTopProps {
	playlist: DBRundownPlaylist
}

export function DirectorScreenTop({ playlist }: Readonly<DirectorScreenTopProps>): JSX.Element {
	const timingDurations = useTiming()
	const { t } = useTranslation()

	const now = timingDurations.currentTime ?? getCurrentTime()
	const overUnderClock = getPlaylistTimingDiff(playlist, timingDurations) ?? 0
	const rehearsalInProgress = Boolean(playlist.rehearsal && playlist.startedPlayback)

	const startedPlayback = playlist.activationId ? playlist.startedPlayback : undefined

	const estimatedEnd = PlaylistTiming.getEstimatedEnd(
		playlist.timing,
		now,
		timingDurations.remainingPlaylistDuration,
		startedPlayback
	)

	const remainingDuration = PlaylistTiming.getRemainingDuration(
		playlist.timing,
		now,
		timingDurations.remainingPlaylistDuration,
		startedPlayback
	)

	return (
		<>
			<div className="director-screen__top">
				{estimatedEnd !== undefined ? (
					<div className="director-screen__top__planned-end">
						<div>
							<PlannedEndComponent value={estimatedEnd} />
						</div>
						{rehearsalInProgress ? t('Rehearsal end') : t('Estimated end')}
					</div>
				) : null}

				{remainingDuration !== undefined ? (
					<div className="director-screen__top__planned-container director-screen__top__center">
						<div>
							<TimeToFromPlannedEndComponent value={-remainingDuration} />
						</div>
						<span className="director-screen__top__center">
							{rehearsalInProgress
								? remainingDuration >= 0
									? t('Time to rehearsal end')
									: t('Time since rehearsal end')
								: t('Remaining duration')}
						</span>
					</div>
				) : null}
				<div className="director-screen__top__spacer"></div>
			</div>
			<OverUnderChip className="screen-timing-clock over-under-chip--overlay" valueMs={overUnderClock} />
		</>
	)
}
