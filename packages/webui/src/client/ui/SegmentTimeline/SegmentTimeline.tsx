import * as React from 'react'
import { WithTranslation, withTranslation } from 'react-i18next'

import ClassNames from 'classnames'
import { ContextMenuTrigger } from '@jstarpl/react-contextmenu'

import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { SegmentUi, PartUi, IOutputLayerUi, PieceUi } from './SegmentTimelineContainer.js'
import { TimelineGrid } from './TimelineGrid.js'
import { SegmentTimelinePart, SegmentTimelinePartClass } from './Parts/SegmentTimelinePart.js'
import { SegmentTimelineZoomControls } from './SegmentTimelineZoomControls.js'
import { SegmentDuration } from '../RundownView/RundownTiming/SegmentDuration.js'
import { PartCountdown } from '../RundownView/RundownTiming/PartCountdown.js'
import { RundownTiming } from '../RundownView/RundownTiming/RundownTiming.js'
import { CurrentPartOrSegmentRemaining } from '../RundownView/RundownTiming/CurrentPartOrSegmentRemaining.js'

import { RundownUtils } from '../../lib/rundown.js'
import { Translated } from '../../lib/ReactMeteorData/ReactMeteorData.js'
import { ErrorBoundary } from '../../lib/ErrorBoundary.js'
import { scrollToPart, lockPointer, unlockPointer } from '../../lib/viewPort.js'

import { getAllowSpeaking, getAllowVibrating, getShowHiddenSourceLayers } from '../../lib/localStorage.js'
import { showPointerLockCursor, hidePointerLockCursor } from '../../lib/PointerLockCursor.js'
import { Settings } from '../../lib/Settings.js'
import { IContextMenuContext } from '../RundownView.js'
import { literal, protectString, unprotectString } from '../../lib/tempLib.js'
import { isPartPlayable } from '@sofie-automation/corelib/dist/dataModel/Part'
import { contextMenuHoldToDisplayTime } from '../../lib/lib.js'
import { WarningIconSmall, CriticalIconSmall } from '../../lib/ui/icons/notifications.js'
import RundownViewEventBus, {
	RundownViewEvents,
	HighlightEvent,
} from '@sofie-automation/meteor-lib/dist/triggers/RundownViewEventBus'
import { wrapPartToTemporaryInstance } from '@sofie-automation/meteor-lib/dist/collections/PartInstances'

