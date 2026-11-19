import classNames from 'classnames'
import { useTranslation } from 'react-i18next'
import Moment from 'react-moment'
import { LoopingIcon } from '../../lib/ui/icons/looping.js'
import type { RundownPlaylistId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { TimerValueMode, useOrderedPartIds, usePartCountdownValue } from './RundownTiming/usePlaylistTimingValue.js'
import { RundownUtils } from '../../lib/rundown.js'

function NextLoopClock({ useWallClock, playlistId }: { useWallClock?: boolean; playlistId: RundownPlaylistId }) {
	// the countdown to the first part of the rundown, which is where the loop returns to
	const firstPartId = useOrderedPartIds(playlistId)[0]
	const thisPartCountdown = usePartCountdownValue(firstPartId, TimerValueMode.Duration)
	// the countdown read as the time of day it reaches zero, at the same moment as the countdown itself
	const thisPartStartTime = usePartCountdownValue(firstPartId, TimerValueMode.Timestamp)

	if (thisPartCountdown === null || thisPartStartTime === null) return null

	return (
		<span>
			{useWallClock ? (
				<Moment interval={0} format="HH:mm:ss" date={thisPartStartTime} />
			) : (
				RundownUtils.formatTimeToShortTime(thisPartCountdown)
			)}
		</span>
	)
}

interface ILoopingHeaderProps {
	position: 'start' | 'end'
	multiRundown?: boolean
	showCountdowns?: boolean
	playlistId: RundownPlaylistId
}
export function PlaylistLoopingHeader({
	position,
	multiRundown,
	showCountdowns,
	playlistId,
}: ILoopingHeaderProps): JSX.Element {
	const { t } = useTranslation()

	return (
		<div
			className={classNames('playlist-looping-header', {
				'multi-rundown': multiRundown,
			})}
		>
			<h3 className="playlist-looping-header__label">
				<LoopingIcon />
				&nbsp;
				{position === 'start' ? t('Loop Start') : t('Loop End')}
			</h3>
			{showCountdowns ? (
				<>
					<div className="playlist-looping-header__countdown playlist-looping-header__countdown--time-of-day">
						<NextLoopClock useWallClock={true} playlistId={playlistId} />
					</div>
					<div className="playlist-looping-header__countdown playlist-looping-header__countdown--countdown">
						<NextLoopClock playlistId={playlistId} />
					</div>
				</>
			) : null}
		</div>
	)
}
