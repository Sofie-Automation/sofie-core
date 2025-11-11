import { useTranslation } from 'react-i18next'
import Moment from 'react-moment'
import { Rundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { useTiming } from './withTiming.js'
import ClassNames from 'classnames'
import { PlaylistTiming } from '@sofie-automation/corelib/dist/playout/rundownTiming'

interface INextBreakTimingProps {
	loop?: boolean
	rundownsBeforeBreak?: Rundown[]
	breakText?: string
	lastChild?: boolean
}

export function NextBreakTiming(props: Readonly<INextBreakTimingProps>): JSX.Element | null {
	const { t } = useTranslation()

	const timingDurations = useTiming()

	const rundownsBeforeBreak = props.rundownsBeforeBreak || timingDurations.rundownsBeforeNextBreak || []
	const breakRundown = rundownsBeforeBreak.length ? rundownsBeforeBreak[rundownsBeforeBreak.length - 1] : undefined

	if (!breakRundown) {
		return null
	}

	const expectedEnd = PlaylistTiming.getExpectedEnd(breakRundown.timing)

	return (
		<span className={ClassNames('timing-clock plan-end right', { 'visual-last-child': props.lastChild })} role="timer">
			<span className="timing-clock-label right">{t(props.breakText || 'Next Break')}</span>
			<Moment interval={0} format="HH:mm:ss" date={expectedEnd} />
		</span>
	)
}
