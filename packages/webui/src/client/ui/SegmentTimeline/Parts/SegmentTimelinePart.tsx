import React from 'react'
import _ from 'underscore'
import { withTranslation, WithTranslation, TFunction } from 'react-i18next'

import ClassNames from 'classnames'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { SegmentUi, PartUi, IOutputLayerUi, PieceUi } from '../SegmentTimelineContainer.js'
import {
	TimingDataResolution,
	TimingTickResolution,
	WithTiming,
	withTiming,
} from '../../RundownView/RundownTiming/withTiming.js'
import { RundownTiming } from '../../RundownView/RundownTiming/RundownTiming.js'

import { RundownUtils } from '../../../lib/rundown.js'
import { getCurrentTime } from '../../../lib/systemTime.js'

import { DEBUG_MODE } from '../SegmentTimelineDebugMode.js'
import { Translated } from '../../../lib/ReactMeteorData/ReactMeteorData.js'

import { IContextMenuContext } from '../../RundownView.js'
import { CSSProperties } from '../../../styles/_cssVariables.js'
import RundownViewEventBus, {
	RundownViewEvents,
	HighlightEvent,
} from '@sofie-automation/meteor-lib/dist/triggers/RundownViewEventBus'
import { LoopingIcon } from '../../../lib/ui/icons/looping.js'
import { SegmentEnd } from '../../../lib/ui/icons/segment.js'
import { getShowHiddenSourceLayers } from '../../../lib/localStorage.js'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import {
	getPartInstanceTimingId,
	getPartInstanceTimingValue,
	RundownTimingContext,
} from '../../../lib/rundownTiming.js'
import { OutputGroup } from './OutputGroup.js'
import { InvalidPartCover } from './InvalidPartCover.js'
import { DefaultUserOperationsTypes, ISourceLayer, UserEditingType } from '@sofie-automation/blueprints-integration'
import { UIStudio } from '@sofie-automation/meteor-lib/dist/api/studios'
import { LIVE_LINE_TIME_PADDING } from '../Constants.js'
import * as RundownResolver from '../../../lib/RundownResolver.js'
import { Events as MOSEvents } from '../../../lib/data/mos/plugin-support.js'

export const SegmentTimelineLineElementId = 'rundown__segment__line__'
export const SegmentTimelinePartElementId = 'rundown__segment__part__'

/** The width at which a Part is too small to attempt displaying text labels on Pieces, in pixels */
export const BREAKPOINT_TOO_SMALL_FOR_TEXT = 30

/** The width at which a Part is too small to be drawn at all, in pixels */
export const BREAKPOINT_TOO_SMALL_FOR_DISPLAY = 6

interface IProps {
	segment: SegmentUi
	playlist: DBRundownPlaylist
	studio: UIStudio
	part: PartUi
	timeToPixelRatio: number
	onCollapseOutputToggle?: (layer: IOutputLayerUi, event: any) => void
	collapsedOutputs: {
		[key: string]: boolean
	}
	isCollapsed?: boolean
	scrollLeft: number
	scrollWidth: number
	onScroll?: (scrollLeft: number, event: any) => void
	onFollowLiveLine?: (state: boolean, event: any) => void
	onPieceClick?: (piece: PieceUi, e: React.MouseEvent<HTMLDivElement>) => void
	onPieceDoubleClick?: (item: PieceUi, e: React.MouseEvent<HTMLDivElement>) => void
	onPartTooSmallChanged?: (part: PartUi, displayDuration: number | false, expectedDuration: number | false) => void
	followLiveLine: boolean
	autoNextPart: boolean
	liveLineHistorySize: number
	livePosition: number | null
	totalSegmentDuration?: number
	firstPartInSegment?: PartUi
	lastPartInSegment?: PartUi
	onContextMenu?: (contextMenuContext: IContextMenuContext) => void
	isLastInSegment: boolean
	isAfterLastValidInSegmentAndItsLive: boolean
	isLastSegment: boolean
	isBudgetGap?: boolean
	isPreview?: boolean
	cropDuration?: number
	className?: string
	showDurationSourceLayers?: Set<ISourceLayer['_id']>
	isLiveSegment: boolean | undefined
	anyPriorPartWasLive: boolean | undefined
	livePartStartsAt: number | undefined
	livePartDisplayDuration: number | undefined
	budgetDuration: number | undefined
}

