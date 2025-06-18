import React, { useMemo } from 'react'
import {
	TimingDataResolution,
	TimingTickResolution,
	WithTiming,
	withTiming,
} from '../RundownView/RundownTiming/withTiming'
import { RundownUtils } from '../../lib/rundown'
import { FreezeFrameIcon } from '../../lib/ui/icons/freezeFrame'
import classNames from 'classnames'
import { FREEZE_FRAME_FLASH } from '../SegmentContainer/withResolvedSegment'

interface IProps {
	partInstanceTimingId: string
	maxDuration: number
	timelineBase: number
	mainSourceEnd: number
	endsInFreeze: boolean
	partRenderedDuration: number
	partActualDuration: number | undefined
	isPartZeroBudget: boolean
	isLive: boolean
	hasAlreadyPlayed: boolean
}

function timeToPosition(time: number, timelineBase: number, maxDuration: number): string {
	const position = Math.min(1, Math.min(time, maxDuration) / timelineBase)

	return `${position * 100}%`
}

// TODO: This should use RundownTimingConsumer
export const OvertimeShadow = withTiming<IProps, {}>((props) => ({
	filter: (data) => data.partPlayed?.[props.partInstanceTimingId],
	dataResolution: TimingDataResolution.High,
	tickResolution: TimingTickResolution.High,
}))(function OvertimeShadow({
	partInstanceTimingId,
	timingDurations,
	timelineBase,
	mainSourceEnd,
	endsInFreeze,
	partRenderedDuration,
	partActualDuration,
	isPartZeroBudget,
	isLive,
	hasAlreadyPlayed,
}: WithTiming<IProps>) {
	const livePosition = timingDurations.partPlayed?.[partInstanceTimingId] ?? 0

	const contentVsPartDiff = mainSourceEnd - partRenderedDuration
	const toFreezeFrame =
		mainSourceEnd > partRenderedDuration
			? mainSourceEnd - Math.max(livePosition, partRenderedDuration)
			: mainSourceEnd - livePosition

	const overtimeShadowStyle = useMemo<React.CSSProperties>(
		() => ({
			left:
				partActualDuration !== undefined
					? timeToPosition(partActualDuration, timelineBase, timelineBase)
					: endsInFreeze && mainSourceEnd && contentVsPartDiff >= 0
					? timeToPosition(
							Math.min(mainSourceEnd, Math.max(livePosition, partRenderedDuration)),
							timelineBase,
							timelineBase
					  )
					: timeToPosition(Math.max(livePosition, partRenderedDuration), timelineBase, timelineBase),
			display: endsInFreeze && livePosition > timelineBase ? 'none' : undefined,
		}),
		[livePosition, timelineBase, mainSourceEnd, partActualDuration, partRenderedDuration, toFreezeFrame]
	)

	const idealTakeTimeStyle = useMemo<React.CSSProperties>(
		() => ({
			left: timeToPosition(partActualDuration ?? partRenderedDuration, timelineBase, timelineBase),
		}),
		[timelineBase, partActualDuration, partRenderedDuration]
	)

	const freezeFrameIconStyle = useMemo<React.CSSProperties>(
		() => ({
			left: timeToPosition(mainSourceEnd, timelineBase, timelineBase),
		}),
		[mainSourceEnd, timelineBase]
	)

	const shouldShowOvertimeTimer = !!(
		mainSourceEnd &&
		!isLive &&
		!hasAlreadyPlayed &&
		Math.floor(Math.abs(contentVsPartDiff) / 1000) !== 0
	)
	const shouldShowFreezeFrameTimer = !!(mainSourceEnd && isLive)

	return (
		//mainSourceEnd && (originalDiff < 0 || diff > 0) ?
		<>
			{!isPartZeroBudget && (
				<>
					<div
						className={classNames('segment-opl__overtime-shadow', {
							'segment-opl__overtime-shadow--no-end': isPartZeroBudget && !endsInFreeze,
						})}
						style={overtimeShadowStyle}
					>
						{shouldShowOvertimeTimer && (
							<span className="segment-opl__overtime-timer" role="timer">
								{RundownUtils.formatDiffToTimecode(
									contentVsPartDiff,
									true,
									false,
									true,
									false,
									true,
									undefined,
									false,
									true
								)}
							</span>
						)}
					</div>
					<div className="segment-opl__ideal-take-time" style={idealTakeTimeStyle}></div>
				</>
			)}
			{endsInFreeze && (
				<div className="segment-opl__freeze-marker" style={freezeFrameIconStyle}>
					<FreezeFrameIcon
						className={isLive && mainSourceEnd - livePosition < FREEZE_FRAME_FLASH ? 'flash' : undefined}
					/>
					{!isPartZeroBudget &&
						shouldShowFreezeFrameTimer &&
						((contentVsPartDiff < 0 && Math.floor(toFreezeFrame / 1000) > 0) ||
							(contentVsPartDiff >= 0 &&
								Math.floor(toFreezeFrame / 1000) > 0 &&
								livePosition > partRenderedDuration)) && (
							<span className="segment-opl__freeze-marker-timer" role="timer">
								{RundownUtils.formatDiffToTimecode(
									toFreezeFrame,
									false,
									false,
									true,
									false,
									true,
									undefined,
									false,
									true
								)}
							</span>
						)}
					{isPartZeroBudget && shouldShowFreezeFrameTimer && livePosition < mainSourceEnd && (
						<span className="segment-opl__freeze-marker-timer" role="timer">
							{RundownUtils.formatDiffToTimecode(
								mainSourceEnd - livePosition,
								true,
								false,
								true,
								false,
								true,
								undefined,
								false,
								true
							)}
						</span>
					)}
				</div>
			)}
		</>
	)
})
