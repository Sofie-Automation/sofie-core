import React, { useCallback, useEffect, useRef, useState } from 'react'
import classNames from 'classnames'
import { useTranslation } from 'react-i18next'
import { PartExtended } from '../../lib/RundownResolver.js'
import { IOutputLayerUi, SegmentUi } from '../SegmentContainer/withResolvedSegment.js'
import { StoryboardPartSecondaryPieces } from './StoryboardPartSecondaryPieces/StoryboardPartSecondaryPieces.js'
import { StoryboardPartThumbnail } from './StoryboardPartThumbnail/StoryboardPartThumbnail.js'
import { ContextMenuTrigger } from '@jstarpl/react-contextmenu'
import { contextMenuHoldToDisplayTime, useRundownViewEventBusListener } from '../../lib/lib.js'
import { getElementDocumentOffset } from '../../utils/positions.js'
import { IContextMenuContext } from '../RundownView.js'
import { literal } from '../../lib/tempLib.js'
import { SegmentTimelinePartElementId } from '../SegmentTimeline/Parts/SegmentTimelinePart.js'
import { CurrentPartOrSegmentRemaining } from '../RundownView/RundownTiming/CurrentPartOrSegmentRemaining.js'
import { getAllowSpeaking, getAllowVibrating } from '../../lib/localStorage.js'
import { HighlightEvent, RundownViewEvents } from '@sofie-automation/meteor-lib/dist/triggers/RundownViewEventBus'
import { Meteor } from 'meteor/meteor'
import { StoryboardPartTransitions } from './StoryboardPartTransitions.js'
import { PartDisplayDuration } from '../RundownView/RundownTiming/PartDuration.js'
import { InvalidPartCover } from '../SegmentTimeline/Parts/InvalidPartCover.js'
import { SegmentEnd } from '../../lib/ui/icons/segment.js'
import { AutoNextStatus } from '../RundownView/RundownTiming/AutoNextStatus.js'
import { RundownTimingContext, getPartInstanceTimingId } from '../../lib/rundownTiming.js'
import { TimingDataResolution, TimingTickResolution, useTiming } from '../RundownView/RundownTiming/withTiming.js'
import { LoopingIcon } from '../../lib/ui/icons/looping.js'

