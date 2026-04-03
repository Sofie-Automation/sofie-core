import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { PlaylistTiming } from '@sofie-automation/corelib/dist/playout/rundownTiming'
import { useTranslation } from 'react-i18next'
import { useTiming } from '../RundownTiming/withTiming'
import { getPlaylistTimingDiff } from '../../../lib/rundownTiming'
import { RundownUtils } from '../../../lib/rundown.js'

export interface IRundownHeaderTimingDisplayProps {
	playlist: DBRundownPlaylist
}

export function RundownHeaderTimingDisplay({ playlist }: IRundownHeaderTimingDisplayProps): JSX.Element | null {
	const { t } = useTranslation()
	const timingDurations = useTiming()

	const overUnderClock = getPlaylistTimingDiff(playlist, timingDurations)

	if (overUnderClock === undefined) return null

	// Hide diff in untimed mode before first timing take
	if (
		PlaylistTiming.isPlaylistTimingNone(playlist.timing) &&
		playlist.timing.expectedDuration === undefined &&
		!playlist.startedPlayback
	) {
		return null
	}

	const timeStr = RundownUtils.formatDiffToTimecode(Math.abs(overUnderClock), false, false, true, true, true)
	const isUnder = overUnderClock <= 0

	return (
		<div className="rundown-header__clocks-timing-display">
			<span
				className={`rundown-header__clocks-diff ${
					isUnder ? 'rundown-header__clocks-diff--under' : 'rundown-header__clocks-diff--over'
				}`}
			>
				<span className="rundown-header__clocks-diff__label">{isUnder ? t('Under') : t('Over')}</span>
				<span className={`rundown-header__clocks-diff__chip--${isUnder ? 'under' : 'over'}`}>
					{isUnder ? '−' : '+'}
					{timeStr}
				</span>
			</span>
		</div>
	)
}
