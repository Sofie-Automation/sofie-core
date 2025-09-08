import classNames from 'classnames'
import { useTranslation } from 'react-i18next'
import Moment from 'react-moment'
import { LoopingIcon } from '../../lib/ui/icons/looping.js'
import { useTiming } from './RundownTiming/withTiming.js'
import { RundownUtils } from '../../lib/rundown.js'

function NextLoopClock({ useWallClock }: { useWallClock?: boolean }) {
	const timingDurations = useTiming()

	if (!timingDurations?.partCountdown) return null
	const thisPartCountdown = timingDurations.partCountdown[
		Object.keys(timingDurations.partCountdown)[0] // use the countdown to first part of rundown
	] as number | undefined

	return (
		<span>
			{useWallClock ? (
				<Moment interval={0} format="HH:mm:ss" date={(timingDurations.currentTime || 0) + (thisPartCountdown || 0)} />
			) : (
				RundownUtils.formatTimeToShortTime(
					thisPartCountdown! // shouldShow will be false if thisPartCountdown is undefined
				)
			)}
		</span>
	)
}

interface ILoopingHeaderProps {
	position: 'start' | 'end'
	multiRundown?: boolean
	showCountdowns?: boolean
}
export function PlaylistLoopingHeader({ position, multiRundown, showCountdowns }: ILoopingHeaderProps): JSX.Element {
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
						<NextLoopClock useWallClock={true} />
					</div>
					<div className="playlist-looping-header__countdown playlist-looping-header__countdown--countdown">
						<NextLoopClock />
					</div>
				</>
			) : null}
		</div>
	)
}
