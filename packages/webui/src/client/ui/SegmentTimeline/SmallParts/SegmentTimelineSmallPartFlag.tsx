import React, { CSSProperties, useMemo, useRef, useState } from 'react'
import { SmallPartFlag } from '../../../lib/ui/icons/segment.js'
import { ISourceLayer } from '@sofie-automation/blueprints-integration'
import { SegmentTimelineSmallPartFlagIcon } from './SegmentTimelineSmallPartFlagIcon.js'
import { protectString, unprotectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import { PartUi, SegmentUi } from '../SegmentTimelineContainer.js'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { SegmentTimelinePartHoverPreview } from './SegmentTimelinePartHoverPreview.js'
import RundownViewEventBus, { RundownViewEvents } from '@sofie-automation/meteor-lib/dist/triggers/RundownViewEventBus'
import { UIStudio } from '@sofie-automation/meteor-lib/dist/api/studios'
import { TimingDataResolution, TimingTickResolution, withTiming } from '../../RundownView/RundownTiming/withTiming.js'
import { SegmentTimelinePartClass } from '../Parts/SegmentTimelinePart.js'
import { PartExtended } from '../../../lib/RundownResolver.js'
import { getPartInstanceTimingId } from '../../../lib/rundownTiming.js'

export const SegmentTimelineSmallPartFlag = withTiming<
	{
		parts: [PartUi, number, number][]
		followingPart: PartUi | undefined
		firstPartInSegment: PartExtended
		sourceLayers: {
			[key: string]: ISourceLayer
		}
		timeToPixelRatio: number

		segment: SegmentUi
		playlist: DBRundownPlaylist
		studio: UIStudio
		collapsedOutputs: {
			[key: string]: boolean
		}
		autoNextPart: boolean
		liveLineHistorySize: number
		isLastSegment: boolean
		isLastInSegment: boolean
		timelineWidth: number
		showDurationSourceLayers?: Set<ISourceLayer['_id']>

		livePosition: number
		isLiveSegment: boolean | undefined
		anyPriorPartWasLive: boolean | undefined
		livePartStartsAt: number | undefined
		livePartDisplayDuration: number | undefined
	},
	{}
>((props) => ({
	dataResolution: TimingDataResolution.High,
	tickResolution: TimingTickResolution.High,
	filter: (timings) => [
		timings?.partDisplayStartsAt?.[getPartInstanceTimingId(props.firstPartInSegment.instance)],
		timings?.partDisplayStartsAt?.[getPartInstanceTimingId(props.parts[0][0].instance)],
	],
}))(({
	parts,
	followingPart,
	sourceLayers,
	timeToPixelRatio,
	firstPartInSegment,

	segment,
	playlist,
	studio,
	collapsedOutputs,
	autoNextPart,
	liveLineHistorySize,
	isLastSegment,
	isLastInSegment,
	showDurationSourceLayers,

	livePosition,
	isLiveSegment,
	anyPriorPartWasLive,
	livePartStartsAt,
	livePartDisplayDuration,

	timingDurations,
}): JSX.Element => {
	const flagRef = useRef<HTMLDivElement>(null)

	const futureShadePaddingTime = useMemo(() => {
		// TODO: Refactor this to use a single implementation with SegmentTimelinePart
		if (!isLiveSegment || !anyPriorPartWasLive || autoNextPart) {
			return 0
		}

		/**
		 * How far into the live part we are, in milliseconds.
		 */
		const timeIntoLivePart = Math.max(0, (livePosition || 0) - (livePartStartsAt || 0))

		/**
		 * The maximum amount of live line time padding to add, in milliseconds.
		 */
		const maxPadding = SegmentTimelinePartClass.getLiveLineTimePadding(timeToPixelRatio)

		/**
		 * The amount of live line time padding to add, based on some simple math, in milliseconds.
		 */
		const computedPadding = Math.max(0, timeIntoLivePart + maxPadding - (livePartDisplayDuration || 0))

		return Math.min(computedPadding, maxPadding)
	}, [
		isLiveSegment,
		anyPriorPartWasLive,
		autoNextPart,
		livePosition,
		livePartStartsAt,
		timeToPixelRatio,
		livePartDisplayDuration,
	])

	const firstPartDisplayStartsAt =
		(timingDurations.partDisplayStartsAt?.[getPartInstanceTimingId(parts[0][0].instance)] ?? 0) -
		(timingDurations.partDisplayStartsAt?.[getPartInstanceTimingId(firstPartInSegment.instance)] ?? 0)

	const pixelOffsetPosition = (firstPartDisplayStartsAt + futureShadePaddingTime) * timeToPixelRatio

	const [isHover, setHover] = useState(false)
	const onMouseEnter = () => {
		setHover(true)
	}
	const onMouseLeave = () => {
		setHover(false)
	}

	const onClickFlagIcon = (e: React.MouseEvent<HTMLDivElement>) => {
		const partInstanceId = e.currentTarget.dataset['partInstanceId'] // note this needs to match the contents of the data prop in SegmentTimelineSmallPartFlagIcon
		if (partInstanceId) {
			RundownViewEventBus.emit(RundownViewEvents.GO_TO_PART_INSTANCE, {
				segmentId: segment._id,
				partInstanceId: protectString(partInstanceId),
				zoomInToFit: true,
				context: e,
			})
		}
	}

	const flagHoistStyle = useMemo<CSSProperties>(
		() => ({
			transform: `translateX(${pixelOffsetPosition}px)`,
			willChange: 'transform',
		}),
		[pixelOffsetPosition]
	)

	let partDisplayDurations = 0
	let partActualDurations = 0
	const partFlags = parts.map(([part, displayDuration, actualDuration]) => {
		partDisplayDurations += displayDuration
		partActualDurations += actualDuration
		return (
			<SegmentTimelineSmallPartFlagIcon
				key={unprotectString(part.instance._id)}
				partInstance={part}
				sourceLayers={sourceLayers}
				isNext={playlist.nextPartInfo?.partInstanceId === part.instance._id}
				isLive={playlist.currentPartInfo?.partInstanceId === part.instance._id}
				onClick={onClickFlagIcon}
				data={{
					'data-part-instance-id': unprotectString(part.instance._id), // this needs to match with onFlagClick handler
				}}
			/>
		)
	})
	return (
		<div
			className="segment-timeline__small-parts-flag-hoist"
			style={flagHoistStyle}
			data-test={`translateX(${pixelOffsetPosition})`}
		>
			<div
				className="segment-timeline__small-parts-flag"
				ref={flagRef}
				onMouseEnter={onMouseEnter}
				onMouseLeave={onMouseLeave}
				style={{
					transform: `translateX(${(partDisplayDurations * timeToPixelRatio) / 2}px)`,
				}}
			>
				<SmallPartFlag className="segment-timeline__small-parts-flag-pointer" />
				{partFlags}
			</div>
			<SegmentTimelinePartHoverPreview
				autoNextPart={autoNextPart}
				collapsedOutputs={collapsedOutputs}
				studio={studio}
				showMiniInspector={isHover}
				followingPart={followingPart}
				parts={parts.map(([part]) => part)}
				segment={segment}
				playlist={playlist}
				liveLineHistorySize={liveLineHistorySize}
				isLastSegment={isLastSegment}
				isLastInSegment={isLastInSegment}
				totalSegmentDisplayDuration={partDisplayDurations}
				actualPartsDuration={partActualDurations}
				parentTimeScale={timeToPixelRatio}
				showDurationSourceLayers={showDurationSourceLayers}
			/>
		</div>
	)
})
