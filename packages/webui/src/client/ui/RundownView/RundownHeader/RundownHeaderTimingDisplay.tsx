import type { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist/RundownPlaylist'
import { PlaylistTiming } from '@sofie-automation/corelib/dist/playout/rundownTiming'
import { useTranslation } from 'react-i18next'
import { useTiming } from '../RundownTiming/withTiming'
import { getPlaylistTimingDiff } from '../../../lib/rundownTiming'
import { OverUnderChip } from '../../../lib/Components/OverUnderChip'

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
		PlaylistTiming.getExpectedDuration(playlist.timing) === undefined &&
		!playlist.startedPlayback
	) {
		return null
	}

	const isUnder = overUnderClock <= 0

	return (
		<div className="rundown-header__clocks-timing-display">
			<span className="rundown-header__clocks-diff">
				<span className="rundown-header__clocks-diff__label">{isUnder ? t('Under') : t('Over')}</span>
				<OverUnderChip valueMs={overUnderClock} format="playlistDiff" />
			</span>
		</div>
	)
}
