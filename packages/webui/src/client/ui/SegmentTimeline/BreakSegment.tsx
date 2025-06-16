import { useTranslation } from 'react-i18next'
import Moment from 'react-moment'
import { RundownUtils } from '../../lib/rundown.js'
import { useTiming } from '../RundownView/RundownTiming/withTiming.js'

interface IProps {
	breakTime: number | undefined
}

export function BreakSegment({ breakTime }: IProps): JSX.Element {
	const { t } = useTranslation()

	const timingDurations = useTiming()

	const displayTimecode = breakTime && timingDurations.currentTime ? breakTime - timingDurations.currentTime : undefined

	return (
		<div className="segment-timeline has-break">
			<div className="segment-timeline__title">
				<h2 className="segment-timeline__title__label">
					{breakTime && <Moment interval={0} format="HH:mm:ss" date={breakTime} />}&nbsp;
					{t('BREAK')}
				</h2>
			</div>
			{displayTimecode && (
				<div className="segment-timeline__timeUntil">
					<span className="segment-timeline__timeUntil__label">{t('Break In')}</span>
					<span>
						{RundownUtils.formatDiffToTimecode(displayTimecode, false, undefined, undefined, undefined, true)}
					</span>
				</div>
			)}
		</div>
	)
}
