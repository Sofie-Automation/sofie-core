import { useState, useLayoutEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { unprotectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import { RundownUtils } from '../../../lib/rundown.js'
import { PartUi, SegmentUi } from '../SegmentTimelineContainer.js'
import { SegmentTimelinePart } from '../Parts/SegmentTimelinePart.js'
import { ISourceLayer } from '@sofie-automation/blueprints-integration'
import { UIStudio } from '@sofie-automation/meteor-lib/dist/api/studios'

export const SegmentTimelinePartHoverPreview = ({
	showMiniInspector,
	parts,
	followingPart,
	segment,
	playlist,
	studio,
	collapsedOutputs,
	autoNextPart,
	liveLineHistorySize,
	isLastSegment,
	isLastInSegment,
	totalSegmentDisplayDuration,
	actualPartsDuration,
	showDurationSourceLayers,
}: {
	showMiniInspector: boolean
	parts: PartUi[]
	followingPart: PartUi | undefined

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
	totalSegmentDisplayDuration: number
	actualPartsDuration: number
	parentTimeScale: number
	showDurationSourceLayers?: Set<ISourceLayer['_id']>
}): JSX.Element | null => {
	const { t } = useTranslation()
	const [inspectorRef, setInspectorRef] = useState<HTMLDivElement | null>(null)
	const [timeToPixelRatio, setTimeToPixelRatio] = useState(1)
	// const [containOffset, setContainOffset] = useState(0)
	const followingPartPreviewDuration = 0.15 * totalSegmentDisplayDuration
	const previewWindowDuration =
		totalSegmentDisplayDuration + (followingPart || isLastInSegment ? followingPartPreviewDuration : 0)

	useLayoutEffect(() => {
		if (inspectorRef === null) return

		const { width } = inspectorRef.getBoundingClientRect()

		setTimeToPixelRatio(width / previewWindowDuration)
	}, [inspectorRef, previewWindowDuration])

	return showMiniInspector ? (
		<div
			className="segment-timeline__mini-inspector segment-timeline__mini-inspector--small-parts"
			ref={setInspectorRef}
		>
			<div className="segment-timeline__mini-inspector--small-parts__duration">
				<span className="segment-timeline__mini-inspector--small-parts__duration__label">{t('Parts Duration')}</span>
				{RundownUtils.formatDiffToTimecode(actualPartsDuration, false, false, true, false, true)}
			</div>
			<div className="segment-timeline__mini-inspector__mini-timeline">
				{parts.map((part, index) => {
					return (
						<SegmentTimelinePart
							key={unprotectString(part.instance._id)}
							segment={segment}
							playlist={playlist}
							studio={studio}
							collapsedOutputs={collapsedOutputs}
							scrollLeft={0}
							timeToPixelRatio={timeToPixelRatio}
							autoNextPart={autoNextPart}
							followLiveLine={false}
							liveLineHistorySize={liveLineHistorySize}
							livePosition={0}
							totalSegmentDuration={previewWindowDuration}
							scrollWidth={Number.POSITIVE_INFINITY}
							isLastSegment={isLastSegment}
							isLastInSegment={isLastInSegment && !followingPart && parts.length - 1 === index}
							isAfterLastValidInSegmentAndItsLive={false}
							part={part}
							isPreview={true}
							isBudgetGap={false}
							showDurationSourceLayers={showDurationSourceLayers}
							isLiveSegment={undefined}
							anyPriorPartWasLive={undefined}
							livePartStartsAt={undefined}
							livePartDisplayDuration={undefined}
							budgetDuration={undefined}
							firstPartInSegment={parts[0]}
						/>
					)
				})}
				{followingPart && (
					<SegmentTimelinePart
						key={unprotectString(followingPart.instance._id)}
						className="segment-timeline__part--shaded"
						segment={segment}
						playlist={playlist}
						studio={studio}
						collapsedOutputs={collapsedOutputs}
						scrollLeft={0}
						timeToPixelRatio={timeToPixelRatio}
						autoNextPart={autoNextPart}
						followLiveLine={false}
						liveLineHistorySize={liveLineHistorySize}
						livePosition={0}
						totalSegmentDuration={previewWindowDuration}
						scrollWidth={Number.POSITIVE_INFINITY}
						isLastSegment={isLastSegment}
						isLastInSegment={false}
						isAfterLastValidInSegmentAndItsLive={false}
						part={followingPart}
						isPreview={true}
						cropDuration={followingPartPreviewDuration}
						isBudgetGap={false}
						showDurationSourceLayers={showDurationSourceLayers}
						isLiveSegment={undefined}
						anyPriorPartWasLive={undefined}
						livePartStartsAt={undefined}
						livePartDisplayDuration={undefined}
						budgetDuration={undefined}
						firstPartInSegment={parts[0]}
					/>
				)}
			</div>
		</div>
	) : null
}
