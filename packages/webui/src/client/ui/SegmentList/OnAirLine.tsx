import React, { useEffect, useMemo, useState } from 'react'
import {
	TimingDataResolution,
	TimingTickResolution,
	WithTiming,
	withTiming,
} from '../RundownView/RundownTiming/withTiming'
import { SIMULATED_PLAYBACK_HARD_MARGIN } from '../SegmentTimeline/Constants'
import { PartInstanceLimited } from '../../lib/RundownResolver'
import { useTranslation } from 'react-i18next'
import { getAllowSpeaking, getAllowVibrating } from '../../lib/localStorage'
import { CurrentPartOrSegmentRemaining } from '../RundownView/RundownTiming/CurrentPartOrSegmentRemaining'
import { AutoNextStatus } from '../RundownView/RundownTiming/AutoNextStatus'
import classNames from 'classnames'

interface IProps {
	partInstance: PartInstanceLimited
	maxDuration: number
	timelineBase: number
	endsInFreeze: boolean
	mainSourceEnd: number | null
}

function timeToPosition(time: number, timelineBase: number, maxDuration: number): string {
	const position = Math.min(1, Math.min(time, maxDuration) / timelineBase)

	return `${position * 100}%`
}

// TODO: This should use RundownTimingConsumer
export const OnAirLine = withTiming<IProps, {}>({
	filter: 'currentTime',
	dataResolution: TimingDataResolution.High,
	tickResolution: TimingTickResolution.High,
})(function OnAirLine({
	partInstance,
	timingDurations,
	timelineBase,
	maxDuration,
	endsInFreeze,
	mainSourceEnd,
}: WithTiming<IProps>) {
	const [livePosition, setLivePosition] = useState(0)
	const { t } = useTranslation()

	useEffect(() => {
		if (!timingDurations || !timingDurations.currentTime) return

		const lastTake = partInstance.timings?.take
		const lastStartedPlayback =
			partInstance.timings?.reportedStartedPlayback ?? partInstance.timings?.plannedStartedPlayback
		const lastTakeOffset = partInstance.timings?.playOffset || 0
		const virtualStartedPlayback =
			(lastTake || 0) > (lastStartedPlayback || -1)
				? lastTake
				: lastStartedPlayback !== undefined
				? lastStartedPlayback - lastTakeOffset
				: undefined

		let isExpectedToPlay = !!lastStartedPlayback
		if (lastTake && lastTake + SIMULATED_PLAYBACK_HARD_MARGIN > timingDurations.currentTime) {
			isExpectedToPlay = true
		}

		const newLivePosition =
			isExpectedToPlay && virtualStartedPlayback
				? timingDurations.currentTime - virtualStartedPlayback + lastTakeOffset
				: lastTakeOffset

		setLivePosition(newLivePosition)
	}, [timingDurations.currentTime])

	const style = useMemo<React.CSSProperties>(
		() => ({
			left: timeToPosition(livePosition, timelineBase, maxDuration),
		}),
		[livePosition, timelineBase, maxDuration]
	)

	const frozenOverlayStyle = useMemo<React.CSSProperties>(
		() => ({
			width: timeToPosition(Math.min(mainSourceEnd ?? maxDuration, maxDuration), timelineBase, maxDuration),
		}),
		[timelineBase, maxDuration, mainSourceEnd]
	)

	const frozen = !(livePosition < (mainSourceEnd ?? maxDuration) || !endsInFreeze)

	// const shadowStyle = useMemo<React.CSSProperties>(
	// 	() => ({
	// 		width: timeToPosition(livePosition, timelineBase, maxDuration),
	// 	}),
	// 	[livePosition, timelineBase, maxDuration]
	// )

	return (
		<>
			{/* <div className="segment-opl__timeline-shadow" style={shadowStyle}></div> */}
			{frozen && <div className="segment-opl__frozen-overlay" style={frozenOverlayStyle}></div>}
			<div className="segment-opl__timeline-flag segment-opl__on-air-line" style={style}>
				<div
					className={classNames('segment-opl__timeline-flag__label', {
						animate: !frozen,
					})}
				>
					{t('On Air')}
				</div>
				<div className="segment-opl__on-air-line__countdown">
					<AutoNextStatus />
					<CurrentPartOrSegmentRemaining
						currentPartInstanceId={partInstance._id}
						speaking={getAllowSpeaking()}
						vibrating={getAllowVibrating()}
						heavyClassName="overtime"
					/>
				</div>
			</div>
		</>
	)
})
