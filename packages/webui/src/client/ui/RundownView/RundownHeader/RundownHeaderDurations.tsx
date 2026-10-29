import type { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist/RundownPlaylist'
import { useTranslation } from 'react-i18next'
import { Countdown } from './Countdown'
import { TimerValueMode, usePlaylistTimingValue } from '../RundownTiming/usePlaylistTimingValue.js'
import { RundownUtils } from '../../../lib/rundown.js'

export function RundownHeaderDurations({
	playlist,
	simplified,
}: {
	readonly playlist: DBRundownPlaylist
	readonly simplified?: boolean
}): JSX.Element | null {
	const { t } = useTranslation()
	const expectedDuration = usePlaylistTimingValue(playlist._id, 'plannedDuration', TimerValueMode.Duration)
	const estDuration = usePlaylistTimingValue(playlist._id, 'remainingDuration', TimerValueMode.Duration)

	if (expectedDuration === null && estDuration === null) return null

	const clampedEstDuration = estDuration !== null ? Math.max(0, estDuration) : null

	return (
		<div className="rundown-header__show-timers-endtimes">
			{!simplified && expectedDuration ? (
				<Countdown label={t('Plan. Dur')} className="rundown-header__show-timers-countdown" ms={expectedDuration}>
					{RundownUtils.formatDiffToTimecode(expectedDuration, false, true, true, true, true, undefined, true, true)}
				</Countdown>
			) : null}
			{clampedEstDuration !== null ? (
				<Countdown label={t('Rem. Dur')} className="rundown-header__show-timers-countdown" ms={clampedEstDuration}>
					{/* the time left rounds up, also in its last 0.1 s */}
					{RundownUtils.formatDiffToTimecode(-clampedEstDuration, false, true, true, false, true, '', true, true)}
				</Countdown>
			) : null}
		</div>
	)
}
