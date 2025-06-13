import { PieceLifespan, SourceLayerType } from '@sofie-automation/blueprints-integration'
import React, { useMemo } from 'react'
import { PartExtended, PieceExtended } from '../../lib/RundownResolver.js'
import { findPieceExtendedToShowFromOrderedResolvedInstances } from '../PieceIcons/utils.js'
import { LinePartMainPiece } from './LinePartMainPiece/LinePartMainPiece.js'
import { OnAirLine } from './OnAirLine.js'
import { TakeLine } from './TakeLine.js'
import { LinePartTransitionPiece } from './LinePartTransitionPiece/LinePartTransitionPiece.js'
import { LinePartSecondaryPiece } from './LinePartSecondaryPiece/LinePartSecondaryPiece.js'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { OvertimeShadow } from './OvertimeShadow.js'
import { PartAutoNextMarker } from './PartAutoNextMarker.js'
import { PieceUi } from '../SegmentContainer/withResolvedSegment.js'
import StudioContext from '../RundownView/StudioContext.js'
import { InvalidPartCover } from '../SegmentTimeline/Parts/InvalidPartCover.js'
import { getPartInstanceTimingId } from '../../lib/rundownTiming.js'
import { QuickLoopEnd } from './QuickLoopEnd.js'
import { getShowHiddenSourceLayers } from '../../lib/localStorage.js'

const TIMELINE_DEFAULT_BASE = 30 * 1000

const showHiddenSourceLayers = getShowHiddenSourceLayers()

interface IProps {
	part: PartExtended
	isLive: boolean
	isNext: boolean
	isFinished: boolean
	currentPartWillAutonext: boolean
	hasAlreadyPlayed: boolean
	isQuickLoopStart: boolean
	isQuickLoopEnd: boolean
	onPieceClick?: (item: PieceUi, e: React.MouseEvent<HTMLDivElement>) => void
	onPieceDoubleClick?: (item: PieceUi, e: React.MouseEvent<HTMLDivElement>) => void
}

const supportedSourceLayerTypes = new Set(
	Object.values<SourceLayerType>(SourceLayerType as any).filter(
		// Support all types, apart from TRANSITION and also filter out the inverse-enum strings
		(val) => typeof val !== 'string' && val !== SourceLayerType.TRANSITION
	)
)

function findMainPiece(pieces: PieceExtended[]) {
	return findPieceExtendedToShowFromOrderedResolvedInstances(
		pieces.filter((piece) => piece.outputLayer?.isPGM && piece.sourceLayer?.onPresenterScreen),
		supportedSourceLayerTypes
	)
}

function findTransitionPiece(pieces: PieceExtended[]) {
	return pieces.slice().find((piece) => {
		if (piece.sourceLayer?.type === SourceLayerType.TRANSITION) {
			return true
		}
	})
}

function findTimelineGraphics(pieces: PieceExtended[]) {
	return pieces
		.slice()
		.filter((piece) => {
			if (
				piece.sourceLayer?.type === SourceLayerType.LOWER_THIRD &&
				(showHiddenSourceLayers || !piece.sourceLayer?.isHidden) &&
				((piece.instance.piece.lifespan === PieceLifespan.WithinPart && piece.instance.piece.enable.duration) ||
					!piece.sourceLayer?.onListViewColumn)
			) {
				return true
			}
		})
		.sort((a, b) => (a.sourceLayer?._rank ?? 0) - (b.sourceLayer?._rank ?? 0))
}