interface IProps {
	className?: string
	segment: SegmentUi
	part: PartExtended
	outputLayers: Record<string, IOutputLayerUi>
	isLivePart: boolean
	isNextPart: boolean
	isLastSegment?: boolean
	isLastPartInSegment?: boolean
	isPlaylistLooping?: boolean
	isEndOfLoopingShow?: boolean
	isQuickLoopStart: boolean
	isQuickLoopEnd: boolean
	doesPlaylistHaveNextPart?: boolean
	inHold: boolean
	currentPartWillAutonext: boolean
	subscriptionsReady: boolean
	displayLiveLineCounter: boolean
	style?: React.CSSProperties
	onContextMenu?: (contextMenuContext: IContextMenuContext) => void
	onHoverOver?: () => void
	onHoverOut?: () => void
}
export function StoryboardPart({
	className,
	segment,
	part,
	isLivePart,
	isNextPart,
	isLastPartInSegment,
	isLastSegment,
	isPlaylistLooping,
	isEndOfLoopingShow,
	isQuickLoopStart,
	isQuickLoopEnd,
	doesPlaylistHaveNextPart,
	currentPartWillAutonext,
	outputLayers,
	subscriptionsReady,
	displayLiveLineCounter,
	style,
	onContextMenu,
	onHoverOver,
	onHoverOut,
}: Readonly<IProps>): JSX.Element {
	const { t } = useTranslation()
	const [highlight, setHighlight] = useState(false)
	const willBeAutoNextedInto = isNextPart ? currentPartWillAutonext : part.willProbablyAutoNext

	const timingDurations = useTiming(
		TimingTickResolution.Synced,
		TimingDataResolution.High,
		(durations: RundownTimingContext) => {
			durations = durations || {}

			const timingId = getPartInstanceTimingId(part.instance)
			return [(durations.partsInQuickLoop || {})[timingId]]
		}
	)

	const getPartContext = useCallback(() => {
		const partElement = document.querySelector('#' + SegmentTimelinePartElementId + part.instance._id)
		const partDocumentOffset = getElementDocumentOffset(partElement)

		const ctx = literal<IContextMenuContext>({
			segment: segment,
			part: part,
			partDocumentOffset: partDocumentOffset || undefined,
			timeScale: 1,
			mousePosition: { top: 0, left: 0 },
			partStartsAt: 100,
		})

		if (onContextMenu && typeof onContextMenu === 'function') {
			onContextMenu(ctx)
		}

		return ctx
	}, [segment, part, onContextMenu])

	const highlightTimeout = useRef<number | null>(null)
	const onHighlight = useCallback(
		(e: HighlightEvent) => {
			if (e.partId == part.partId) {
				// && !e.pieceId
				setHighlight(true)
				if (highlightTimeout.current) Meteor.clearTimeout(highlightTimeout.current)
				highlightTimeout.current = Meteor.setTimeout(() => setHighlight(false), 5000)
			}
		},
		[part.partId]
	)
	useEffect(() => {
		return () => {
			if (highlightTimeout.current) Meteor.clearTimeout(highlightTimeout.current)
		}
	}, [])

	useRundownViewEventBusListener(RundownViewEvents.HIGHLIGHT, onHighlight)

	const isInvalid = part.instance.part.invalid
	const isFloated = part.instance.part.floated
	const isInsideQuickLoop = timingDurations.partsInQuickLoop?.[getPartInstanceTimingId(part.instance)] ?? false
	const isOutsideActiveQuickLoop = !isInsideQuickLoop && isPlaylistLooping && !isNextPart

	return (
		<ContextMenuTrigger
			id="segment-timeline-context-menu"
			attributes={{
				className: classNames(
					'segment-storyboard__part',
					{
						squished: !!style,
						'invert-flash': highlight,
						'segment-storyboard__part--next': isNextPart,
						'segment-storyboard__part--live': isLivePart,
						'segment-storyboard__part--invalid': part.instance.part.invalid,
						'segment-storyboard__part--outside-quickloop': isOutsideActiveQuickLoop,
						'segment-storyboard__part--quickloop-start': isQuickLoopStart,
						'segment-storyboard__part--quickloop-end': isQuickLoopEnd,
					},
					className
				),
				//@ts-expect-error A Data attribue is perfectly fine
				'data-layer-id': part.instance._id,
				id: SegmentTimelinePartElementId + part.instance._id,
				style: style,
				onMouseEnter: onHoverOver,
				onMouseLeave: onHoverOut,
				role: 'region',
				'aria-roledescription': 'part',
				'aria-label': part.instance.part.title,
			}}
			holdToDisplay={contextMenuHoldToDisplayTime()}
			collect={getPartContext}
		>
			{isLivePart ? <div className="segment-storyboard__part__background"></div> : null}
			{subscriptionsReady ? (
				<>
					<StoryboardPartThumbnail part={part} isLive={isLivePart} isNext={isNextPart} />
					<StoryboardPartTransitions part={part} outputLayers={outputLayers} />
					<StoryboardPartSecondaryPieces part={part} outputLayers={outputLayers} />
				</>
			) : (
				<>
					<div className="segment-storyboard__part__thumbnail segment-storyboard__part__thumbnail--placeholder"></div>
					<div className="segment-storyboard__part__secondary-pieces">
						<div className="segment-storyboard__part__output-group segment-storyboard__part__output-group--placeholder"></div>
						<div className="segment-storyboard__part__output-group segment-storyboard__part__output-group--placeholder"></div>
					</div>
				</>
			)}
			{isInvalid ? (
				<InvalidPartCover className="segment-storyboard__part__invalid-cover" part={part.instance.part} />
			) : null}
			{isFloated ? <div className="segment-storyboard__part__floated-cover"></div> : null}
			<div className="segment-storyboard__part__title">{part.instance.part.title}</div>
			{isQuickLoopStart && <div className="segment-storyboard__part__quickloop-start" />}
			<div
				className={classNames('segment-storyboard__part__next-line', {
					'segment-storyboard__part__next-line--autonext': willBeAutoNextedInto,
					'segment-storyboard__part__next-line--invalid': part.instance.part.invalid,
					'segment-storyboard__part__next-line--next': isNextPart,
					'segment-storyboard__part__next-line--live': isLivePart,
					'segment-storyboard__part__next-line--quickloop-start': isQuickLoopStart,
				})}
			></div>
			<div
				className={classNames('segment-storyboard__part__next-line-label', {
					'segment-storyboard__part__next-line-label--autonext': willBeAutoNextedInto,
					'segment-storyboard__part__next-line-label--next': isNextPart,
					'segment-storyboard__part__next-line-label--live': isLivePart,
					'segment-storyboard__part__next-line-label--quickloop-start': isQuickLoopStart,
				})}
			>
				{isLivePart ? t('On Air') : willBeAutoNextedInto ? t('Auto') : isNextPart ? t('Next') : null}
			</div>
			{isLastPartInSegment && (
				<>
					<div
						className={classNames(
							'segment-storyboard__part__next-line',
							'segment-storyboard__part__next-line--opposite',
							{
								'segment-storyboard__part__next-line--autonext': part.instance.part.autoNext,
								'segment-storyboard__part__next-line--next': isLivePart && (!isLastSegment || doesPlaylistHaveNextPart),
								'segment-storyboard__part__next-line--end-of-show':
									isLastSegment && (!isLivePart || !doesPlaylistHaveNextPart),
							}
						)}
					></div>
					<div
						className={classNames(
							'segment-storyboard__part__next-line-label',
							'segment-storyboard__part__next-line-label--opposite',
							{
								'segment-storyboard__part__next-line-label--autonext': part.instance.part.autoNext,
								'segment-storyboard__part__next-line-label--next':
									isLivePart && (!isLastSegment || doesPlaylistHaveNextPart),
							}
						)}
					>
						{part.instance.part.autoNext
							? t('Auto')
							: isLivePart && (!isLastSegment || doesPlaylistHaveNextPart)
								? t('Next')
								: null}
					</div>
				</>
			)}
			{!isLastSegment && isLastPartInSegment && !isEndOfLoopingShow && !part.instance.part.invalid && (
				<div
					className={classNames('segment-storyboard__part__segment-end', {
						'segment-storyboard__part__segment-end--next': isLivePart && (!isLastSegment || doesPlaylistHaveNextPart),
					})}
				>
					<div className="segment-storyboard__part__segment-end__label">
						<SegmentEnd />
					</div>
				</div>
			)}
			{(isLastSegment || isEndOfLoopingShow) && (
				<div
					className={classNames('segment-storyboard__part__show-end', {
						'segment-storyboard__part__show-end--loop': isPlaylistLooping,
					})}
				>
					{(!isLivePart || !doesPlaylistHaveNextPart || isPlaylistLooping) && isLastPartInSegment && (
						<div className="segment-storyboard__part__show-end__label">
							{isEndOfLoopingShow ? t('Loops to Start') : t('Show End')}
						</div>
					)}
				</div>
			)}
			<div className="segment-storyboard__part__bottom-left">
				{part.instance.part.identifier && (
					<div className="segment-storyboard__identifier">{part.instance.part.identifier}</div>
				)}
				{isQuickLoopStart ? (
					<div className="segment-storyboard__part__quickloop-start-icon">
						<LoopingIcon />
					</div>
				) : null}
				{isInsideQuickLoop && <div className="segment-storyboard__part__quickloop-background"></div>}
			</div>
			<div className="segment-storyboard__part__bottom-right">
				{isQuickLoopEnd ? (
					<div className="segment-storyboard__part__quickloop-end-icon">
						<LoopingIcon />
					</div>
				) : null}
				{isLivePart && displayLiveLineCounter ? (
					<div className="segment-storyboard__part-timer segment-storyboard__part-timer--live">
						<AutoNextStatus />
						<CurrentPartOrSegmentRemaining
							currentPartInstanceId={part.instance._id}
							speaking={getAllowSpeaking()}
							vibrating={getAllowVibrating()}
							heavyClassName="overtime"
						/>
					</div>
				) : displayLiveLineCounter ? (
					<div className="segment-storyboard__part-timer">
						<PartDisplayDuration part={part} />
					</div>
				) : null}
			</div>
			{isQuickLoopEnd && <div className="segment-storyboard__part__quickloop-end" />}
		</ContextMenuTrigger>
	)
}
