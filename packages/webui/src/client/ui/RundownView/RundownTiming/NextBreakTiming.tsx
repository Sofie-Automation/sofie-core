import { useTranslation } from 'react-i18next'
import Moment from 'react-moment'
import { Rundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { WithTiming, withTiming } from './withTiming'
import ClassNames from 'classnames'
import { PlaylistTiming } from '@sofie-automation/corelib/dist/playout/rundownTiming'

interface INextBreakTimingProps {
	loop?: boolean
	rundownsBeforeBreak?: Rundown[]
	breakText?: string
	lastChild?: boolean
}

export const NextBreakTiming = withTiming<INextBreakTimingProps, {}>()(function NextBreakTiming(
	props: Readonly<WithTiming<INextBreakTimingProps>>
): JSX.Element | null {
	const { t } = useTranslation()
	const { rundownsBeforeBreak: _rundownsBeforeBreak } = props
	const rundownsBeforeBreak = _rundownsBeforeBreak || props.timingDurations.rundownsBeforeNextBreak || []
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
})
