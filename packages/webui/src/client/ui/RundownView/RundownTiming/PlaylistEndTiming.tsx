import React from 'react'
import { useTranslation } from 'react-i18next'
import Moment from 'react-moment'
import { RundownUtils } from '../../../lib/rundown.js'
import {
	TimerValueMode,
	useOrderedPartIds,
	usePartCountdownValue,
	usePlaylistTimingValue,
	useTimingNow,
} from './usePlaylistTimingValue.js'
import ClassNames from 'classnames'
import type { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist/RundownPlaylist'
import { isLoopRunning } from '@sofie-automation/corelib/src/playout/stateCacheResolver.js'

interface IEndTimingProps {
	rundownPlaylist: DBRundownPlaylist
	loop?: boolean
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
	endLabel,
	hidePlannedEndLabel,
	hideDiffLabel,
	hidePlannedEnd,
	hideCountdown,
	hideDiff,
}: IEndTimingProps): JSX.Element {
	const { t } = useTranslation()

	const playlistId = rundownPlaylist._id

	// where a running loop returns to, so the "Next Loop at" clock counts down to it
	const firstPartId = useOrderedPartIds(playlistId)[0]
	const firstPartStartTime = usePartCountdownValue(firstPartId, TimerValueMode.Timestamp)

	const plannedEnd = usePlaylistTimingValue(playlistId, 'plannedEnd', TimerValueMode.Timestamp)
	const estimatedEnd = usePlaylistTimingValue(playlistId, 'estimatedEnd', TimerValueMode.Timestamp)
	const timeInHand = usePlaylistTimingValue(playlistId, 'overUnder', TimerValueMode.Duration)
	const now = useTimingNow()

	// the published value is the time in hand; this display is over-positive
	const overUnderClock = timeInHand === null ? 0 : 0 - timeInHand

	return (
		<React.Fragment>
			{!hideDiff ? (
				<span
					className={ClassNames('timing-clock heavy-light ', {
						heavy: overUnderClock < 0,
						light: overUnderClock >= 0,
					})}
					role="timer"
				>
					{!hideDiffLabel && <span className="timing-clock-label right">{t('Diff')}</span>}
					{RundownUtils.formatDiffToTimecodeOverUnder(overUnderClock, true)}
				</span>
			) : null}

			{!loop && !hideCountdown && plannedEnd !== null ? (
				<span className="timing-clock countdown plan-end" role="timer">
					{RundownUtils.formatDiffToTimecode(now - plannedEnd, true, true, true)}
				</span>
			) : null}

			{!hidePlannedEnd ? (
				plannedEnd !== null ? (
					<span className="timing-clock plan-end visual-last-child" role="timer">
						{!hidePlannedEndLabel && (
							<span className="timing-clock-label right">
								{endLabel ?? (!rundownPlaylist.startedPlayback ? t('Planned End') : t('Expected End'))}
							</span>
						)}
						<Moment interval={0} format="HH:mm:ss" date={plannedEnd} />
					</span>
				) : isLoopRunning(rundownPlaylist) ? (
					firstPartStartTime !== null && rundownPlaylist.activationId && rundownPlaylist.currentPartInfo ? (
						<span className="timing-clock plan-end visual-last-child" role="timer">
							{!hidePlannedEndLabel && <span className="timing-clock-label right">{t('Next Loop at')}</span>}
							<Moment interval={0} format="HH:mm:ss" date={firstPartStartTime} />
						</span>
					) : null
				) : estimatedEnd !== null ? (
					<span className="timing-clock plan-end visual-last-child" role="timer">
						{!hidePlannedEndLabel && <span className="timing-clock-label right">{endLabel ?? t('Expected End')}</span>}
						<Moment interval={0} format="HH:mm:ss" date={estimatedEnd} />
					</span>
				) : null
			) : null}
		</React.Fragment>
	)
}
