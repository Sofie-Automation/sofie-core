import { ContextMenuTrigger } from '@jstarpl/react-contextmenu'
import { literal } from '@sofie-automation/corelib/dist/lib'
import classNames from 'classnames'
import { useCallback, useState } from 'react'
import { contextMenuHoldToDisplayTime } from '../../lib/lib.js'
import { RundownUtils } from '../../lib/rundown.js'
import { getElementDocumentOffset } from '../../utils/positions.js'
import type { IContextMenuContext } from '../RundownView.js'
import { CurrentPartOrSegmentRemaining } from '../RundownView/RundownHeader/CurrentPartOrSegmentRemaining.js'
import type { SegmentUi } from '../SegmentContainer/withResolvedSegment.js'
import { SegmentTimelinePartElementId } from '../SegmentTimeline/Parts/SegmentTimelinePart.js'
import { LinePartIdentifier } from './LinePartIdentifier.js'
import { LinePartPieceIndicators } from './LinePartPieceIndicators.js'
import { LinePartTimeline } from './LinePartTimeline.js'
import { LinePartTitle } from './LinePartTitle.js'
import { TimingDataResolution, TimingTickResolution, useTiming } from '../RundownView/RundownTiming/withTiming.js'
import { type RundownTimingContext, getPartInstanceTimingId } from '../../lib/rundownTiming.js'
import { LoopingIcon } from '../../lib/ui/icons/looping.js'
import type { ISourceLayerExtended } from '@sofie-automation/corelib/src/dataModel/ShowStyleBase.js'
import type { PieceUi } from '@sofie-automation/corelib/src/dataModel/Piece.js'
import type { PartExtended } from '@sofie-automation/corelib/src/dataModel/Part.js'
import { isPartInstanceInvalid } from '../../lib/partInstanceUtil.js'

interface IProps {
	segment: SegmentUi
	part: PartExtended
	isLivePart: boolean
	isNextPart: boolean
	isSinglePartInSegment: boolean
	hasAlreadyPlayed: boolean
	isQuickLoopStart: boolean
	isQuickLoopEnd: boolean
	// isLastSegment?: boolean
	// isLastPartInSegment?: boolean
	isEntirePlaylistLooping: boolean
	isPlaylistLooping: boolean
	indicatorColumns: Record<string, ISourceLayerExtended[]>
	adLibIndicatorColumns: Record<string, ISourceLayerExtended[]>
	doesPlaylistHaveNextPart?: boolean
	inHold: boolean
	currentPartWillAutonext: boolean
	isPreceededByTimingGroupSibling: boolean
	// subscriptionsReady: boolean
	displayLiveLineCounter: boolean
	style?: React.CSSProperties
	onContextMenu?: (contextMenuContext: IContextMenuContext) => void
	onPieceClick?: (item: PieceUi, e: React.MouseEvent<HTMLDivElement>) => void
	onPieceDoubleClick?: (item: PieceUi, e: React.MouseEvent<HTMLDivElement>) => void
}

