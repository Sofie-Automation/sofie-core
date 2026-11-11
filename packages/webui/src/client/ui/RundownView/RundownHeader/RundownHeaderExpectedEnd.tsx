import type { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist/RundownPlaylist'
import { useTranslation } from 'react-i18next'
import { Countdown } from './Countdown'
import { TimerValueMode, usePlaylistTimingValue } from '../RundownTiming/usePlaylistTimingValue.js'

export function RundownHeaderExpectedEnd({
	playlist,
	simplified,
}: {
	readonly playlist: DBRundownPlaylist
	readonly simplified?: boolean
}): JSX.Element | null {
	const { t } = useTranslation()
	const expectedEnd = usePlaylistTimingValue(playlist._id, 'plannedEnd', TimerValueMode.Timestamp)
	const estEnd = usePlaylistTimingValue(playlist._id, 'estimatedEnd', TimerValueMode.Timestamp)

	if (expectedEnd === null && estEnd === null) return null

	return (
		<div className="rundown-header__show-timers-endtimes">
			{!simplified && expectedEnd !== null ? (
				<Countdown label={t('Plan. End')} time={expectedEnd} className="rundown-header__show-timers-countdown" />
			) : null}
			{estEnd !== null ? (
				<Countdown label={t('Est. End')} time={estEnd} className="rundown-header__show-timers-countdown" />
			) : null}
		</div>
	)
}