export const LinePartTimeline: React.FC<IProps> = function LinePartTimeline({
	part,
	isLive,
	isNext,
	isQuickLoopStart,
	isQuickLoopEnd,
	currentPartWillAutonext,
	hasAlreadyPlayed,
	onPieceClick,
	onPieceDoubleClick,
}) {
	// const [highlight] = useState(false)

	const mainPiece = useMemo(() => findMainPiece(part.pieces), [part.pieces])
	const transitionPiece = useMemo(() => findTransitionPiece(part.pieces), [part.pieces])
	const timedGraphics = useMemo(() => findTimelineGraphics(part.pieces), [part.pieces])

	const timings = part.instance.partPlayoutTimings
	const toPartDelay = (timings?.toPartDelay ?? 0) - ((timings?.fromPartRemaining ?? 0) - (timings?.toPartDelay ?? 0))
	const renderedPartDuration = part.renderedDuration + toPartDelay
	const mainPieceSourceDuration = mainPiece?.instance.piece.content?.sourceDuration
	const mainPieceInPoint = mainPiece?.renderedInPoint
	const maxDuration = Math.max((mainPieceInPoint ?? 0) + (mainPieceSourceDuration ?? 0), renderedPartDuration)
	const timelineBase = Math.max(TIMELINE_DEFAULT_BASE, maxDuration)

	const willAutoNextIntoThisPart = isNext ? currentPartWillAutonext : part.willProbablyAutoNext
	const willAutoNextOut = !!part.instance.part.autoNext

	const isInvalid = !!part.instance.part.invalid

	const loop = mainPiece?.instance.piece.content?.loop
	const endsInFreeze = !part.instance.part.autoNext && !loop && !!mainPiece?.instance.piece.content?.sourceDuration
	const mainSourceEnd = mainPiece?.instance.piece.content.sourceDuration
		? (mainPieceInPoint ?? 0) + mainPiece?.instance.piece.content.sourceDuration
		: null

	const isPartZeroBudget =
		(part.instance.part.expectedDuration === 0 || part.instance.part.expectedDuration === undefined) &&
		!part.instance.part.displayDurationGroup

	return (
		<div className="segment-opl__part-timeline" data-base={timelineBase / 1000}>
			{timedGraphics.map((piece) => (
				<LinePartSecondaryPiece
					key={unprotectString(piece.instance._id)}
					piece={piece}
					timelineBase={timelineBase}
					partDuration={renderedPartDuration}
					onClick={onPieceClick}
					onDoubleClick={onPieceDoubleClick}
				/>
			))}
			{mainPiece && (
				<StudioContext.Consumer>
					{(studio) => (
						<LinePartMainPiece
							piece={mainPiece}
							partId={part.partId}
							partInstanceId={part.instance._id}
							studio={studio}
							timelineBase={timelineBase}
							partDuration={renderedPartDuration}
							capToPartDuration={part.instance.part.autoNext ?? false}
							isLive={isLive}
						/>
					)}
				</StudioContext.Consumer>
			)}
			{part.instance.part.invalid && !part.instance.part.gap && (
				<InvalidPartCover className="segment-opl__main-piece invalid" part={part.instance.part} align="start" />
			)}
			{!isLive && !isInvalid && (
				<TakeLine isNext={isNext} autoNext={willAutoNextIntoThisPart} isQuickLoopStart={isQuickLoopStart} />
			)}
			{isQuickLoopStart && <div className="segment-opl__take-line__quickloop-start"></div>}
			{transitionPiece && <LinePartTransitionPiece piece={transitionPiece} />}
			{!willAutoNextOut && !isInvalid && (
				<OvertimeShadow
					partInstanceTimingId={getPartInstanceTimingId(part.instance)}
					timelineBase={timelineBase}
					maxDuration={maxDuration}
					mainSourceEnd={mainSourceEnd ?? renderedPartDuration}
					endsInFreeze={endsInFreeze}
					isPartZeroBudget={isPartZeroBudget}
					partRenderedDuration={renderedPartDuration}
					partActualDuration={part.instance.timings?.duration}
					isLive={isLive}
					hasAlreadyPlayed={hasAlreadyPlayed}
				/>
			)}
			{willAutoNextOut && <PartAutoNextMarker partDuration={renderedPartDuration} timelineBase={timelineBase} />}
			{isQuickLoopEnd && <QuickLoopEnd partDuration={renderedPartDuration} timelineBase={timelineBase} />}
			{isLive && (
				<OnAirLine
					partInstance={part.instance}
					timelineBase={timelineBase}
					mainSourceEnd={mainSourceEnd}
					maxDuration={endsInFreeze ? maxDuration : timelineBase}
					endsInFreeze={endsInFreeze}
				/>
			)}
		</div>
	)
}