interface IState {
	isLive: boolean
	isNext: boolean
	isDurationSettling: boolean
	durationSettlingStartsAt: number
	liveDuration: number
	isInQuickLoop: boolean

	isInsideViewport: boolean
	isTooSmallForText: boolean
	isTooSmallForDisplay: boolean
	highlight: boolean

	dropActive: boolean
}
export class SegmentTimelinePartClass extends React.Component<Translated<WithTiming<IProps>>, IState> {
	constructor(props: Readonly<Translated<WithTiming<IProps>>>) {
		super(props)

		const partInstance = this.props.part.instance

		const isLive = this.props.playlist.currentPartInfo?.partInstanceId === partInstance._id
		const isNext = this.props.playlist.nextPartInfo?.partInstanceId === partInstance._id
		const isInQuickLoop =
			this.props.timingDurations.partsInQuickLoop?.[getPartInstanceTimingId(this.props.part.instance)] ?? false
		const startedPlayback = partInstance.timings?.plannedStartedPlayback

		this.state = {
			isLive,
			isNext,
			isDurationSettling: false,
			durationSettlingStartsAt: 0,
			isInsideViewport: false,
			isTooSmallForText: false,
			isTooSmallForDisplay: false,
			isInQuickLoop,
			highlight: false,
			liveDuration: isLive
				? Math.max(
						(startedPlayback &&
							props.timingDurations.partDurations &&
							SegmentTimelinePartClass.getCurrentLiveLinePosition(
								props.part,
								props.timingDurations.currentTime || getCurrentTime()
							) + SegmentTimelinePartClass.getLiveLineTimePadding(props.timeToPixelRatio)) ||
							0,
						props.timingDurations.partDurations
							? partInstance.part.displayDuration ||
									props.timingDurations.partDurations[getPartInstanceTimingId(partInstance)]
							: 0
					)
				: 0,
			dropActive: false,
		}
	}

	static getDerivedStateFromProps(
		nextProps: Readonly<IProps & RundownTiming.InjectedROTimingProps>,
		state: Readonly<IState>
	): Partial<IState> {
		const isPrevious = nextProps.playlist.previousPartInfo?.partInstanceId === nextProps.part.instance._id
		const isLive = nextProps.playlist.currentPartInfo?.partInstanceId === nextProps.part.instance._id
		const isNext = nextProps.playlist.nextPartInfo?.partInstanceId === nextProps.part.instance._id

		const isInQuickLoop =
			nextProps.timingDurations.partsInQuickLoop?.[getPartInstanceTimingId(nextProps.part.instance)] ?? false

		const nextPartInstance = nextProps.part.instance

		const startedPlayback = nextProps.part.instance.timings?.plannedStartedPlayback

		const isDurationSettling =
			!!nextProps.playlist.activationId &&
			isPrevious &&
			!isLive &&
			!!startedPlayback &&
			!nextProps.part.instance.timings?.duration

		let durationSettlingStartsAt = state.durationSettlingStartsAt
		if (!state.isDurationSettling && isDurationSettling) {
			durationSettlingStartsAt = SegmentTimelinePartClass.getCurrentLiveLinePosition(
				nextProps.part,
				nextProps.timingDurations.currentTime || getCurrentTime()
			)
			//console.log('Start Duration Settling in Part : ', nextState.partId)
		}

		let liveDuration = 0
		if (!isDurationSettling) {
			// if the duration isn't settling, calculate the live line position and add some liveLive time padding
			if (isLive && !nextProps.autoNextPart && !nextPartInstance.part.autoNext) {
				liveDuration = Math.max(
					(startedPlayback &&
						nextProps.timingDurations.partDurations &&
						SegmentTimelinePartClass.getCurrentLiveLinePosition(
							nextProps.part,
							nextProps.timingDurations.currentTime || getCurrentTime()
						) + SegmentTimelinePartClass.getLiveLineTimePadding(nextProps.timeToPixelRatio)) ||
						0,
					nextProps.timingDurations.partDurations
						? nextPartInstance.part.displayDuration ||
								nextProps.timingDurations.partDurations[getPartInstanceTimingId(nextPartInstance)]
						: 0
				)
			}
			durationSettlingStartsAt = 0
		}

		const partDisplayDuration = SegmentTimelinePartClass.getPartDuration(
			nextProps,
			liveDuration,
			isDurationSettling,
			durationSettlingStartsAt
		)

		const isInsideViewport =
			isLive ||
			RundownUtils.isInsideViewport(
				nextProps.scrollLeft,
				nextProps.scrollWidth,
				nextProps.part,
				SegmentTimelinePartClass.getPartStartsAt(nextProps),
				partDisplayDuration
			)

		const partDisplayWidth = partDisplayDuration * nextProps.timeToPixelRatio
		const isTooSmallForText = !isLive && partDisplayWidth < BREAKPOINT_TOO_SMALL_FOR_TEXT
		const isTooSmallForDisplay = !isLive && partDisplayWidth < BREAKPOINT_TOO_SMALL_FOR_DISPLAY

		const partial = {
			isLive,
			isNext,
			isInQuickLoop,

			isDurationSettling,
			durationSettlingStartsAt,
			liveDuration,
			isInsideViewport,
			isTooSmallForText,
			isTooSmallForDisplay,
		}

		return partial
	}

