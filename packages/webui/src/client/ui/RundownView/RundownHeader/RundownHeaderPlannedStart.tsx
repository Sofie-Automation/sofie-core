import type { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist/RundownPlaylist'
import { PlaylistTiming } from '@sofie-automation/corelib/dist/playout/rundownTiming'
import { useTranslation } from 'react-i18next'
import { Countdown } from './Countdown'
import { useTiming } from '../RundownTiming/withTiming'
import { RundownUtils } from '../../../lib/rundown.js'

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

	const now = timingDurations.currentTime ?? Date.now()
	const startsIn = now - (expectedStart ?? 0)

	return (
		<div className="rundown-header__show-timers-endtimes">
			{!simplified && expectedStart !== undefined && (
				<Countdown label={t('Plan. Start')} time={expectedStart} className="rundown-header__show-timers-countdown" />
			)}
			{playlist.startedPlayback !== undefined && <Countdown label={t('Started')} time={playlist.startedPlayback} />}
			{playlist.startedPlayback === undefined && expectedStart !== undefined && (
				<Countdown label={t('Start In')}>
					{startsIn >= 0 && '+'}
					{RundownUtils.formatDiffToTimecode(Math.abs(startsIn), false, false, true, true, true)}
				</Countdown>
			)}
		</div>
	)
}