import { SegmentTimelineSmallPartFlag } from './SmallParts/SegmentTimelineSmallPartFlag.js'
import { UIStateStorage } from '../../lib/UIStateStorage.js'
import { getPartInstanceTimingId, RundownTimingContext } from '../../lib/rundownTiming.js'
import { IOutputLayer, ISourceLayer, NoteSeverity, UserEditingType } from '@sofie-automation/blueprints-integration'
import { SegmentTimelineZoomButtons } from './SegmentTimelineZoomButtons.js'
import { SegmentViewMode } from '../SegmentContainer/SegmentViewModes.js'
import { SwitchViewModeButton } from '../SegmentContainer/SwitchViewModeButton.js'
import { UIStudio } from '@sofie-automation/meteor-lib/dist/api/studios'
import { PartId, PartInstanceId, SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { RundownHoldState } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { SegmentNoteCounts } from '../SegmentContainer/withResolvedSegment.js'
import { PartExtended } from '../../lib/RundownResolver.js'
import {
	withTiming,
	TimingTickResolution,
	TimingDataResolution,
	WithTiming,
	RundownTimingProviderContext,
} from '../RundownView/RundownTiming/withTiming.js'
import { SegmentTimeAnchorTime } from '../RundownView/RundownTiming/SegmentTimeAnchorTime.js'
import { logger } from '../../lib/logging.js'
import * as RundownResolver from '../../lib/RundownResolver.js'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { SelectedElementsContext } from '../RundownView/SelectedElementsContext.js'
import { BlueprintAssetIcon } from '../../lib/Components/BlueprintAssetIcon.js'

interface IProps {
	id: string
	key: string
	segment: SegmentUi
	playlist: DBRundownPlaylist
	followLiveSegments: boolean
	studio: UIStudio
	parts: Array<PartUi>
	segmentNoteCounts: SegmentNoteCounts
	timeScale: number
	maxTimeScale: number
	onRecalculateMaxTimeScale: () => Promise<number>
	showingAllSegment: boolean
	onCollapseOutputToggle?: (layer: IOutputLayerUi, event: any) => void
	collapsedOutputs: {
		[key: string]: boolean
	}
	scrollLeft: number
	hasAlreadyPlayed: boolean
	hasGuestItems: boolean
	hasRemoteItems: boolean
	isLiveSegment: boolean
	isNextSegment: boolean
	isQueuedSegment: boolean
	followLiveLine: boolean
	liveLineHistorySize: number
	livePosition: number
	displayLiveLineCounter: boolean
	autoNextPart: boolean
	onScroll: (scrollLeft: number, event: any) => void
	onZoomChange: (newScale: number, event: any) => void
	onFollowLiveLine?: (state: boolean, event: any) => void
	onShowEntireSegment?: (event: React.MouseEvent | undefined) => void
	onContextMenu?: (contextMenuContext: IContextMenuContext) => void
	onPieceClick?: (piece: PieceUi, e: React.MouseEvent<HTMLDivElement>) => void
	onPieceDoubleClick?: (piece: PieceUi, e: React.MouseEvent<HTMLDivElement>) => void
	onHeaderNoteClick?: (segmentId: SegmentId, level: NoteSeverity) => void
	onSwitchViewMode?: (newViewMode: SegmentViewMode) => void
	segmentRef?: (el: SegmentTimelineClass, segmentId: SegmentId) => void
	isLastSegment: boolean
	lastValidPartIndex: number | undefined
	showCountdownToSegment: boolean
	showDurationSourceLayers?: Set<ISourceLayer['_id']>
	fixedSegmentDuration: boolean | undefined
}
interface IStateHeader {
	timelineWidth: number
	mouseGrabbed: boolean
	highlight: boolean
	/** This map contains a list of parts that are too small to be displayed properly, paired with their durations */
	smallParts: Map<
		PartInstanceId,
		{
			displayDuration: number
			actualDuration: number
		}
	>
	useTimeOfDayCountdowns: boolean
	// isSelected: boolean
}

interface IZoomPropsHeader {
	onZoomDblClick: (e: React.MouseEvent) => void
	timelineWidth: number
}
interface IZoomStateHeader {
	totalSegmentDuration: number
}

const SegmentTimelineZoom = class SegmentTimelineZoom extends React.Component<
	IProps & IZoomPropsHeader,
	IZoomStateHeader
> {
	static contextType = RundownTimingProviderContext
	declare context: React.ContextType<typeof RundownTimingProviderContext>

	constructor(props: IProps & IZoomPropsHeader, context: any) {
		super(props, context)
		this.state = {
			totalSegmentDuration: 10,
		}
	}

	componentDidMount(): void {
		this.checkTimingChange()
		window.addEventListener(RundownTiming.Events.timeupdateHighResolution, this.onTimeupdate)
	}

	componentWillUnmount(): void {
		window.removeEventListener(RundownTiming.Events.timeupdateHighResolution, this.onTimeupdate)
	}

	onTimeupdate = () => {
		if (!this.props.isLiveSegment) {
			this.checkTimingChange()
		}
	}

	checkTimingChange = () => {
		const total = this.calculateSegmentDuration()
		if (total !== this.state.totalSegmentDuration) {
			this.setState({
				totalSegmentDuration: total,
			})
		}
	}

	calculateSegmentDuration(): number {
		let total = 0
		if (this.context?.durations) {
			const durations = this.context.durations
			this.props.parts.forEach((partExtended) => {
				// total += durations.partDurations ? durations.partDurations[item._id] : (item.duration || item.renderedDuration || 1)
				const partInstanceTimingId = getPartInstanceTimingId(partExtended.instance)
				const duration = Math.max(
					partExtended.instance.timings?.duration || partExtended.renderedDuration || 0,
					durations.partDisplayDurations?.[partInstanceTimingId] || Settings.defaultDisplayDuration
				)
				total += duration
			})
		} else {
			total = RundownUtils.getSegmentDuration(this.props.parts, true)
		}
		return total
	}

	getSegmentDuration(): number {
		return this.props.isLiveSegment ? this.calculateSegmentDuration() : this.state.totalSegmentDuration
	}

	render(): JSX.Element {
		return (
			<div
				className={ClassNames('segment-timeline__zoom-area-container', {
					hidden:
						this.props.scrollLeft === 0 &&
						(this.props.showingAllSegment || this.props.timeScale === this.props.maxTimeScale) &&
						!this.props.isLiveSegment,
				})}
			>
				<div className="segment-timeline__zoom-area" onDoubleClick={(e) => this.props.onZoomDblClick(e)}>
					<SegmentTimelineZoomControls
						scrollLeft={this.props.scrollLeft}
						scrollWidth={this.props.timelineWidth / this.props.timeScale}
						onScroll={this.props.onScroll}
						segmentDuration={this.getSegmentDuration()}
						liveLineHistorySize={this.props.liveLineHistorySize}
						timeScale={this.props.timeScale}
						maxTimeScale={this.props.maxTimeScale}
						onZoomChange={this.props.onZoomChange}
					/>
				</div>
			</div>
		)
	}
}

export const SEGMENT_TIMELINE_ELEMENT_ID = 'rundown__segment__'

export const BUDGET_GAP_PART = {
	partId: protectString('gap'),
	instance: wrapPartToTemporaryInstance(protectString(''), {
		_id: protectString('gap'),
		_rank: 0,
		segmentId: protectString(''),
		rundownId: protectString(''),
		externalId: 'gap',
		gap: true,
		title: 'gap',
		invalid: true,
		expectedDurationWithTransition: undefined,
	}),
	pieces: [],
	renderedDuration: 0,
	startsAt: 0,
	willProbablyAutoNext: false,
}

export class SegmentTimelineClass extends React.Component<Translated<WithTiming<IProps>>, IStateHeader> {
	static whyDidYouRender = true

	timeline: HTMLDivElement | null = null
	segmentBlock: HTMLDivElement | null = null

	private _touchSize = 0
	private _touchAttached = false
	private _mouseAttached = false
	private _lastClick = 0
	private _mouseMoved = false
	private _lastPointer:
		| {
				clientX: number
				clientY: number
		  }
		| undefined = undefined
	private static _zoomOutLatch: number | undefined = undefined
	private static _zoomOutLatchId: string | undefined = undefined

	constructor(props: Translated<WithTiming<IProps>>) {
		super(props)
		this.state = {
			timelineWidth: 1,
			mouseGrabbed: false,
			highlight: false,
			smallParts: new Map(),
			useTimeOfDayCountdowns: UIStateStorage.getItemBoolean(
				`rundownView.${props.playlist._id}`,
				`segment.${props.segment._id}.useTimeOfDayCountdowns`,
				!!props.playlist.timeOfDayCountdowns
			),
			// isSelected: props.isSelected,
		}
	}

	componentDidMount(): void {
		super.componentDidMount?.()

		RundownViewEventBus.on(RundownViewEvents.HIGHLIGHT, this.onHighlight)
		RundownViewEventBus.on(RundownViewEvents.SEGMENT_ZOOM_ON, this.onRundownEventSegmentZoomOn)
		RundownViewEventBus.on(RundownViewEvents.SEGMENT_ZOOM_OFF, this.onRundownEventSegmentZoomOff)

		setTimeout(() => {
			// TODO: This doesn't actually handle having new parts added/removed, which should cause the segment to re-scale!
			if (this.props.onShowEntireSegment) {
				this.props.onShowEntireSegment(undefined)
			}
		}, 10)
	}

	componentWillUnmount(): void {
		super.componentWillUnmount?.()
		clearTimeout(this.highlightTimeout)
		if (this.segmentBlock) {
			this.segmentBlock.removeEventListener('wheel', this.onTimelineWheel, { capture: true })
		}

		RundownViewEventBus.off(RundownViewEvents.HIGHLIGHT, this.onHighlight)
		RundownViewEventBus.off(RundownViewEvents.SEGMENT_ZOOM_ON, this.onRundownEventSegmentZoomOn)
		RundownViewEventBus.off(RundownViewEvents.SEGMENT_ZOOM_OFF, this.onRundownEventSegmentZoomOff)
	}

	private highlightTimeout: NodeJS.Timeout | undefined

	private onHighlight = (e: HighlightEvent) => {
		if (e.segmentId === this.props.segment._id && !e.partId && !e.pieceId) {
			this.setState({
				highlight: true,
			})
			clearTimeout(this.highlightTimeout)
			this.highlightTimeout = setTimeout(() => {
				this.setState({
					highlight: false,
				})
			}, 5000)
		}
	}

	private setSegmentRef = (el: HTMLDivElement) => {
		this.segmentBlock = el
		if (typeof this.props.segmentRef === 'function') this.props.segmentRef(this as any, this.props.segment._id)

		if (this.segmentBlock) {
			this.segmentBlock.addEventListener('wheel', this.onTimelineWheel, { passive: false, capture: true })
		}
	}

	private setTimelineRef = (el: HTMLDivElement | null) => {
		this.timeline = el
	}

	private convertTimeToPixels = (time: number) => {
		return this.props.timeScale * time
	}

	private onTimelineResize = (size: number[]) => {
		this.setState({
			timelineWidth: size[0],
		})
	}

	private onZoomNormalize = (e: React.MouseEvent) => {
		if (this.props.onShowEntireSegment) {
			this.props.onShowEntireSegment(e)
		}
	}

	private onTimelineTouchEnd = (e: TouchEvent) => {
		if (e.touches.length === 0) {
			document.removeEventListener('touchmove', this.onTimelineTouchMove)
			document.removeEventListener('touchend', this.onTimelineTouchEnd)
			this._touchAttached = false
		}
	}

	private onTimelineTouchMove = (e: TouchEvent) => {
		if (e.touches.length === 2) {
			const newSize = e.touches[1].clientX - e.touches[0].clientX
			const prop = newSize / this._touchSize
			this.props.onZoomChange(Math.min(500, this.props.timeScale * prop), e)
			this._touchSize = newSize
		} else if (e.touches.length === 1 && this._lastPointer) {
			const scrollAmount = this._lastPointer.clientX - e.touches[0].clientX
			this.props.onScroll(Math.max(0, this.props.scrollLeft + scrollAmount / this.props.timeScale), e)
			this._lastPointer = {
				clientX: e.touches[0].clientX,
				clientY: e.touches[0].clientY,
			}
		}
	}

	private onTimelineTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
		if (e.touches.length === 2) {
			// expect two touch points
			if (!this._touchAttached) {
				document.addEventListener('touchmove', this.onTimelineTouchMove)
				document.addEventListener('touchend', this.onTimelineTouchEnd)
				this._touchAttached = true
			}
			this._touchSize = e.touches[1].clientX - e.touches[0].clientX
			e.preventDefault()
			e.stopPropagation()
		} else if (e.touches.length === 1) {
			if (!this._touchAttached) {
				document.addEventListener('touchmove', this.onTimelineTouchMove)
				document.addEventListener('touchend', this.onTimelineTouchEnd)
				this._touchAttached = true
			}
			this._lastPointer = {
				clientX: e.touches[0].clientX,
				clientY: e.touches[0].clientY,
			}
			e.preventDefault()
			e.stopPropagation()
		}
	}

	private onContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
		e.preventDefault()
	}

	private onTimelineMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
		if (!this._touchAttached && !this._mouseAttached) {
			// if mouse down is on a piece - abort
			if ((e.target as HTMLDivElement).classList.contains('segment-timeline__piece')) return
			// check that only primary button is pressed down (mask 00001b)
			if ((e.buttons & 1) !== 1) return
			e.preventDefault()

			document.addEventListener('mousemove', this.onTimelineMouseMove)
			document.addEventListener('mouseup', this.onTimelineMouseUp)
			this._mouseAttached = true
			this.setState({
				mouseGrabbed: true,
			})
			this._lastPointer = {
				clientX: e.clientX,
				clientY: e.clientY,
			}
			document.addEventListener('pointerlockchange', this.onTimelinePointerLockChange)
			document.addEventListener('pointerlockerror', this.onTimelinePointerError)
			lockPointer()
			showPointerLockCursor(this._lastPointer.clientX, this._lastPointer.clientY)
			this._mouseMoved = false
		}
	}

	private onTimelineMouseMove = (e: React.MouseEvent<HTMLDivElement> | MouseEvent) => {
		const scrollAmount = e.movementX * -1 || (this._lastPointer ? this._lastPointer.clientX - e.clientX : 0)
		this.props.onScroll(Math.max(0, this.props.scrollLeft + scrollAmount / this.props.timeScale), e)
		if (e.movementX === 0) {
			this._lastPointer = {
				clientX: e.clientX,
				clientY: e.clientY,
			}
		}
		if (e.movementX !== 0 || e.movementY !== 0) {
			this._mouseMoved = true
		}
	}

	private onTimelineMouseUp = (e: React.MouseEvent<HTMLDivElement> | MouseEvent) => {
		document.removeEventListener('mousemove', this.onTimelineMouseMove)
		document.removeEventListener('mouseup', this.onTimelineMouseUp)
		this._mouseAttached = false
		this._lastPointer = undefined
		this.setState({
			mouseGrabbed: false,
		})
		unlockPointer()
		hidePointerLockCursor()

		const now = Date.now()
		if (!this._mouseMoved && now - this._lastClick < 500) {
			this.onTimelineDoubleClick(e)
		}
		this._lastClick = this._mouseMoved ? 0 : now
	}

	private onTimelinePointerLockChange = () => {
		if (!document.pointerLockElement) {
			hidePointerLockCursor()
			document.removeEventListener('pointerlockchange', this.onTimelinePointerLockChange)
			document.removeEventListener('pointerlockerror', this.onTimelinePointerError)
		}
	}

	private onTimelinePointerError = () => {
		hidePointerLockCursor()
		document.removeEventListener('pointerlockchange', this.onTimelinePointerLockChange)
		document.removeEventListener('pointerlockerror', this.onTimelinePointerError)
	}

	private onRundownEventSegmentZoomOn = () => {
		if (this.props.isLiveSegment || (this.props.isNextSegment && this.props.playlist.currentPartInfo === null)) {
			this.onTimelineZoomOn()
		}
	}

	private onRundownEventSegmentZoomOff = () => {
		if (this.props.isLiveSegment || (this.props.isNextSegment && this.props.playlist.currentPartInfo === null)) {
			this.onTimelineZoomOff()
		}
	}

	private onTimelineZoomOn = () => {
		if (SegmentTimelineClass._zoomOutLatch === undefined) {
			SegmentTimelineClass._zoomOutLatch = this.props.timeScale
		}
		SegmentTimelineClass._zoomOutLatchId = this.props.id
		if (this.props.onShowEntireSegment) this.props.onShowEntireSegment(undefined)
	}

	private onTimelineZoomOff = () => {
		if (SegmentTimelineClass._zoomOutLatch !== undefined) {
			this.props.onZoomChange(SegmentTimelineClass._zoomOutLatch, undefined)
		}
		SegmentTimelineClass._zoomOutLatch = undefined
		SegmentTimelineClass._zoomOutLatchId = undefined
	}

	// doubleclick is simulated by onTimelineMouseUp, because we use pointer lock and that prevents dblclick events
	private onTimelineDoubleClick = (_e: React.MouseEvent<HTMLDivElement> | MouseEvent) => {
		if (SegmentTimelineClass._zoomOutLatch === undefined || SegmentTimelineClass._zoomOutLatchId !== this.props.id) {
			this.onTimelineZoomOn()
		} else {
			this.onTimelineZoomOff()
		}
	}

	private onTimeUntilClick = (_e: React.MouseEvent<HTMLDivElement>) => {
		this.setState(
			(state) => ({
				useTimeOfDayCountdowns: !state.useTimeOfDayCountdowns,
			}),
			() => {
				UIStateStorage.setItem(
					`rundownView.${this.props.playlist._id}`,
					`segment.${this.props.segment._id}.useTimeOfDayCountdowns`,
					!!this.state.useTimeOfDayCountdowns
				)
			}
		)
	}

	private onTimelineWheel = (e: WheelEvent) => {
		if (e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey) {
			// ctrl + Scroll
			const nextTimeScale = Math.max(
				this.props.maxTimeScale,
				Math.min(500, this.props.timeScale * (1 + 0.001 * (e.deltaY * -1)))
			)
			if (this.timeline) {
				const clientPositon = this.timeline.getBoundingClientRect()
				let zoomOffset = Math.max(0, e.clientX - clientPositon.x) / this.state.timelineWidth

				const currentlyVisibleArea = this.state.timelineWidth / this.props.timeScale
				const nextVisibleArea = this.state.timelineWidth / nextTimeScale
				const differenceOfVisibleArea = currentlyVisibleArea - nextVisibleArea

				if ((zoomOffset * this.state.timelineWidth) / this.props.timeScale > this.getSegmentDuration()) {
					zoomOffset = 0
				}

				if (differenceOfVisibleArea === 0) {
					this.props.onScroll(Math.max(0, this.props.scrollLeft + (e.deltaY * -1) / this.props.timeScale), e)
				} else {
					this.props.onScroll(Math.max(0, this.props.scrollLeft + differenceOfVisibleArea * zoomOffset), e)
				}
			}
			this.props.onZoomChange(nextTimeScale, e)
			e.preventDefault()
			e.stopPropagation()
		} else if (
			(!e.ctrlKey && e.altKey && !e.metaKey && !e.shiftKey) ||
			(e.ctrlKey && !e.metaKey && !e.shiftKey && e.altKey)
		) {
			// Alt + Scroll
			this.props.onScroll(Math.max(0, this.props.scrollLeft + e.deltaY / this.props.timeScale), e)
			e.preventDefault()
			e.stopPropagation()
		} else if (!e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey) {
			// no modifier
			if (e.deltaX !== 0) {
				this.props.onScroll(Math.max(0, this.props.scrollLeft + e.deltaX / this.props.timeScale), e)
				e.preventDefault()
			}
		}
	}

	private onClickPartIdent = (partId: PartId) => {
		scrollToPart(partId, false, true, true).catch((error) => {
			if (!error.toString().match(/another scroll/)) logger.error(error)
		})
	}

	private onPartTooSmallChanged = (part: PartUi, displayDuration: number | false, actualDuration: number | false) => {
		const partInstanceId = part.instance._id

		this.setState((state) => {
			if (displayDuration !== false && actualDuration !== false && !state.smallParts.has(partInstanceId)) {
				const smallParts = new Map(state.smallParts)
				smallParts.set(partInstanceId, {
					displayDuration,
					actualDuration,
				})
				return {
					smallParts,
				}
			} else if (displayDuration === false && state.smallParts.has(partInstanceId)) {
				const smallParts = new Map(state.smallParts)
				smallParts.delete(partInstanceId)
				return {
					smallParts,
				}
			}
			return null
		})
	}

	private getSegmentContext = () => {
		const ctx = literal<IContextMenuContext>({
			segment: this.props.segment,
			part: this.props.parts.find((p) => isPartPlayable(p.instance.part)) || null,
		})

		if (this.props.onContextMenu && typeof this.props.onContextMenu === 'function') {
			this.props.onContextMenu(ctx)
		}

		return ctx
	}

	private getSegmentDuration() {
		return (this.props.parts && RundownUtils.getSegmentDuration(this.props.parts)) || 0
	}

	private isOutputGroupCollapsed(outputGroup: IOutputLayer) {
		return this.props.collapsedOutputs[outputGroup._id] !== undefined
			? this.props.collapsedOutputs[outputGroup._id] === true
			: outputGroup.isDefaultCollapsed
	}

	private timelineStyle(outputGroups: IOutputLayerUi[]) {
		const showHiddenSourceLayers = getShowHiddenSourceLayers()
		const budgetDuration = this.getSegmentBudgetDuration()

		return {
			willChange: this.props.isLiveSegment ? 'transform' : 'none',
			transform: 'translateX(-' + this.convertTimeToPixels(this.props.scrollLeft).toString() + 'px)',
			height: `calc(${outputGroups.reduce(
				(mem, group) =>
					mem +
					(group.isFlattened
						? 1
						: this.isOutputGroupCollapsed(group)
							? 1
							: group.sourceLayers.filter((layer) => showHiddenSourceLayers || !layer.isHidden).length),
				0
			)} * var(--segment-layer-height) + var(--segment-timeline-padding-top) + var(--segment-timeline-padding-bottom))`,
			minWidth:
				budgetDuration !== undefined
					? `calc(${this.convertTimeToPixels(budgetDuration).toString()}px + 100vW)`
					: undefined,
		}
	}

	private getSegmentBudgetDuration() {
		return this.props.segment.segmentTiming?.budgetDuration
	}

	private renderLiveLine() {
		if (!this.props.isLiveSegment) return null

		const { t } = this.props

		const historyTimeDuration = this.props.liveLineHistorySize / this.props.timeScale

		const pixelPostion = Math.floor(
			this.convertTimeToPixels(this.props.livePosition) -
				(!this.props.followLiveLine ? this.convertTimeToPixels(this.props.scrollLeft) : 0)
		)
		const lineStyle = {
			left:
				(this.props.followLiveLine
					? // if the livePostion is greater than historyTimeDuration and followLiveLine is on
						// we always lock the onAirLine in place at liveLineHistorySize, so we can just return
						// a fixed value here
						this.props.livePosition > historyTimeDuration
						? this.props.liveLineHistorySize
						: Math.min(pixelPostion, this.props.liveLineHistorySize).toString()
					: pixelPostion.toString()) + 'px',
		}

		return (
			<>
				{!RundownResolver.isLoopRunning(this.props.playlist) && (
					<div
						className="segment-timeline__liveline-shade"
						style={{
							width: lineStyle.left,
						}}
					/>
				)}
				<div className="segment-timeline__liveline" style={lineStyle}>
					<div className="segment-timeline__liveline__label" onClick={(e) => this.props.onFollowLiveLine?.(true, e)}>
						{t('On Air')}
					</div>
					<div className="segment-timeline__liveline__timecode">
						{this.props.displayLiveLineCounter && (
							<CurrentPartOrSegmentRemaining
								currentPartInstanceId={this.props.playlist.currentPartInfo?.partInstanceId ?? null}
								speaking={getAllowSpeaking()}
								vibrating={getAllowVibrating()}
								heavyClassName="overtime"
							/>
						)}
						{this.props.autoNextPart ? (
							<div className="rundown-view__part__icon rundown-view__part__icon--auto-next">{t('Auto')}</div>
						) : null}
						{this.props.playlist.holdState && this.props.playlist.holdState !== RundownHoldState.COMPLETE ? (
							<div className="segment-timeline__liveline__status segment-timeline__liveline__status--hold">
								{t('Hold')}
							</div>
						) : null}
					</div>
				</div>
			</>
		)
	}

	private renderTimeline() {
		const { smallParts } = this.state
		let livePart: PartExtended | null = null
		let anyPriorPartWasLive = false
		let partIsLive = false
		let smallPartsAccumulator: [PartUi, number, number][] = []
		return this.props.parts.map((part, index) => {
			const previousPartIsLive = partIsLive
			if (previousPartIsLive) anyPriorPartWasLive = true
			partIsLive = part.instance._id === this.props.playlist.currentPartInfo?.partInstanceId
			if (partIsLive) livePart = part
			let emitSmallPartsInFlag: [PartUi, number, number][] | undefined = undefined
			let emitSmallPartsInFlagAtEnd = false
			// if this is not undefined, it means that the part is on the list of small keys
			const durations = smallParts.get(part.instance._id)
			if (durations !== undefined) {
				smallPartsAccumulator.push([part, durations.displayDuration, durations.actualDuration])
			}

			if (durations === undefined && smallPartsAccumulator.length > 0) {
				emitSmallPartsInFlag = smallPartsAccumulator
				smallPartsAccumulator = []
			} else if (durations !== undefined && smallPartsAccumulator.length > 0 && this.props.parts.length === index + 1) {
				emitSmallPartsInFlag = smallPartsAccumulator
				emitSmallPartsInFlagAtEnd = true
				smallPartsAccumulator = []
			}

			const firstPartInSegment = this.props.parts[0]
			const livePartStartsAt = this.calcLivePartStartsAt(livePart, firstPartInSegment)
			const livePartDisplayDuration = this.calcLivePartDisplayDuration(livePart)

			return (
				<React.Fragment key={unprotectString(part.instance._id)}>
					{emitSmallPartsInFlag && !emitSmallPartsInFlagAtEnd && (
						<SegmentTimelineSmallPartFlag
							parts={emitSmallPartsInFlag}
							followingPart={part}
							livePosition={this.props.livePosition}
							firstPartInSegment={firstPartInSegment}
							sourceLayers={this.props.segment.sourceLayers}
							timeToPixelRatio={this.props.timeScale}
							autoNextPart={this.props.autoNextPart}
							collapsedOutputs={this.props.collapsedOutputs}
							playlist={this.props.playlist}
							studio={this.props.studio}
							segment={this.props.segment}
							liveLineHistorySize={this.props.liveLineHistorySize}
							isLastSegment={this.props.isLastSegment}
							isLastInSegment={false}
							timelineWidth={this.state.timelineWidth}
							showDurationSourceLayers={this.props.showDurationSourceLayers}
							isLiveSegment={this.props.isLiveSegment}
							anyPriorPartWasLive={anyPriorPartWasLive}
							livePartStartsAt={livePartStartsAt}
							livePartDisplayDuration={livePartDisplayDuration}
						/>
					)}
					<SegmentTimelinePart
						segment={this.props.segment}
						playlist={this.props.playlist}
						studio={this.props.studio}
						collapsedOutputs={this.props.collapsedOutputs}
						scrollLeft={this.props.scrollLeft}
						timeToPixelRatio={this.props.timeScale}
						autoNextPart={this.props.autoNextPart}
						followLiveLine={this.props.followLiveLine}
						liveLineHistorySize={this.props.liveLineHistorySize}
						livePosition={this.props.livePosition}
						onScroll={this.props.onScroll}
						onCollapseOutputToggle={this.props.onCollapseOutputToggle}
						onFollowLiveLine={this.props.onFollowLiveLine}
						onContextMenu={this.props.onContextMenu}
						onPieceClick={this.props.onPieceClick}
						onPieceDoubleClick={this.props.onPieceDoubleClick}
						onPartTooSmallChanged={this.onPartTooSmallChanged}
						scrollWidth={this.state.timelineWidth / this.props.timeScale}
						firstPartInSegment={firstPartInSegment}
						isLastSegment={this.props.isLastSegment}
						isLastInSegment={index === this.props.parts.length - 1}
						isAfterLastValidInSegmentAndItsLive={
							index === (this.props.lastValidPartIndex || 0) + 1 &&
							previousPartIsLive &&
							!!this.props.playlist.nextPartInfo
						}
						showDurationSourceLayers={this.props.showDurationSourceLayers}
						part={part}
						isBudgetGap={false}
						isLiveSegment={this.props.isLiveSegment}
						anyPriorPartWasLive={anyPriorPartWasLive}
						livePartStartsAt={livePartStartsAt}
						livePartDisplayDuration={livePartDisplayDuration}
						budgetDuration={undefined}
					/>
					{emitSmallPartsInFlag && emitSmallPartsInFlagAtEnd && (
						<SegmentTimelineSmallPartFlag
							parts={emitSmallPartsInFlag}
							followingPart={undefined}
							livePosition={this.props.livePosition}
							firstPartInSegment={firstPartInSegment}
							sourceLayers={this.props.segment.sourceLayers}
							timeToPixelRatio={this.props.timeScale}
							autoNextPart={this.props.autoNextPart}
							collapsedOutputs={this.props.collapsedOutputs}
							playlist={this.props.playlist}
							studio={this.props.studio}
							segment={this.props.segment}
							liveLineHistorySize={this.props.liveLineHistorySize}
							isLastSegment={this.props.isLastSegment}
							isLastInSegment={true}
							timelineWidth={this.state.timelineWidth}
							showDurationSourceLayers={this.props.showDurationSourceLayers}
							isLiveSegment={this.props.isLiveSegment}
							anyPriorPartWasLive={anyPriorPartWasLive}
							livePartStartsAt={livePartStartsAt}
							livePartDisplayDuration={livePartDisplayDuration}
						/>
					)}
				</React.Fragment>
			)
		})
	}

	private renderBudgetGapPart() {
		const budgetDuration = this.getSegmentBudgetDuration()
		if (budgetDuration === undefined) return null

		const livePart = this.props.parts.find(
			(part) => part.instance._id === this.props.playlist.currentPartInfo?.partInstanceId
		)
		const firstPartInSegment = this.props.parts[0]
		const livePartStartsAt = this.calcLivePartStartsAt(livePart, firstPartInSegment)
		const livePartDisplayDuration = this.calcLivePartDisplayDuration(livePart)

		return (
			<SegmentTimelinePart
				segment={this.props.segment}
				playlist={this.props.playlist}
				studio={this.props.studio}
				collapsedOutputs={this.props.collapsedOutputs}
				scrollLeft={this.props.scrollLeft}
				timeToPixelRatio={this.props.timeScale}
				autoNextPart={this.props.autoNextPart}
				followLiveLine={this.props.followLiveLine}
				liveLineHistorySize={this.props.liveLineHistorySize}
				livePosition={this.props.livePosition}
				onScroll={this.props.onScroll}
				onCollapseOutputToggle={this.props.onCollapseOutputToggle}
				onFollowLiveLine={this.props.onFollowLiveLine}
				onContextMenu={this.props.onContextMenu}
				onPieceClick={this.props.onPieceClick}
				onPieceDoubleClick={this.props.onPieceDoubleClick}
				scrollWidth={this.state.timelineWidth / this.props.timeScale}
				firstPartInSegment={firstPartInSegment}
				lastPartInSegment={this.props.parts[this.props.parts.length - 1]}
				isLastSegment={this.props.isLastSegment}
				isLastInSegment={false}
				isAfterLastValidInSegmentAndItsLive={false}
				isBudgetGap={true}
				part={BUDGET_GAP_PART}
				showDurationSourceLayers={this.props.showDurationSourceLayers}
				isLiveSegment={this.props.isLiveSegment}
				anyPriorPartWasLive={true}
				livePartStartsAt={livePartStartsAt}
				livePartDisplayDuration={livePartDisplayDuration}
				budgetDuration={budgetDuration}
			/>
		)
	}

	private getActiveOutputGroups(): IOutputLayerUi[] {
		if (this.props.segment.outputLayers === undefined) return []

		return Object.values<IOutputLayerUi>(this.props.segment.outputLayers)
			.filter((group) => group.used)
			.sort((a, b) => a._rank - b._rank)
	}

	private renderOutputLayerControls(outputGroups: IOutputLayerUi[]) {
		const showHiddenSourceLayers = getShowHiddenSourceLayers()

		return outputGroups.map((outputLayer) => {
			if (!outputLayer.used) {
				return null
			}

			const isCollapsable =
				outputLayer.sourceLayers !== undefined && outputLayer.sourceLayers.length > 1 && !outputLayer.isFlattened
			return (
				<div
					key={outputLayer._id}
					className={ClassNames('segment-timeline__output-layer-control', {
						collapsable: isCollapsable,
						collapsed: this.isOutputGroupCollapsed(outputLayer),
					})}
					role="group"
					aria-labelledby={`segment-outputs-${this.props.segment._id}-${outputLayer._id}`}
				>
					<div
						id={`segment-outputs-${this.props.segment._id}-${outputLayer._id}`}
						className="segment-timeline__output-layer-control__label"
						data-output-id={outputLayer._id}
						tabIndex={0}
						onClick={(e) => isCollapsable && this.props.onCollapseOutputToggle?.(outputLayer, e)}
						role="presentation"
					>
						{outputLayer.name}
					</div>
					{outputLayer.sourceLayers !== undefined &&
						(!outputLayer.isFlattened ? (
							outputLayer.sourceLayers
								.filter((i) => showHiddenSourceLayers || !i.isHidden)
								.sort((a, b) => a._rank - b._rank)
								.map((sourceLayer, _index, array) => {
									return (
										<div
											key={sourceLayer._id}
											className="segment-timeline__output-layer-control__layer"
											data-source-id={sourceLayer._id}
											role="treeitem"
										>
											{array.length === 1 || sourceLayer.name === outputLayer.name ? '\xa0' : sourceLayer.name}
										</div>
									)
								})
						) : (
							<div
								key={outputLayer._id + '_flattened'}
								className="segment-timeline__output-layer-control__layer"
								data-source-id={outputLayer.sourceLayers.map((i) => i._id).join(',')}
							>
								&nbsp;
							</div>
						))}
				</div>
			)
		})
	}

	private renderEditorialLine() {
		const budgetDuration = this.getSegmentBudgetDuration()
		if (budgetDuration === undefined) {
			return null
		}

		const lineStyle = {
			left: budgetDuration * this.props.timeScale - this.props.scrollLeft * this.props.timeScale + 'px',
		}
		return <div className="segment-timeline__editorialline" style={lineStyle}></div>
	}

	private calcLivePartStartsAt(
		livePart: PartUi | undefined | null,
		firstPartInSegment: PartUi | undefined | null
	): number {
		return livePart
			? Math.max(
					0,
					(firstPartInSegment &&
						this.props.timingDurations.partDisplayStartsAt &&
						this.props.timingDurations.partDisplayStartsAt[getPartInstanceTimingId(livePart.instance)] -
							this.props.timingDurations.partDisplayStartsAt[getPartInstanceTimingId(firstPartInSegment.instance)]) ||
						0
				)
			: 0
	}

	private calcLivePartDisplayDuration(livePart: PartUi | undefined | null): number {
		return livePart ? SegmentTimelinePartClass.getPartDisplayDuration(livePart, this.props.timingDurations) : 0
	}

	render(): JSX.Element {
		const { t } = this.props

		const criticalNotes = this.props.segmentNoteCounts.criticial
		const warningNotes = this.props.segmentNoteCounts.warning

		const identifiers: Array<{ partId: PartId; ident: string }> = this.props.parts
			.map((p) =>
				p.instance.part.identifier
					? {
							partId: p.partId,
							ident: p.instance.part.identifier,
						}
					: null
			)
			.filter((entry): entry is { partId: PartId; ident: string } => entry !== null)

		let countdownToPartId: PartId | undefined = undefined
		if (!this.props.isLiveSegment) {
			const nextPart = this.props.isNextSegment
				? this.props.parts.find((p) => p.instance._id === this.props.playlist.nextPartInfo?.partInstanceId)
				: this.props.parts[0]

			if (nextPart) {
				countdownToPartId = nextPart.instance.part._id
			}
		}

		const useTimeOfDayCountdowns = this.state.useTimeOfDayCountdowns

		const activeOutputGroups = this.getActiveOutputGroups()

		return (
			<div
				id={this.props.id}
				className={ClassNames('segment-timeline', {
					live: this.props.isLiveSegment,
					next: !this.props.isLiveSegment && this.props.isNextSegment,
					queued: this.props.isQueuedSegment,

					'has-played':
						this.props.hasAlreadyPlayed &&
						!this.props.isLiveSegment &&
						!this.props.isNextSegment &&
						!this.props.hasGuestItems &&
						!this.props.hasRemoteItems,

					'has-guest-items': this.props.hasGuestItems,
					'has-remote-items': this.props.hasRemoteItems,
					'has-identifiers': identifiers.length > 0,
					'invert-flash': this.state.highlight,

					'time-of-day-countdowns': this.state.useTimeOfDayCountdowns,
				})}
				data-obj-id={this.props.segment._id}
				ref={this.setSegmentRef}
				role="region"
				aria-roledescription={t('segment')}
				aria-labelledby={`segment-name-${this.props.segment._id}`}
			>
				<SelectedElementsContext.Consumer>
					{(selectElementContext) => (
						<ContextMenuTrigger
							id="segment-timeline-context-menu"
							collect={this.getSegmentContext}
							attributes={{
								className: ClassNames('segment-timeline__title', {
									'element-selected': selectElementContext.isSelected(this.props.segment._id),
								}),
							}}
							holdToDisplay={contextMenuHoldToDisplayTime()}
							renderTag="div"
						>
							<div
								onDoubleClick={() => {
									if (this.props.studio.settings.enableUserEdits) {
										if (!selectElementContext.isSelected(this.props.segment._id)) {
											selectElementContext.clearAndSetSelection({ type: 'segment', elementId: this.props.segment._id })
										} else {
											selectElementContext.clearSelections()
										}
									}
								}}
							>
								<h2
									id={`segment-name-${this.props.segment._id}`}
									className={ClassNames('segment-timeline__title__label', {
										identifier: this.props.segment.identifier,
									})}
									data-identifier={this.props.segment.identifier}
								>
									{this.props.segment.name}
								</h2>
								{(criticalNotes > 0 || warningNotes > 0) && (
									<div className="segment-timeline__title__notes">
										{criticalNotes > 0 && (
											<div
												className="segment-timeline__title__notes__note segment-timeline__title__notes__note--critical"
												onClick={() =>
													this.props.onHeaderNoteClick &&
													this.props.onHeaderNoteClick(this.props.segment._id, NoteSeverity.ERROR)
												}
												aria-label={t('Critical problems')}
											>
												<CriticalIconSmall />
												<div className="segment-timeline__title__notes__count">{criticalNotes}</div>
											</div>
										)}
										{warningNotes > 0 && (
											<div
												className="segment-timeline__title__notes__note segment-timeline__title__notes__note--warning"
												onClick={() =>
													this.props.onHeaderNoteClick &&
													this.props.onHeaderNoteClick(this.props.segment._id, NoteSeverity.WARNING)
												}
												aria-label={t('Warnings')}
											>
												<WarningIconSmall />
												<div className="segment-timeline__title__notes__count">{warningNotes}</div>
											</div>
										)}
									</div>
								)}
								{identifiers.length > 0 && (
									<div className="segment-timeline__part-identifiers">
										{identifiers.map((ident) => (
											<div
												className="segment-timeline__part-identifiers__identifier"
												key={ident.partId + ''}
												onClick={() => this.onClickPartIdent(ident.partId)}
											>
												{ident.ident}
											</div>
										))}
									</div>
								)}
								<HeaderEditStates userEditOperations={this.props.segment.userEditOperations} />
							</div>
						</ContextMenuTrigger>
					)}
				</SelectedElementsContext.Consumer>
				<div className="segment-timeline__duration" tabIndex={0}>
					{this.props.playlist &&
						this.props.parts &&
						this.props.parts.length > 0 &&
						(!this.props.hasAlreadyPlayed || this.props.isNextSegment || this.props.isLiveSegment) && (
							<SegmentDuration
								segment={this.props.segment}
								parts={this.props.parts}
								label={<span className="segment-timeline__duration__label">{t('Duration')}</span>}
								fixed={this.props.fixedSegmentDuration}
							/>
						)}
				</div>

				{this.props.segment.segmentTiming?.expectedStart || this.props.segment.segmentTiming?.expectedEnd ? (
					<div className="segment-timeline__expectedTime">
						<SegmentTimeAnchorTime
							segment={this.props.segment}
							isLiveSegment={this.props.isLiveSegment}
							labelClassName="segment-timeline__expectedTime__label"
						/>
					</div>
				) : (
					<div className="segment-timeline__timeUntil" onClick={this.onTimeUntilClick}>
						{this.props.playlist &&
							this.props.parts &&
							this.props.parts.length > 0 &&
							this.props.showCountdownToSegment && (
								<PartCountdown
									partId={countdownToPartId}
									hideOnZero={!useTimeOfDayCountdowns}
									useWallClock={useTimeOfDayCountdowns}
									playlist={this.props.playlist}
									label={
										useTimeOfDayCountdowns ? (
											<span className="segment-timeline__timeUntil__label">{t('On Air At')}</span>
										) : (
											<span className="segment-timeline__timeUntil__label">{t('On Air In')}</span>
										)
									}
								/>
							)}
					</div>
				)}

				<div className="segment-timeline__mos-id">{this.props.segment.externalId}</div>
				<div className="segment-timeline__output-layers" role="tree" aria-label={t('Sources')}>
					{this.renderOutputLayerControls(activeOutputGroups)}
				</div>
				<div className="segment-timeline__timeline-background" />
				<TimelineGrid
					onResize={this.onTimelineResize}
					scrollLeft={this.props.scrollLeft}
					timeScale={this.props.timeScale}
					frameRate={this.props.studio.settings.frameRate}
					isLiveSegment={this.props.isLiveSegment}
					partInstances={this.props.parts}
					currentPartInstanceId={
						this.props.isLiveSegment ? (this.props.playlist.currentPartInfo?.partInstanceId ?? null) : null
					}
				/>
				<div
					className={ClassNames('segment-timeline__timeline-container', {
						'segment-timeline__timeline-container--grabbable': Settings.allowGrabbingTimeline,
						'segment-timeline__timeline-container--grabbed': this.state.mouseGrabbed,
					})}
					onContextMenu={this.onContextMenu}
					onMouseDown={this.onTimelineMouseDown}
					onTouchStartCapture={this.onTimelineTouchStart}
					ref={this.setTimelineRef}
				>
					<div
						className="segment-timeline__timeline"
						key={this.props.segment._id + '-timeline'}
						style={this.timelineStyle(activeOutputGroups)}
					>
						<ErrorBoundary>
							{this.renderTimeline()}
							{this.renderBudgetGapPart()}
						</ErrorBoundary>
					</div>
					{this.renderEditorialLine()}
					{this.renderLiveLine()}
				</div>
				<ErrorBoundary>
					<SegmentTimelineZoomButtons
						isLiveSegment={this.props.isLiveSegment}
						maxTimeScale={this.props.maxTimeScale}
						scrollLeft={this.props.scrollLeft}
						timeScale={this.props.timeScale}
						onRecalculateMaxTimeScale={this.props.onRecalculateMaxTimeScale}
						onScroll={this.props.onScroll}
						onShowEntireSegment={this.props.onShowEntireSegment}
						onZoomChange={this.props.onZoomChange}
					/>
				</ErrorBoundary>
				<ErrorBoundary>
					<SwitchViewModeButton currentMode={SegmentViewMode.Timeline} onSwitchViewMode={this.props.onSwitchViewMode} />
				</ErrorBoundary>
				<ErrorBoundary>
					<SegmentTimelineZoom
						onZoomDblClick={this.onZoomNormalize}
						timelineWidth={this.state.timelineWidth}
						{...this.props}
					/>
				</ErrorBoundary>
			</div>
		)
	}
}