	static getLiveLineTimePadding(timeScale: number): number {
		return timeScale === 0 ? 0 : LIVE_LINE_TIME_PADDING / timeScale
	}

	static getCurrentLiveLinePosition(part: Readonly<PartUi>, currentTime: number): number {
		if (part.instance.timings?.plannedStartedPlayback) {
			if (part.instance.timings?.duration) {
				return part.instance.timings.duration
			} else {
				return currentTime - part.instance.timings.plannedStartedPlayback
			}
		} else {
			return 0
		}
	}

	private highlightTimeout: NodeJS.Timeout | undefined

	private onHighlight = (e: HighlightEvent) => {
		if (e && e.partId === this.props.part.partId && !e.pieceId) {
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

	componentDidMount(): void {
		super.componentDidMount?.()

		window.addEventListener(MOSEvents.dragenter, this.onDragEnter)
		window.addEventListener(MOSEvents.dragleave, this.onDragLeave)

		RundownViewEventBus.on(RundownViewEvents.HIGHLIGHT, this.onHighlight)
		const tooSmallState = this.state.isTooSmallForDisplay || this.state.isTooSmallForText
		if (tooSmallState && this.props.onPartTooSmallChanged) {
			this.props.onPartTooSmallChanged(
				this.props.part,
				SegmentTimelinePartClass.getPartDuration(
					this.props,
					this.state.liveDuration,
					this.state.isDurationSettling,
					this.state.durationSettlingStartsAt
				),
				SegmentTimelinePartClass.getPartActualDuration(this.props.part, this.props.timingDurations)
			)
		}
	}

	componentWillUnmount(): void {
		super.componentWillUnmount?.()

		window.removeEventListener(MOSEvents.dragenter, this.onDragEnter)
		window.removeEventListener(MOSEvents.dragleave, this.onDragLeave)

		RundownViewEventBus.off(RundownViewEvents.HIGHLIGHT, this.onHighlight)
		if (this.highlightTimeout) clearTimeout(this.highlightTimeout)
	}

	shouldComponentUpdate(nextProps: Readonly<WithTiming<IProps>>, nextState: Readonly<IState>): boolean {
		if (!_.isMatch(this.props, nextProps) || !_.isMatch(this.state, nextState)) {
			return true
		} else {
			return false
		}
	}

	componentDidUpdate(prevProps: Readonly<Translated<WithTiming<IProps>>>, prevState: IState, snapshot?: unknown): void {
		super.componentDidUpdate?.(prevProps, prevState, snapshot)
		const tooSmallState = this.state.isTooSmallForDisplay || this.state.isTooSmallForText
		const prevTooSmallState = prevState.isTooSmallForDisplay || prevState.isTooSmallForText
		if (tooSmallState !== prevTooSmallState && this.props.onPartTooSmallChanged) {
			this.props.onPartTooSmallChanged(
				this.props.part,
				tooSmallState
					? SegmentTimelinePartClass.getPartDuration(
							this.props,
							this.state.liveDuration,
							this.state.isDurationSettling,
							this.state.durationSettlingStartsAt
						)
					: false,
				SegmentTimelinePartClass.getPartActualDuration(this.props.part, this.props.timingDurations)
			)
		}
	}

	getLayerStyle(): React.CSSProperties {
		let partDuration: number
		if (this.props.isBudgetGap && typeof this.props.budgetDuration === 'number') {
			partDuration = this.props.budgetDuration - SegmentTimelinePartClass.getPartStartsAt(this.props)
		} else {
			const partDisplayDuration = SegmentTimelinePartClass.getPartDisplayDuration(
				this.props.part,
				this.props.timingDurations
			)
			partDuration = this.props.cropDuration
				? Math.min(this.props.cropDuration, partDisplayDuration)
				: partDisplayDuration
		}

		const futureShadeDuration =
			this.state.isLive || (this.props.isBudgetGap && this.props.isLiveSegment) ? this.getFutureShadePaddingTime() : 0
		const partDurationWithFutureShadeAccountedFor = this.props.isBudgetGap
			? partDuration - futureShadeDuration
			: partDuration + futureShadeDuration

		return {
			width: (partDurationWithFutureShadeAccountedFor * this.props.timeToPixelRatio).toString() + 'px',
		}
	}

	getPartStyle(): React.CSSProperties {
		const style = this.getLayerStyle()

		let timeOffset = SegmentTimelinePartClass.getPartStartsAt(this.props)
		if (this.props.isLiveSegment && this.props.anyPriorPartWasLive && !this.state.isLive) {
			timeOffset += this.getFutureShadePaddingTime()
		}

		const liveWillChangeValue = `transform, width`

		return {
			...style,
			transform: `translateX(${this.convertTimeToPixels(timeOffset)}px)`,
			willChange: this.props.isLiveSegment ? liveWillChangeValue : 'none',
		}
	}

	private convertTimeToPixels = (time: number) => {
		return this.props.timeToPixelRatio * time
	}

	static getPartDuration(
		props: WithTiming<IProps>,
		liveDuration: number,
		isDurationSettling: boolean,
		durationSettlingStartsAt: number
	): number {
		if (isDurationSettling) {
			return durationSettlingStartsAt
		}
		return Math.max(
			!props.isPreview ? liveDuration : 0,
			SegmentTimelinePartClass.getPartDisplayDuration(props.part, props.timingDurations)
		)
	}

	static getPartDisplayDuration(part: PartUi, timingDurations: RundownTimingContext): number {
		return (
			(timingDurations.partDisplayDurations &&
				timingDurations.partDisplayDurations[getPartInstanceTimingId(part.instance)]) ||
			part.renderedDuration ||
			0
		)
	}

	static getPartActualDuration(part: PartUi, timingDurations: RundownTimingContext): number {
		return timingDurations?.partDurations?.[getPartInstanceTimingId(part.instance)] ?? part.renderedDuration
	}

	static getPartStartsAt(props: WithTiming<IProps>): number {
		if (props.isBudgetGap) {
			return Math.max(
				0,
				(props.lastPartInSegment &&
					props.firstPartInSegment &&
					(getPartInstanceTimingValue(props.timingDurations.partDisplayStartsAt, props.lastPartInSegment.instance) ??
						0) -
						(getPartInstanceTimingValue(props.timingDurations.partDisplayStartsAt, props.firstPartInSegment.instance) ??
							0) +
						(getPartInstanceTimingValue(props.timingDurations.partDisplayDurations, props.lastPartInSegment.instance) ??
							0)) ||
					0
			)
		}
		return Math.max(
			0,
			(props.firstPartInSegment &&
				(getPartInstanceTimingValue(props.timingDurations.partDisplayStartsAt, props.part.instance) ?? 0) -
					(getPartInstanceTimingValue(props.timingDurations.partDisplayStartsAt, props.firstPartInSegment.instance) ??
						0)) ||
				0
		)
	}

	static getPartEndsAt(
		props: WithTiming<IProps>,
		liveDuration: number,
		isDurationSettling: boolean,
		durationSettlingStartsAt: number
	): number {
		return (
			SegmentTimelinePartClass.getPartStartsAt(props) +
			SegmentTimelinePartClass.getPartDuration(props, liveDuration, isDurationSettling, durationSettlingStartsAt)
		)
	}

	private renderTimelineOutputGroups(part: PartUi) {
		if (this.props.segment.outputLayers !== undefined) {
			const showHiddenSourceLayers = getShowHiddenSourceLayers()

			let indexAccumulator = 0

			return Object.values<IOutputLayerUi>(this.props.segment.outputLayers)
				.filter((layer) => {
					return layer.used ? true : false
				})
				.sort((a, b) => {
					return a._rank - b._rank
				})
				.map((layer) => {
					// Only render output layers used by the segment
					if (layer.used) {
						const sourceLayers = layer.sourceLayers
							.filter((i) => showHiddenSourceLayers || !i.isHidden)
							.sort((a, b) => a._rank - b._rank)
						const currentIndex = indexAccumulator
						const isCollapsed =
							this.props.collapsedOutputs[layer._id] !== undefined
								? this.props.collapsedOutputs[layer._id] === true
								: layer.isDefaultCollapsed
						const isFlattened = layer.collapsed || false

						indexAccumulator += isFlattened || isCollapsed ? 1 : sourceLayers.length
						return (
							<OutputGroup
								key={layer._id}
								collapsedOutputs={this.props.collapsedOutputs}
								followLiveLine={this.props.followLiveLine}
								liveLineHistorySize={this.props.liveLineHistorySize}
								livePosition={this.props.livePosition}
								onContextMenu={this.props.onContextMenu}
								onFollowLiveLine={this.props.onFollowLiveLine}
								onPieceClick={this.props.onPieceClick}
								onPieceDoubleClick={this.props.onPieceDoubleClick}
								scrollLeft={this.props.scrollLeft}
								scrollWidth={this.props.scrollWidth}
								layer={layer}
								sourceLayers={sourceLayers}
								segment={this.props.segment}
								part={part}
								playlist={this.props.playlist}
								studio={this.props.studio}
								startsAt={SegmentTimelinePartClass.getPartStartsAt(this.props) || this.props.part.startsAt || 0}
								duration={
									this.props.cropDuration
										? Math.min(
												this.props.cropDuration,
												SegmentTimelinePartClass.getPartDuration(
													this.props,
													this.state.liveDuration,
													this.state.isDurationSettling,
													this.state.durationSettlingStartsAt
												)
											)
										: SegmentTimelinePartClass.getPartDuration(
												this.props,
												this.state.liveDuration,
												this.state.isDurationSettling,
												this.state.durationSettlingStartsAt
											)
								}
								displayDuration={SegmentTimelinePartClass.getPartDisplayDuration(
									this.props.part,
									this.props.timingDurations
								)}
								isLiveLine={this.props.playlist.currentPartInfo?.partInstanceId === part.instance._id}
								isNextLine={this.props.playlist.nextPartInfo?.partInstanceId === part.instance._id}
								isTooSmallForText={this.state.isTooSmallForText}
								timeScale={this.props.timeToPixelRatio}
								autoNextPart={this.props.autoNextPart}
								liveLinePadding={SegmentTimelinePartClass.getLiveLineTimePadding(this.props.timeToPixelRatio)}
								indexOffset={currentIndex}
								isPreview={this.props.isPreview || false}
								showDurationSourceLayers={this.props.showDurationSourceLayers}
							/>
						)
					}
				})
		}
	}

	private getFutureShadePaddingTime = () => {
		if (this.props.autoNextPart) {
			return 0
		}

		/**
		 * How far into the live part we are, in milliseconds.
		 */
		const timeIntoLivePart = Math.max(0, (this.props.livePosition || 0) - (this.props.livePartStartsAt || 0))

		/**
		 * The maximum amount of live line time padding to add, in milliseconds.
		 */
		const maxPadding = SegmentTimelinePartClass.getLiveLineTimePadding(this.props.timeToPixelRatio)

		/**
		 * The amount of live line time padding to add, based on some simple math, in milliseconds.
		 */
		const computedPadding = Math.max(0, timeIntoLivePart + maxPadding - (this.props.livePartDisplayDuration || 0))

		return Math.min(computedPadding, maxPadding)
	}

	private getFutureShadePaddingPixels = () => {
		return this.getFutureShadePaddingTime() * this.props.timeToPixelRatio
	}

	private getFutureShadeStyle = () => {
		return {
			width: this.getFutureShadePaddingPixels() + 'px',
		}
	}

	private renderEndOfSegment = (
		t: TFunction,
		innerPart: DBPart,
		isEndOfShow: boolean,
		isEndOfLoopingShow?: boolean
	) => {
		const isNext =
			this.state.isLive &&
			((!this.props.isLastSegment && !this.props.isLastInSegment) || !!this.props.playlist.nextPartInfo) &&
			!innerPart.invalid
		let timeOffset = SegmentTimelinePartClass.getPartDisplayDuration(this.props.part, this.props.timingDurations)

		if (this.state.isLive) {
			timeOffset += this.getFutureShadePaddingTime()
		}
		return (
			<div
				className={ClassNames('segment-timeline__part__end-of-segment', { 'is-live': this.state.isLive })}
				style={{
					transform: `translateX(${this.convertTimeToPixels(timeOffset)}px)`,
				}}
			>
				{this.props.isLastInSegment && !this.props.isBudgetGap && (
					<div
						className={ClassNames('segment-timeline__part__nextline', 'segment-timeline__part__nextline--endline', {
							'auto-next': innerPart.autoNext,
							'is-next': isNext,
							'show-end': isEndOfShow,
						})}
					>
						<div
							className={ClassNames('segment-timeline__part__nextline__label', {
								'segment-timeline__part__nextline__label--thin': innerPart.autoNext && !this.state.isLive,
							})}
						>
							{innerPart.autoNext ? t('Auto') : this.state.isLive ? t('Next') : null}
							{isEndOfLoopingShow && <LoopingIcon />}
						</div>
					</div>
				)}
				{!isEndOfShow && !isEndOfLoopingShow && this.props.isLastInSegment && !innerPart.invalid && (
					<div
						className={ClassNames('segment-timeline__part__segment-end', {
							'is-next': isNext,
						})}
					>
						<div className="segment-timeline__part__segment-end__label">
							<SegmentEnd />
						</div>
					</div>
				)}
				{(isEndOfShow || isEndOfLoopingShow) && (
					<div
						className={ClassNames('segment-timeline__part__show-end', {
							loop: isEndOfLoopingShow,
						})}
					>
						<div className="segment-timeline__part__show-end__label">
							{isEndOfLoopingShow ? t('Loops to Start') : t('Show End')}
						</div>
					</div>
				)}
				{}
			</div>
		)
	}

	static convertHexToRgb(hexColor: string): { red: number; green: number; blue: number } | undefined {
		if (hexColor.substr(0, 1) !== '#') return
		if (hexColor.length !== 7) return

		const red = parseInt(hexColor.substr(1, 2), 16)
		const green = parseInt(hexColor.substr(3, 2), 16)
		const blue = parseInt(hexColor.substr(5, 2), 16)

		return { red, green, blue }
	}

	onDragEnter = (): void => {
		const supportsDrop = this.props.part.instance.part.userEditOperations?.find(
			(op) => op.type === UserEditingType.SOFIE && op.id === DefaultUserOperationsTypes.IMPORT_MOS_ITEM
		)
		if (!supportsDrop) return

		this.setState({
			dropActive: true,
		})
	}

	onDragLeave = (): void => {
		this.setState({
			dropActive: false,
		})
	}

	render(): JSX.Element | null {
		// optimize early, if not inside viewport
		if (!this.state.isInsideViewport) {
			return null
		}

		const { t } = this.props

		const innerPart = this.props.part.instance.part

		const isEndOfShow =
			this.props.isLastSegment &&
			this.props.isLastInSegment &&
			(!this.state.isLive || (this.state.isLive && !this.props.playlist.nextPartInfo))
		const isPlaylistLooping = RundownResolver.isLoopRunning(this.props.playlist)
		const isPartEndOfLoopingShow = RundownResolver.isEndOfLoopingShow(
			this.props.playlist,
			this.props.isLastSegment,
			this.props.isLastInSegment,
			this.props.part.instance.part
		)
		let invalidReasonColorVars: CSSProperties | undefined = undefined
		if (innerPart.invalidReason && innerPart.invalidReason.color) {
			const invalidColor = SegmentTimelinePartClass.convertHexToRgb(innerPart.invalidReason.color)
			if (invalidColor) {
				invalidReasonColorVars = {
					['--invalid-reason-color-opaque']: `rgba(${invalidColor.red}, ${invalidColor.green}, ${invalidColor.blue}, 1)`,
					['--invalid-reason-color-transparent']: `rgba(${invalidColor.red}, ${invalidColor.green}, ${invalidColor.blue}, 0)`,
				}
			}
		}

		const isOutsideActiveQuickLoop =
			!this.state.isInQuickLoop && RundownResolver.isLoopRunning(this.props.playlist) && !this.state.isNext
		const isQuickLoopStart = RundownResolver.isQuickLoopStart(this.props.part.partId, this.props.playlist)
		const isQuickLoopEnd = RundownResolver.isQuickLoopEnd(this.props.part.partId, this.props.playlist)

		if (
			this.state.isInsideViewport &&
			(!this.state.isTooSmallForDisplay || this.state.isLive || this.state.isNext || this.props.isBudgetGap)
		) {
			return (
				<div
					className={ClassNames(
						'segment-timeline__part',
						{
							live: this.state.isLive,
							next: (this.state.isNext || this.props.isAfterLastValidInSegmentAndItsLive) && !innerPart.invalid,
							invalid: innerPart.invalid && !innerPart.gap,
							floated: innerPart.floated,
							gap: innerPart.gap,
							'invert-flash': this.state.highlight,

							'duration-settling': this.state.isDurationSettling,
							'budget-gap': this.props.isBudgetGap,

							'outside-quickloop': isOutsideActiveQuickLoop,
							'quickloop-start': isQuickLoopStart,
							'quickloop-end': isQuickLoopEnd,

							'drop-active': this.state.dropActive,
						},
						this.props.className
					)}
					data-obj-id={this.props.part.instance._id}
					id={SegmentTimelinePartElementId + this.props.part.instance._id}
					style={{ ...this.getPartStyle(), ...invalidReasonColorVars }}
					role="region"
					aria-roledescription={t('part')}
					aria-label={this.props.part.instance.part.title}
					data-part-id={this.props.part.partId}
				>
					{DEBUG_MODE && (
						<div className="segment-timeline__debug-info">
							{this.props.livePosition} / {this.props.part.startsAt} /{' '}
							{
								((this.props.timingDurations || { partStartsAt: {} }).partStartsAt || {})[
									getPartInstanceTimingId(this.props.part.instance)
								]
							}
						</div>
					)}
					{this.renderTimelineOutputGroups(this.props.part)}
					{innerPart.invalid ? (
						<InvalidPartCover className="segment-timeline__part__invalid-cover" part={innerPart} />
					) : null}
					{innerPart.floated ? <div className="segment-timeline__part__floated-cover"></div> : null}
					{this.props.playlist.nextTimeOffset &&
						this.state.isNext && ( // This is the off-set line
							<div
								className={ClassNames('segment-timeline__part__nextline', {
									// This is the base, basic line
									'auto-next':
										!innerPart.invalid &&
										!innerPart.gap &&
										((this.state.isNext && this.props.autoNextPart) ||
											(!this.state.isNext && this.props.part.willProbablyAutoNext)),
									invalid: innerPart.invalid && !innerPart.gap,
									floated: innerPart.floated,
								})}
								style={{
									left: Math.round(this.props.playlist.nextTimeOffset * this.props.timeToPixelRatio) + 'px',
								}}
							>
								<div
									className={ClassNames('segment-timeline__part__nextline__label', {
										'segment-timeline__part__nextline__label--thin':
											(this.props.autoNextPart || this.props.part.willProbablyAutoNext) && !this.state.isNext,
									})}
								>
									{innerPart.invalid && !innerPart.gap ? null : (
										<React.Fragment>
											{this.props.autoNextPart || this.props.part.willProbablyAutoNext
												? t('Auto')
												: this.state.isNext
													? t('Next')
													: null}
										</React.Fragment>
									)}
								</div>
							</div>
						)}
					{this.state.isLive && !this.props.autoNextPart && !innerPart.autoNext && (
						<div className="segment-timeline__part__future-shade" style={this.getFutureShadeStyle()}></div>
					)}
					{!this.props.isBudgetGap && (
						<div
							className={ClassNames('segment-timeline__part__nextline', {
								// This is the base, basic line
								'auto-next':
									(this.state.isNext && this.props.autoNextPart) ||
									(!this.state.isNext && this.props.part.willProbablyAutoNext),
								invalid: innerPart.invalid && !innerPart.gap,
								floated: innerPart.floated,
								offset: !!this.props.playlist.nextTimeOffset,
								'quickloop-start': isQuickLoopStart,
							})}
						>
							<div
								className={ClassNames('segment-timeline__part__nextline__label', {
									'segment-timeline__part__nextline__label--thin':
										(this.props.autoNextPart || this.props.part.willProbablyAutoNext) && !this.state.isNext,
								})}
							>
								{innerPart.invalid && !innerPart.gap ? null : (
									<React.Fragment>
										{(this.state.isNext && this.props.autoNextPart) ||
										(!this.state.isNext && this.props.part.willProbablyAutoNext)
											? t('Auto')
											: this.state.isNext || this.props.isAfterLastValidInSegmentAndItsLive
												? t('Next')
												: null}
									</React.Fragment>
								)}
								{this.props.isAfterLastValidInSegmentAndItsLive && !isPlaylistLooping && <SegmentEnd />}
								{this.props.isAfterLastValidInSegmentAndItsLive && isPlaylistLooping && <LoopingIcon />}
							</div>
							<div className="segment-timeline__part__bottom-line">
								{this.state.isInQuickLoop && <div className="segment-timeline__part__quickloop-background"></div>}
								{!this.props.isPreview && this.props.part.instance.part.identifier && (
									<div className="segment-timeline__identifier">{this.props.part.instance.part.identifier}</div>
								)}
								{isQuickLoopStart ? (
									<div className="segment-timeline__part__quickloop-start">
										<LoopingIcon />
									</div>
								) : null}
								{isQuickLoopEnd ? (
									<div className="segment-timeline__part__quickloop-end">
										<LoopingIcon />
									</div>
								) : null}
							</div>
							{isQuickLoopStart && <div className="segment-timeline__part__nextline__quickloop-start" />}
						</div>
					)}
					{isQuickLoopEnd && <div className="segment-timeline__part__nextline__quickloop-end" />}
					{this.renderEndOfSegment(t, innerPart, isEndOfShow, isPartEndOfLoopingShow)}
				</div>
			)
		} else {
			// render placeholders
			return (
				<div
					className={ClassNames(
						'segment-timeline__part',
						{
							'segment-timeline__part--too-small': this.state.isInsideViewport,
							live: this.state.isLive,
							next: this.state.isNext,
						},
						this.props.className
					)}
					data-obj-id={this.props.part.instance._id}
					style={this.getPartStyle()}
				>
					{/* render it empty, just to take up space */}
					{this.state.isInsideViewport
						? this.renderEndOfSegment(t, innerPart, isEndOfShow, isPartEndOfLoopingShow)
						: null}
				</div>
			)
		}
	}
}

export const SegmentTimelinePart = withTranslation()(
	withTiming<IProps & WithTranslation, IState>((props: IProps) => {
		return {
			tickResolution: TimingTickResolution.Synced,
			dataResolution: TimingDataResolution.High,
			filter: (durations: RundownTimingContext) => {
				durations = durations || {}

				const timingId = getPartInstanceTimingId(props.part.instance)
				const firstPartInSegmentId = props.firstPartInSegment
					? getPartInstanceTimingId(props.firstPartInSegment.instance)
					: undefined
				return [
					(durations.partDurations || {})[timingId],
					(durations.partDisplayStartsAt || {})[timingId],
					(durations.partDisplayDurations || {})[timingId],
					(durations.partsInQuickLoop || {})[timingId],
					firstPartInSegmentId ? (durations.partDisplayStartsAt || {})[firstPartInSegmentId] : undefined,
					firstPartInSegmentId ? (durations.partDisplayDurations || {})[firstPartInSegmentId] : undefined,
				]
			},
		}
	})(SegmentTimelinePartClass)
)
