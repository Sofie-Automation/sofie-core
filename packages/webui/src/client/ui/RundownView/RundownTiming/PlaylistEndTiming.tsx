import React from 'react'
import { useTranslation } from 'react-i18next'
import Moment from 'react-moment'
import { getCurrentTime } from '../../../lib/systemTime'
import { RundownUtils } from '../../../lib/rundown'
import { withTiming, WithTiming } from './withTiming'
import ClassNames from 'classnames'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { getPlaylistTimingDiff } from '../../../lib/rundownTiming'
import { isLoopRunning } from '../../../lib/RundownResolver'

interface IEndTimingProps {
	rundownPlaylist: DBRundownPlaylist
	loop?: boolean
	expectedStart?: number
	expectedDuration?: number
	expectedEnd?: number
	endLabel?: string
	hidePlannedEndLabel?: boolean
	hideDiffLabel?: boolean
	hidePlannedEnd?: boolean
	hideCountdown?: boolean
	hideDiff?: boolean
}

export const PlaylistEndTiming = withTiming<IEndTimingProps, {}>()(function PlaylistEndTiming({
	rundownPlaylist,
	loop,
	expectedStart,
	expectedDuration,
	expectedEnd,
	endLabel,
	hidePlannedEndLabel,
	hideDiffLabel,
	hidePlannedEnd,
	hideCountdown,
	hideDiff,
	timingDurations,
}: WithTiming<IEndTimingProps>): JSX.Element {
	const { t } = useTranslation()

	const overUnderClock = getPlaylistTimingDiff(rundownPlaylist, timingDurations) ?? 0
	const now = timingDurations.currentTime ?? getCurrentTime()

	return (
		<React.Fragment>
			{!hidePlannedEnd ? (
				expectedEnd ? (
					!rundownPlaylist.startedPlayback ? (
						<span className="timing-clock plan-end right visual-last-child" role="timer">
							{!hidePlannedEndLabel && <span className="timing-clock-label right">{endLabel ?? t('Planned End')}</span>}
							<Moment interval={0} format="HH:mm:ss" date={expectedEnd} />
						</span>
					) : (
						<span className="timing-clock plan-end right visual-last-child" role="timer">
							{!hidePlannedEndLabel && (
								<span className="timing-clock-label right">{endLabel ?? t('Expected End')}</span>
							)}
							<Moment interval={0} format="HH:mm:ss" date={expectedEnd} />
						</span>
					)
				) : timingDurations ? (
					isLoopRunning(rundownPlaylist) ? (
						timingDurations.partCountdown && rundownPlaylist.activationId && rundownPlaylist.currentPartInfo ? (
							<span className="timing-clock plan-end right visual-last-child" role="timer">
								{!hidePlannedEndLabel && <span className="timing-clock-label right">{t('Next Loop at')}</span>}
								<Moment
									interval={0}
									format="HH:mm:ss"
									date={now + (timingDurations.partCountdown[Object.keys(timingDurations.partCountdown)[0]] || 0)}
								/>
							</span>
						) : null
					) : (
						<span className="timing-clock plan-end right visual-last-child" role="timer">
							{!hidePlannedEndLabel && (
								<span className="timing-clock-label right">{endLabel ?? t('Expected End')}</span>
							)}
							<Moment
								interval={0}
								format="HH:mm:ss"
								date={(expectedStart || now) + (timingDurations.remainingPlaylistDuration || 0)}
							/>
						</span>
					)
				) : null
			) : null}
			{!loop &&
				!hideCountdown &&
				(expectedEnd ? (
					<span className="timing-clock countdown plan-end right" role="timer">
						{RundownUtils.formatDiffToTimecode(now - expectedEnd, true, true, true)}
					</span>
				) : expectedStart && expectedDuration ? (
					<span className="timing-clock countdown plan-end right" role="timer">
						{RundownUtils.formatDiffToTimecode(getCurrentTime() - (expectedStart + expectedDuration), true, true, true)}
					</span>
				) : null)}
			{!hideDiff ? (
				timingDurations ? (
					<span
						className={ClassNames('timing-clock heavy-light right', {
							heavy: overUnderClock < 0,
							light: overUnderClock >= 0,
						})}
						role="timer"
					>
						{!hideDiffLabel && <span className="timing-clock-label right">{t('Diff')}</span>}
						{RundownUtils.formatDiffToTimecode(overUnderClock, true, false, true, true, true, undefined, true, true)}
					</span>
				) : null
			) : null}
		</React.Fragment>
	)
})
