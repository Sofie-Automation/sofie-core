import React from 'react'
import { useTranslation } from 'react-i18next'
import Moment from 'react-moment'
import { getCurrentTime } from '../../../lib/systemTime.js'
import { RundownUtils } from '../../../lib/rundown.js'
import { useTiming } from './withTiming.js'
import ClassNames from 'classnames'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { getPlaylistTimingDiff } from '../../../lib/rundownTiming.js'
import { isLoopRunning } from '../../../lib/RundownResolver.js'

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

export function PlaylistEndTiming({
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
}: IEndTimingProps): JSX.Element {
	const { t } = useTranslation()

	const timingDurations = useTiming()

	const overUnderClock = getPlaylistTimingDiff(rundownPlaylist, timingDurations) ?? 0
	const now = timingDurations.currentTime ?? getCurrentTime()

	return (
		<React.Fragment>
			{!hideDiff ? (
				timingDurations ? (
					<span
						className={ClassNames('timing-clock heavy-light ', {
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

			{!loop &&
				!hideCountdown &&
				(expectedEnd ? (
					<span className="timing-clock countdown plan-end" role="timer">
						{RundownUtils.formatDiffToTimecode(now - expectedEnd, true, true, true)}
					</span>
				) : expectedStart && expectedDuration ? (
					<span className="timing-clock countdown plan-end" role="timer">
						{RundownUtils.formatDiffToTimecode(getCurrentTime() - (expectedStart + expectedDuration), true, true, true)}
					</span>
				) : null)}

			{!hidePlannedEnd ? (
				expectedEnd ? (
					!rundownPlaylist.startedPlayback ? (
						<span className="timing-clock plan-end visual-last-child" role="timer">
							{!hidePlannedEndLabel && <span className="timing-clock-label right">{endLabel ?? t('Planned End')}</span>}
							<Moment interval={0} format="HH:mm:ss" date={expectedEnd} />
						</span>
					) : (
						<span className="timing-clock plan-end visual-last-child" role="timer">
							{!hidePlannedEndLabel && (
								<span className="timing-clock-label right">{endLabel ?? t('Expected End')}</span>
							)}
							<Moment interval={0} format="HH:mm:ss" date={expectedEnd} />
						</span>
					)
				) : timingDurations ? (
					isLoopRunning(rundownPlaylist) ? (
						timingDurations.partCountdown && rundownPlaylist.activationId && rundownPlaylist.currentPartInfo ? (
							<span className="timing-clock plan-end visual-last-child" role="timer">
								{!hidePlannedEndLabel && <span className="timing-clock-label right">{t('Next Loop at')}</span>}
								<Moment
									interval={0}
									format="HH:mm:ss"
									date={now + (timingDurations.partCountdown[Object.keys(timingDurations.partCountdown)[0]] || 0)}
								/>
							</span>
						) : null
					) : (
						<span className="timing-clock plan-end visual-last-child" role="timer">
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
		</React.Fragment>
	)
}
