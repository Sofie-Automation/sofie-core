import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { NoteSeverity } from '@sofie-automation/blueprints-integration'
import { IContextMenuContext } from '../RundownView.js'
import {
	IOutputLayerUi,
	PartUi,
	PieceUi,
	SegmentNoteCounts,
	SegmentUi,
} from '../SegmentContainer/withResolvedSegment.js'
import { ContextMenuTrigger } from '@jstarpl/react-contextmenu'
import { CriticalIconSmall, WarningIconSmall } from '../../lib/ui/icons/notifications.js'
import { contextMenuHoldToDisplayTime, useCombinedRefs, useRundownViewEventBusListener } from '../../lib/lib.js'
import { useTranslation } from 'react-i18next'
import { literal, unprotectString } from '../../lib/tempLib.js'
import { lockPointer, unlockPointer } from '../../lib/viewPort.js'
import { StoryboardPart } from '../SegmentStoryboard/StoryboardPart.js'
import classNames from 'classnames'
import {
	GoToPartEvent,
	GoToPartInstanceEvent,
	RundownViewEvents,
} from '@sofie-automation/meteor-lib/dist/triggers/RundownViewEventBus'
import { getElementWidth } from '../../utils/dimensions.js'
import { HOVER_TIMEOUT } from '../Shelf/DashboardPieceButton.js'
import { Meteor } from 'meteor/meteor'
import { hidePointerLockCursor, showPointerLockCursor } from '../../lib/PointerLockCursor.js'
import { motion } from 'motion/react'
import { filterSecondarySourceLayers } from '../SegmentStoryboard/StoryboardPartSecondaryPieces/StoryboardPartSecondaryPieces.js'
import { UIStudio } from '@sofie-automation/meteor-lib/dist/api/studios'
import { SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBRundownPlaylist, RundownHoldState } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { isPartPlayable } from '@sofie-automation/corelib/dist/dataModel/Part'
import { isLoopRunning } from '../../lib/RundownResolver.js'

interface IProps {
	id: string
	key: string
	segment: SegmentUi
	playlist: DBRundownPlaylist
	studio: UIStudio
	parts: Array<PartUi>
	segmentNoteCounts: SegmentNoteCounts
	hasAlreadyPlayed: boolean
	hasGuestItems: boolean
	hasRemoteItems: boolean
	isLiveSegment: boolean
	isNextSegment: boolean
	isQueuedSegment: boolean
	followLiveLine: boolean
	liveLineHistorySize: number
	displayLiveLineCounter: boolean
	currentPartWillAutoNext: boolean
	onScroll: (scrollLeft: number, event: any) => void
	onFollowLiveLine?: (state: boolean, event: any) => void
	onShowEntireSegment?: (event: any) => void
	onContextMenu?: (contextMenuContext: IContextMenuContext) => void
	onItemClick?: (piece: PieceUi, e: React.MouseEvent<HTMLDivElement>) => void
	onItemDoubleClick?: (item: PieceUi, e: React.MouseEvent<HTMLDivElement>) => void
	onHeaderNoteClick?: (segmentId: SegmentId, level: NoteSeverity) => void
	isLastSegment: boolean
	lastValidPartIndex: number | undefined
	showCountdownToSegment: boolean
	fixedSegmentDuration: boolean | undefined
	subscriptionsReady: boolean
}

const PART_WIDTH = 166 // Must match SCSS: $segment-storyboard-part-width
const PART_LIST_LEAD_IN = 0 // Must match SCSS: .segment-storyboard__part-list(padding-left)
const PART_SHADE_WIDTH = 100

