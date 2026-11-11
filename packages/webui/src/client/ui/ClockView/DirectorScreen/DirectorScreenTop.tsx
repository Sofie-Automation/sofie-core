import { PlannedEndComponent, TimeToFromPlannedEndComponent } from '../../../lib/Components/CounterComponents'
import { TimerValueMode, usePlaylistTimingValue } from '../../RundownView/RundownTiming/usePlaylistTimingValue.js'
import type { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist/RundownPlaylist'
import { useTranslation } from 'react-i18next'
import { OverUnderChip } from '../../../lib/Components/OverUnderChip.js'

export interface DirectorScreenTopProps {
	playlist: DBRundownPlaylist
}

export function DirectorScreenTop({ playlist }: Readonly<DirectorScreenTopProps>): JSX.Element {
	const { t } = useTranslation()

	const timeInHand = usePlaylistTimingValue(playlist._id, 'overUnder', TimerValueMode.Duration)
	// the published value is the time in hand; this display is over-positive
	const overUnderClock = timeInHand === null ? 0 : 0 - timeInHand
	const rehearsalInProgress = Boolean(playlist.rehearsal && playlist.startedPlayback)

	const estimatedEndValue = usePlaylistTimingValue(playlist._id, 'estimatedEnd', TimerValueMode.Timestamp)
	const remainingDurationValue = usePlaylistTimingValue(playlist._id, 'remainingDuration', TimerValueMode.Duration)

	const estimatedEnd = estimatedEndValue ?? undefined
	const remainingDuration = remainingDurationValue ?? undefined

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
