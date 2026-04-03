import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { useTranslation } from 'react-i18next'
import { Countdown } from './Countdown'
import { useTiming } from '../RundownTiming/withTiming'
import { RundownUtils } from '../../../lib/rundown.js'

export function RundownHeaderDurations({
	playlist,
	simplified,
}: {
	readonly playlist: DBRundownPlaylist
	readonly simplified?: boolean
}): JSX.Element | null {
	const { t } = useTranslation()
	const timingDurations = useTiming()

	// const expectedDuration = PlaylistTiming.getExpectedDuration(playlist.timing)
	// @todo: this _should_ use PlaylistTiming.getExpectedDuration as show above,
	// but I don't dare changing its behaviour to return for PlaylistTimingType.None within the scope of this task
	// same issue in RundownHeader.tsx
	const expectedDuration = playlist.timing.expectedDuration

	// Use remainingPlaylistDuration which includes current part's remaining time
	const estDuration = timingDurations.remainingPlaylistDuration

	if (expectedDuration == undefined && estDuration == undefined) return null

	return (
		<div className="rundown-header__show-timers-endtimes">
			{!simplified && expectedDuration ? (
				<Countdown label={t('Plan. Dur')} className="rundown-header__show-timers-countdown" ms={expectedDuration}>
					{RundownUtils.formatDiffToTimecode(expectedDuration, false, true, true, true, true)}
				</Countdown>
			) : null}
			{estDuration !== undefined ? (
				<Countdown label={t('Rem. Dur')} className="rundown-header__show-timers-countdown" ms={estDuration}>
					{RundownUtils.formatDiffToTimecode(estDuration, false, true, true, true, true)}
				</Countdown>
			) : null}
		</div>
	)
}