export const SegmentAdlibTesting = React.memo(
	React.forwardRef<HTMLDivElement, IProps>(function SegmentAdlibTesting(props: IProps, ref) {
		const innerRef = useRef<HTMLDivElement>(null)
		const combinedRef = useCombinedRefs(null, ref, innerRef)
		const listRef = useRef<HTMLDivElement>(null)
		const [listWidth, setListWidth] = useState(0)
		const [scrollLeft, setScrollLeft] = useState(0)
		const [grabbed, setGrabbed] = useState<{ clientX: number; clientY: number } | null>(null)
		const [touched, setTouched] = useState<{ clientX: number; clientY: number } | null>(null)
		const [animateScrollLeft, setAnimateScrollLeft] = useState(true)
		const { t } = useTranslation()
		const [squishedHover, setSquishedHover] = useState<null | number>(null)
		const squishedHoverTimeout = useRef<number | null>(null)

		const criticalNotes = props.segmentNoteCounts.criticial
		const warningNotes = props.segmentNoteCounts.warning

		const getSegmentContext = () => {
			const ctx = literal<IContextMenuContext>({
				segment: props.segment,
				part: props.parts.find((p) => isPartPlayable(p.instance.part)) || null,
			})

			if (props.onContextMenu && typeof props.onContextMenu === 'function') {
				props.onContextMenu(ctx)
			}

			return ctx
		}

		let nextPartIndex = -1
		let currentPartIndex = -1

		const parts: JSX.Element[] = []
		const squishedParts: JSX.Element[] = []

		const renderedParts = props.parts.filter((part) => !(part.instance.part.invalid && part.instance.part.gap))

		const lastValidPartId = props.parts[props.lastValidPartIndex ?? props.parts.length - 1]?.instance._id

		const maxScrollLeft = PART_WIDTH * (renderedParts.length - 1) - PART_LIST_LEAD_IN / 2

		let fittingParts = 1
		let spaceLeft = 0
		let modifier = 2
		let squishedPartsNum = renderedParts.length
		while (fittingParts < renderedParts.length && spaceLeft < PART_WIDTH * 1.25 && squishedPartsNum > 1) {
			fittingParts = Math.ceil((listWidth + scrollLeft - PART_LIST_LEAD_IN) / PART_WIDTH) - modifier
			spaceLeft = listWidth + scrollLeft - PART_LIST_LEAD_IN - fittingParts * PART_WIDTH
			squishedPartsNum = Math.max(0, renderedParts.length - fittingParts)
			modifier++

			if (fittingParts <= 1) {
				// we must at least fit a single part in the Segment, we'll just overflow beyond that point
				fittingParts = 1
				spaceLeft = listWidth - PART_LIST_LEAD_IN - fittingParts * PART_WIDTH
				squishedPartsNum = Math.max(0, renderedParts.length - fittingParts)
				break
			}
		}

		const squishedPartCardStride =
			squishedPartsNum > 1 ? Math.max(4, (spaceLeft - PART_WIDTH) / (squishedPartsNum - 1)) : null

		const playlistHasNextPart = !!props.playlist.nextPartInfo
		const playlistIsLooping = isLoopRunning(props.playlist)

		renderedParts.forEach((part, index) => {
			const isLivePart = part.instance._id === props.playlist.currentPartInfo?.partInstanceId
			const isNextPart = part.instance._id === props.playlist.nextPartInfo?.partInstanceId

			if (isLivePart) currentPartIndex = index
			if (isNextPart) nextPartIndex = index

			if (part.instance.part.invalid && part.instance.part.gap) return null

			const needsToBeSquished = index > fittingParts - 1
			const partComponent = (
				<StoryboardPart
					key={unprotectString(part.instance._id)}
					segment={props.segment}
					part={part}
					isLivePart={isLivePart}
					isNextPart={isNextPart}
					isLastPartInSegment={part.instance._id === lastValidPartId}
					isLastSegment={props.isLastSegment}
					isPlaylistLooping={playlistIsLooping}
					isQuickLoopStart={false}
					isQuickLoopEnd={false}
					doesPlaylistHaveNextPart={playlistHasNextPart}
					displayLiveLineCounter={props.displayLiveLineCounter}
					inHold={!!(props.playlist.holdState && props.playlist.holdState !== RundownHoldState.COMPLETE)}
					currentPartWillAutonext={isNextPart && props.currentPartWillAutoNext}
					outputLayers={props.segment.outputLayers}
					subscriptionsReady={props.subscriptionsReady}
					onContextMenu={props.onContextMenu}
					className={
						squishedHover === null
							? index - fittingParts > 0
								? 'background'
								: undefined
							: squishedHover === index
								? 'hover'
								: undefined
					}
					style={
						needsToBeSquished && squishedPartCardStride
							? {
									transform: `translate(${(index - fittingParts) * squishedPartCardStride}px, 0)`,
									zIndex:
										squishedHover !== null
											? index <= squishedHover
												? renderedParts.length + index
												: renderedParts.length - index
											: undefined,
								}
							: undefined
					}
					onHoverOver={() => needsToBeSquished && setSquishedHover(index)}
				/>
			)

			if (needsToBeSquished) {
				squishedParts.unshift(partComponent)
			} else {
				parts.push(partComponent)
			}
		})

		useEffect(() => {
			if (!props.followLiveLine) return

			if (nextPartIndex >= 0 && currentPartIndex >= 0) {
				setScrollLeft(Math.max(0, currentPartIndex * PART_WIDTH - props.liveLineHistorySize))
			} else if (nextPartIndex >= 0) {
				setScrollLeft(Math.max(0, nextPartIndex * PART_WIDTH - props.liveLineHistorySize))
			} else if (currentPartIndex >= 0) {
				setScrollLeft(Math.max(0, currentPartIndex * PART_WIDTH - props.liveLineHistorySize))
			}
		}, [currentPartIndex, nextPartIndex, props.followLiveLine])

		const onRewindSegment = useCallback(() => {
			if (!props.isLiveSegment) {
				setScrollLeft(0)
			}
		}, [])

		const onGoToPart = useCallback(
			(e: GoToPartEvent) => {
				const idx = renderedParts.findIndex((partInstance) => e.partId === partInstance.partId)
				if (idx >= 0) {
					setScrollLeft(idx * PART_WIDTH - props.liveLineHistorySize)
				}
			},
			[renderedParts, props.followLiveLine]
		)

		const onGoToPartInstance = useCallback(
			(e: GoToPartInstanceEvent) => {
				const idx = renderedParts.findIndex((partInstance) => partInstance.instance._id === e.partInstanceId)
				if (idx >= 0) {
					setScrollLeft(idx * PART_WIDTH - props.liveLineHistorySize)
				}
			},
			[renderedParts, props.followLiveLine]
		)

		useRundownViewEventBusListener(RundownViewEvents.REWIND_SEGMENTS, onRewindSegment)
		useRundownViewEventBusListener(RundownViewEvents.GO_TO_PART, onGoToPart)
		useRundownViewEventBusListener(RundownViewEvents.GO_TO_PART_INSTANCE, onGoToPartInstance)

		useLayoutEffect(() => {
			if (!listRef.current) return

			const width = getElementWidth(listRef.current)
			if (width >= 0) {
				setListWidth(width)
			}

			const resizeObserver = new ResizeObserver((e) => {
				if (e[0].target === listRef.current) {
					const width = Math.floor(e[0].contentRect.width || 0)
					setListWidth(width)
				}
			})

			resizeObserver.observe(listRef.current)

			return () => {
				resizeObserver.disconnect()
			}
		}, [listRef.current])

		const onSquishedPointerEnter = (e: React.PointerEvent<HTMLDivElement>) => {
			if (e.pointerType === 'mouse') {
				squishedHoverTimeout.current = Meteor.setTimeout(() => setSquishedHover(null), HOVER_TIMEOUT)
			}
		}

		const clearSquishedHoverTimeout = () => {
			if (squishedHoverTimeout.current) {
				Meteor.clearTimeout(squishedHoverTimeout.current)
				squishedHoverTimeout.current = null
			}
		}

		const onSquishedPointerLeave = (e: React.PointerEvent<HTMLDivElement>) => {
			if (e.pointerType === 'mouse') {
				clearSquishedHoverTimeout()
				setSquishedHover(null)
			}
		}

		const onSquishedPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
			if (e.pointerType === 'mouse') {
				clearSquishedHoverTimeout()
				squishedHoverTimeout.current = Meteor.setTimeout(() => setSquishedHover(null), HOVER_TIMEOUT)
			}
		}

		useEffect(() => {
			return () => clearSquishedHoverTimeout()
		}, [])

		const onListPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
			if (e.pointerType === 'mouse' && e.buttons === 1) {
				setGrabbed({
					clientX: e.clientX,
					clientY: e.clientY,
				})
				setAnimateScrollLeft(false)
			} else if ((e.pointerType === 'touch' && e.isPrimary) || (e.pointerType === 'pen' && e.isPrimary)) {
				setTouched({
					clientX: e.clientX,
					clientY: e.clientY,
				})
				setAnimateScrollLeft(false)
			}
		}

		const onSegmentWheel = (e: WheelEvent) => {
			let scrollDelta = 0
			if (
				(!e.ctrlKey && e.altKey && !e.metaKey && !e.shiftKey) ||
				(e.ctrlKey && !e.metaKey && !e.shiftKey && e.altKey)
			) {
				// this.props.onScroll(Math.max(0, this.props.scrollLeft + e.deltaY / this.props.timeScale), e)
				scrollDelta = e.deltaY * -1
				e.preventDefault()
			} else if (!e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey) {
				// no modifier
				if (e.deltaX !== 0) {
					// this.props.onScroll(Math.max(0, this.props.scrollLeft + e.deltaX / this.props.timeScale), e)
					scrollDelta = e.deltaX * -1
					e.preventDefault()
				}
			}

			if (scrollDelta !== 0) {
				setScrollLeft((value) => {
					const newScrollLeft = Math.max(0, Math.min(value - scrollDelta, maxScrollLeft))
					props.onScroll(newScrollLeft, e)
					return newScrollLeft
				})
			}
		}

		useEffect(() => {
			if (!grabbed) return

			const onListPointerRelease = () => {
				setGrabbed(null)
				setAnimateScrollLeft(true)
			}
			const onPointerLockChange = () => {
				if (!document.pointerLockElement) {
					setGrabbed(null)
					setAnimateScrollLeft(true)
				}
			}
			const onPointerMove = (e: PointerEvent) => {
				setScrollLeft((value) => {
					const newScrollLeft = Math.max(0, Math.min(value - e.movementX, maxScrollLeft))
					props.onScroll(newScrollLeft, e)
					return newScrollLeft
				})
			}

			document.addEventListener('pointerup', onListPointerRelease)
			document.addEventListener('pointercancel', onListPointerRelease)
			document.addEventListener('pointerlockchange', onPointerLockChange)
			document.addEventListener('pointerlockerror', onListPointerRelease)
			document.addEventListener('pointermove', onPointerMove)
			lockPointer()
			showPointerLockCursor(grabbed.clientX, grabbed.clientY)

			return () => {
				unlockPointer()
				hidePointerLockCursor()
				document.removeEventListener('pointerup', onListPointerRelease)
				document.removeEventListener('pointercancel', onListPointerRelease)
				document.removeEventListener('pointerlockchange', onPointerLockChange)
				document.removeEventListener('pointerlockerror', onListPointerRelease)
				document.removeEventListener('pointermove', onPointerMove)
			}
		}, [grabbed, renderedParts.length, props.onScroll])

		useEffect(() => {
			if (!touched) return

			const startingScrollLeft = scrollLeft

			const onListTouchRelease = () => {
				setTouched(null)
				setAnimateScrollLeft(true)
			}
			const onTouchMove = (e: TouchEvent) => {
				e.preventDefault()
				setScrollLeft(() => {
					const newScrollLeft = Math.max(
						0,
						Math.min(startingScrollLeft + (touched.clientX - e.touches[0].clientX), maxScrollLeft)
					)
					props.onScroll(newScrollLeft, e)
					return newScrollLeft
				})
			}

			document.addEventListener('touchend', onListTouchRelease)
			document.addEventListener('touchcancel', onListTouchRelease)
			document.addEventListener('touchmove', onTouchMove, {
				passive: false,
			})

			return () => {
				document.removeEventListener('touchend', onListTouchRelease)
				document.removeEventListener('touchcancel', onListTouchRelease)
				document.removeEventListener('touchmove', onTouchMove)
			}
		}, [touched, renderedParts.length, props.onScroll])

		useLayoutEffect(() => {
			const segment = innerRef.current
			if (!segment) return

			segment.addEventListener('wheel', onSegmentWheel, {
				passive: false,
			})

			return () => {
				segment.removeEventListener('wheel', onSegmentWheel)
			}
		}, [innerRef.current])

		return (
			<div
				id={props.id}
				className={classNames('segment-timeline', 'segment-storyboard', 'segment-alib-testing', {
					// live: props.isLiveSegment,
					// next: !props.isLiveSegment && props.isNextSegment,
					// queued: props.isQueuedSegment,
					// 'has-played':
					// 	props.hasAlreadyPlayed &&
					// 	!props.isLiveSegment &&
					// 	!props.isNextSegment &&
					// 	!props.hasGuestItems &&
					// 	!props.hasRemoteItems,
					// 'has-guest-items': props.hasGuestItems,
					// 'has-remote-items': props.hasRemoteItems,
					// 'has-identifiers': identifiers.length > 0,
					// 'invert-flash': highlight,
					// 'time-of-day-countdowns': useTimeOfDayCountdowns,
				})}
				data-obj-id={props.segment._id}
				ref={combinedRef}
				role="region"
				aria-labelledby={`segment-name-${props.segment._id}`}
				aria-roledescription={t('segment')}
			>
				<ContextMenuTrigger
					id="segment-timeline-context-menu"
					collect={getSegmentContext}
					attributes={{
						className: 'segment-timeline__title',
					}}
					holdToDisplay={contextMenuHoldToDisplayTime()}
					renderTag="div"
				>
					<h2
						id={`segment-name-${props.segment._id}`}
						className={'segment-timeline__title__label' + (props.segment.identifier ? ' identifier' : '')}
						data-identifier={props.segment.identifier}
					>
						{t('Adlib Testing')}
					</h2>
					{(criticalNotes > 0 || warningNotes > 0) && (
						<div className="segment-timeline__title__notes">
							{criticalNotes > 0 && (
								<div
									className="segment-timeline__title__notes__note segment-timeline__title__notes__note--critical"
									onClick={() => props.onHeaderNoteClick?.(props.segment._id, NoteSeverity.ERROR)}
									aria-label={t('Critical problems')}
								>
									<CriticalIconSmall />
									<div className="segment-timeline__title__notes__count">{criticalNotes}</div>
								</div>
							)}
							{warningNotes > 0 && (
								<div
									className="segment-timeline__title__notes__note segment-timeline__title__notes__note--warning"
									onClick={() => props.onHeaderNoteClick?.(props.segment._id, NoteSeverity.WARNING)}
									aria-label={t('Warnings')}
								>
									<WarningIconSmall />
									<div className="segment-timeline__title__notes__count">{warningNotes}</div>
								</div>
							)}
						</div>
					)}
				</ContextMenuTrigger>
				<div className="segment-timeline__source-layers" role="tree" aria-label={t('Sources')}>
					{Object.values<IOutputLayerUi>(props.segment.outputLayers)
						.filter((outputGroup) => outputGroup.used)
						.map((outputGroup) => (
							<div className="segment-timeline__output-group" key={outputGroup._id}>
								{filterSecondarySourceLayers(outputGroup.sourceLayers).map((sourceLayer) =>
									sourceLayer.pieces.length > 0 ? (
										<div className="segment-timeline__source-layer" key={sourceLayer._id} role="treeitem">
											{sourceLayer.name}
										</div>
									) : null
								)}
							</div>
						))}
				</div>
				<div className="segment-storyboard__part-list__container" ref={listRef} onPointerDown={onListPointerDown}>
					<motion.div
						className={classNames('segment-storyboard__part-list', {
							loading: !props.subscriptionsReady,
						})}
						animate={{
							translateX: Math.min(0, scrollLeft * -1),
						}}
						transition={{ duration: animateScrollLeft ? 0.1 : 0, bounce: 0 }}
					>
						{parts}
						<div
							className={classNames('segment-storyboard__part-list', 'segment-storyboard__part-list--squished-parts', {
								hover: squishedHover !== null,
							})}
							style={{
								minWidth: `${spaceLeft}px`,
							}}
							onPointerEnter={onSquishedPointerEnter}
							onPointerLeave={onSquishedPointerLeave}
							onPointerMove={onSquishedPointerMove}
						>
							{squishedParts}
						</div>
					</motion.div>
					<div
						className="segment-storyboard__history-shade"
						style={{
							opacity: 1 - Math.min(1, Math.max(0, (PART_SHADE_WIDTH - scrollLeft) / PART_SHADE_WIDTH)),
						}}
					></div>
				</div>
			</div>
		)
	})
)

SegmentAdlibTesting.displayName = 'SegmentStoryboard'