export const SegmentTimeline = withTranslation()(
	withTiming<IProps & WithTranslation, IStateHeader>((props: IProps) => {
		return {
			tickResolution: TimingTickResolution.Synced,
			dataResolution: TimingDataResolution.High,
			filter: (durations: RundownTimingContext) => {
				durations = durations || {}

				const livePart = props.parts.find(
					(part) => part.instance._id === props.playlist.currentPartInfo?.partInstanceId
				)
				const livePartId = livePart ? getPartInstanceTimingId(livePart.instance) : undefined
				return [
					livePartId ? durations.partDisplayStartsAt?.[livePartId] : undefined,
					livePartId ? durations.partDisplayDurations?.[livePartId] : undefined,
				]
			},
		}
	})(SegmentTimelineClass)
)

interface HeaderEditStatesProps {
	userEditOperations: DBSegment['userEditOperations']
}
function HeaderEditStates({ userEditOperations }: HeaderEditStatesProps) {
	return (
		<div className="segment-timeline__title__user-edit-states">
			{userEditOperations &&
				userEditOperations.map((operation) => {
					if (operation.type !== UserEditingType.ACTION || !operation.icon || !operation.isActive) return null

					return (
						<BlueprintAssetIcon
							key={operation.id}
							src={operation.icon}
							className="segment-timeline__title__user-edit-state"
						/>
					)
				})}
		</div>
	)
}
