import type { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist/RundownPlaylist'
import { useTranslation } from 'react-i18next'
import { TimerValueMode, usePlaylistTimingValue } from '../RundownTiming/usePlaylistTimingValue.js'
import { OverUnderChip } from '../../../lib/Components/OverUnderChip'

export interface IRundownHeaderTimingDisplayProps {
	playlist: DBRundownPlaylist
}

export function RundownHeaderTimingDisplay({ playlist }: IRundownHeaderTimingDisplayProps): JSX.Element | null {
	const { t } = useTranslation()
	const timeInHand = usePlaylistTimingValue(playlist._id, 'overUnder', TimerValueMode.Duration)

	// The server omits the balance when there is no meaningful diff to show
	// (e.g. an untimed playlist that has never been played)
	if (timeInHand === null) return null

	// the published value is the time in hand; this display is over-positive
	const overUnderClock = -timeInHand
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
