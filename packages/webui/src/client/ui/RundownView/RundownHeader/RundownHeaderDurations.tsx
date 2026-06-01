import type { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist/RundownPlaylist'
import { useTranslation } from 'react-i18next'
import { Countdown } from './Countdown'
import { useTiming } from '../RundownTiming/withTiming'
import { RundownUtils } from '../../../lib/rundown.js'
import { PlaylistTiming } from '@sofie-automation/corelib/dist/playout/rundownTiming'

export function RundownHeaderDurations({
	playlist,
	simplified,
}: {
	readonly playlist: DBRundownPlaylist
	readonly simplified?: boolean
}): JSX.Element | null {
	const { t } = useTranslation()
	const timingDurations = useTiming()

	const expectedDuration = PlaylistTiming.getExpectedDuration(playlist.timing)

	const startedPlayback = playlist.activationId ? playlist.startedPlayback : undefined

	const estDuration = PlaylistTiming.getRemainingDuration(
		playlist.timing,
		timingDurations.currentTime ?? Date.now(),
		timingDurations.remainingPlaylistDuration,
		startedPlayback
	)

	if (expectedDuration == undefined && estDuration == undefined) return null

	const clampedEstDuration = estDuration !== undefined ? Math.max(0, estDuration) : undefined

	return (
		<div className="rundown-header__show-timers-endtimes">
			{!simplified && expectedDuration ? (
				<Countdown label={t('Plan. Dur')} className="rundown-header__show-timers-countdown" ms={expectedDuration}>
					{RundownUtils.formatDiffToTimecode(expectedDuration, false, true, true, true, true, undefined, true, true)}
				</Countdown>
			) : null}
			{clampedEstDuration !== undefined ? (
				<Countdown label={t('Rem. Dur')} className="rundown-header__show-timers-countdown" ms={clampedEstDuration}>
					{RundownUtils.formatDiffToTimecode(-clampedEstDuration, false, true, true, true, true, '', true, true)}
				</Countdown>
			) : null}
		</div>
	)
}