export function LinePart({
	part,
	segment,
	isNextPart,
	isLivePart,
	isPreceededByTimingGroupSibling,
	hasAlreadyPlayed,
	currentPartWillAutonext,
	indicatorColumns,
	adLibIndicatorColumns,
	isPlaylistLooping,
	isEntirePlaylistLooping,
	isQuickLoopStart,
	isQuickLoopEnd,
	onContextMenu,
	onPieceClick,
	onPieceDoubleClick,
}: IProps): JSX.Element {
	const timingDurations = useTiming(
		TimingTickResolution.Synced,
		TimingDataResolution.High,
		(durations: RundownTimingContext) => {
			durations = durations || {}

			const timingId = getPartInstanceTimingId(part.instance)
			return [(durations.partsInQuickLoop || {})[timingId]]
		}
	)

	const isFinished =
		(part.instance.timings?.reportedStoppedPlayback ?? part.instance.timings?.plannedStoppedPlayback) !== undefined
	const [highlight] = useState(false)

	const timingId = getPartInstanceTimingId(part.instance)
	const isInsideQuickLoop = (timingDurations.partsInQuickLoop || {})[timingId]
	const isOutsideActiveQuickLoop =
		isPlaylistLooping && !isInsideQuickLoop && !isEntirePlaylistLooping && !isNextPart && !hasAlreadyPlayed

	// Check for both planned and runtime invalidReason
	const isInvalid = isPartInstanceInvalid(part.instance)

	const getPartContext = useCallback(() => {
		const partElement = document.querySelector('#' + SegmentTimelinePartElementId + part.instance._id)
		const partDocumentOffset = getElementDocumentOffset(partElement)

		const ctx = literal<IContextMenuContext>({
			segment: segment,
			part: part,
			partDocumentOffset: partDocumentOffset || undefined,
			timeScale: 1,
			mousePosition: { top: 0, left: 0 },
		})

		if (onContextMenu && typeof onContextMenu === 'function') {
			onContextMenu(ctx)
		}

		return ctx
	}, [segment, part, onContextMenu])

	function PartDurationDisplay() {
		if (isPreceededByTimingGroupSibling && part.instance.part.displayDurationGroup) {
			return <div className="segment-opl__part-timing-group-marker"></div>
		}

		return (
			<>
				{part.instance.part.expectedDuration !== undefined && part.instance.part.expectedDuration > 0 && (
					<span role="timer">
						{RundownUtils.formatDiffToTimecode(
							part.instance.part.expectedDuration,
							false,
							false,
							true,
							false,
							true,
							'+'
						)}
					</span>
				)}
				{(part.instance.part.expectedDuration === 0 || part.instance.part.expectedDuration === undefined) && (
					<span>––:––</span>
				)}
			</>
		)
	}

	return (
		<ContextMenuTrigger
			id="segment-timeline-context-menu"
			attributes={{
				className: classNames('segment-opl__part', {
					'invert-flash': highlight,
					'segment-opl__part--next': isNextPart,
					'segment-opl__part--live': isLivePart,
					'segment-opl__part--has-played': hasAlreadyPlayed && (!isPlaylistLooping || !isInsideQuickLoop),
					'segment-opl__part--outside-quickloop': isOutsideActiveQuickLoop,
					'segment-opl__part--quickloop-start': isQuickLoopStart,
					'segment-opl__part--invalid': isInvalid,
					'segment-opl__part--timing-sibling': isPreceededByTimingGroupSibling,
				}),
				//@ts-expect-error A Data attribute is perfectly fine
				'data-part-instance-id': part.instance._id,
				id: SegmentTimelinePartElementId + part.instance._id,
				role: 'region',
				'aria-roledescription': 'part',
				'aria-label': part.instance.part.title,
			}}
			holdToDisplay={contextMenuHoldToDisplayTime()}
			collect={getPartContext}
		>
			<div className="segment-opl__part-header">
				{isLivePart && <div className="segment-opl__part-marker segment-opl__part-marker--live"></div>}
				{isNextPart && <div className="segment-opl__part-marker segment-opl__part-marker--next"></div>}
				<div className="segment-opl__part-duration">
					{/* <PartDisplayDuration part={part} fixed={true} /> */}
					{isLivePart && (
						<CurrentPartOrSegmentRemaining
							currentPartInstanceId={part.instance._id}
							speaking={false}
							heavyClassName="overtime"
						/>
					)}
					{!isLivePart && <PartDurationDisplay />}
				</div>
				<LinePartTitle title={part.instance.part.title} />
				{part.instance.part.identifier !== undefined && (
					<LinePartIdentifier identifier={part.instance.part.identifier} />
				)}
				{isQuickLoopStart && (
					<div className="segment-opl__quickloop-start">
						<LoopingIcon />
					</div>
				)}
				{isQuickLoopEnd && (
					<div className="segment-opl__quickloop-end">
						<LoopingIcon />
					</div>
				)}
				{isInsideQuickLoop && <div className="segment-opl__quickloop-background"></div>}
			</div>
			<LinePartPieceIndicators
				partId={part.partId}
				pieces={part.pieces}
				indicatorColumns={indicatorColumns}
				adLibIndicatorColumns={adLibIndicatorColumns}
				onPieceClick={onPieceClick}
				onPieceDoubleClick={onPieceDoubleClick}
			/>
			<LinePartTimeline
				part={part}
				isLive={isLivePart}
				isNext={isNextPart}
				isFinished={isFinished}
				currentPartWillAutonext={currentPartWillAutonext}
				hasAlreadyPlayed={hasAlreadyPlayed}
				onPieceDoubleClick={onPieceDoubleClick}
				isQuickLoopStart={isQuickLoopStart}
				isQuickLoopEnd={isQuickLoopEnd}
			/>
		</ContextMenuTrigger>
	)
}
