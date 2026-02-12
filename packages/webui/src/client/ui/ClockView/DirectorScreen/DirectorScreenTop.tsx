import {
	OverUnderClockComponent,
	PlannedEndComponent,
	TimeSincePlannedEndComponent,
	TimeToPlannedEndComponent,
} from '../../../lib/Components/CounterComponents'
import { useTiming } from '../../RundownView/RundownTiming/withTiming'
import { getPlaylistTimingDiff } from '../../../lib/rundownTiming'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { getCurrentTime } from '../../../lib/systemTime'
import { useTranslation } from 'react-i18next'
import { PlaylistTiming } from '@sofie-automation/corelib/dist/playout/rundownTiming'
import { PartInstance } from '@sofie-automation/meteor-lib/dist/collections/PartInstances'

export interface DirectorScreenTopProps {
	playlist: DBRundownPlaylist
	partInstanceToCountTimeFrom: PartInstance | undefined
}

export function DirectorScreenTop({
	playlist,
	partInstanceToCountTimeFrom,
}: Readonly<DirectorScreenTopProps>): JSX.Element {
	const timingDurations = useTiming()

	const rehearsalInProgress = Boolean(playlist.rehearsal && partInstanceToCountTimeFrom?.timings?.take)

	const expectedStart = rehearsalInProgress
		? partInstanceToCountTimeFrom?.timings?.take || 0
		: PlaylistTiming.getExpectedStart(playlist.timing) || 0
	const expectedDuration = PlaylistTiming.getExpectedDuration(playlist.timing) || 0

	const expectedEnd = rehearsalInProgress
		? (partInstanceToCountTimeFrom?.timings?.take || 0) + expectedDuration
		: PlaylistTiming.getExpectedEnd(playlist.timing)

	const now = timingDurations.currentTime ?? getCurrentTime()

	const overUnderClock = getPlaylistTimingDiff(playlist, timingDurations) ?? 0

	const { t } = useTranslation()

	return (
		<div className="director-screen__top">
			{expectedEnd ? (
				<div className="director-screen__top__planned-end">
					<div>
						<PlannedEndComponent value={expectedEnd} />
					</div>
					{t('Planned End')}
				</div>
			) : null}
			{expectedEnd && expectedEnd > now ? (
				<div className="director-screen__top__time-to director-screen__top__planned-container">
					<div>
						<TimeToPlannedEndComponent value={now - expectedEnd} />
					</div>
					<span className="director-screen__top__planned-to">
						{rehearsalInProgress ? t('Time to rehearsal end') : t('Time to planned end')}
					</span>
				</div>
			) : (
				<div>
					<div className="director-screen__top__planned-container">
						<TimeSincePlannedEndComponent
							value={
								rehearsalInProgress
									? (partInstanceToCountTimeFrom?.timings?.take || 0) + expectedDuration - now
									: getCurrentTime() - (expectedStart + expectedDuration)
							}
						/>
						<span className="director-screen__top__planned-since">
							{rehearsalInProgress ? t('Time since rehearsal end') : t('Time since planned end')}
						</span>
					</div>
				</div>
			)}
			<div>
				<div>
					<OverUnderClockComponent value={overUnderClock} />
				</div>
				<span className="director-screen__top__over-under">{t('Over/Under')}</span>
			</div>
		</div>
	)
}
