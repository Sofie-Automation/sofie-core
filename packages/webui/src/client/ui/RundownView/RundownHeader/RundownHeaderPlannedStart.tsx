import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { PlaylistTiming } from '@sofie-automation/corelib/dist/playout/rundownTiming'
import { useTranslation } from 'react-i18next'
import { Countdown } from './Countdown'
import { useTiming } from '../RundownTiming/withTiming'
import { RundownUtils } from '../../../lib/rundown'

export function RundownHeaderPlannedStart({
	playlist,
	simplified,
}: {
	playlist: DBRundownPlaylist
	simplified?: boolean
}): JSX.Element | null {
	const { t } = useTranslation()
	const timingDurations = useTiming()
	const expectedStart = PlaylistTiming.getExpectedStart(playlist.timing)

	if (expectedStart == null) return null

	const now = timingDurations.currentTime ?? Date.now()
	const diff = now - expectedStart

	return (
		<div className="rundown-header__show-timers-endtimes">
			{!simplified && expectedStart !== undefined ? (
				<Countdown label={t('Plan. Start')} time={expectedStart} className="rundown-header__show-timers-countdown" />
			) : null}
			{playlist.startedPlayback !== undefined ? (
				<Countdown label={t('Started')} time={playlist.startedPlayback} />
			) : (
				<Countdown label={t('Start In')}>
					{diff >= 0 && '+'}
					{RundownUtils.formatDiffToTimecode(Math.abs(diff), false, false, true, true, true)}
				</Countdown>
			)}
		</div>
	)
}
