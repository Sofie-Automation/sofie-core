import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { PlaylistTiming } from '@sofie-automation/corelib/dist/playout/rundownTiming'
import { useTranslation } from 'react-i18next'
import { Countdown } from './Countdown'
import { useTiming } from '../RundownTiming/withTiming'

export function RundownHeaderExpectedEnd({
	playlist,
	simplified,
}: {
	readonly playlist: DBRundownPlaylist
	readonly simplified?: boolean
}): JSX.Element | null {
	const { t } = useTranslation()
	const timingDurations = useTiming()

	const expectedEnd = PlaylistTiming.getExpectedEnd(playlist.timing)
	const now = timingDurations.currentTime ?? Date.now()

	// Use remainingPlaylistDuration which includes current part's remaining time
	const estEnd =
		timingDurations.remainingPlaylistDuration !== undefined ? now + timingDurations.remainingPlaylistDuration : null

	if (expectedEnd === undefined && estEnd === null) return null

	return (
		<div className="rundown-header__show-timers-endtimes">
			{!simplified && expectedEnd !== undefined ? (
				<Countdown label={t('Plan. End')} time={expectedEnd} className="rundown-header__show-timers-countdown" />
			) : null}
			{estEnd !== null ? (
				<Countdown label={t('Est. End')} time={estEnd} className="rundown-header__show-timers-countdown" />
			) : null}
		</div>
	)
}
