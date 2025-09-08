import React, { useMemo } from 'react'
import _ from 'underscore'
import { SegmentTimeline, SegmentTimelineClass } from './SegmentTimeline.js'
import {
	computeSegmentDisplayDuration,
	RundownTiming,
	TimingEvent,
} from '../RundownView/RundownTiming/RundownTiming.js'
import { UIStateStorage } from '../../lib/UIStateStorage.js'
import { PartExtended } from '../../lib/RundownResolver.js'
import { SpeechSynthesiser } from '../../lib/speechSynthesis.js'
import { getElementWidth } from '../../utils/dimensions.js'
import { isMaintainingFocus, scrollToSegment, getHeaderHeight } from '../../lib/viewPort.js'
import { unprotectString } from '../../lib/tempLib.js'
import { equivalentArrays } from '@sofie-automation/shared-lib/dist/lib/lib'
import { Settings } from '../../lib/Settings.js'
import RundownViewEventBus, {
	RundownViewEvents,
	GoToPartEvent,
	GoToPartInstanceEvent,
} from '@sofie-automation/meteor-lib/dist/triggers/RundownViewEventBus'
import { SegmentTimelinePartClass } from './Parts/SegmentTimelinePart.js'
import {
	PartUi,
	withResolvedSegment,
	IResolvedSegmentProps,
	ITrackedResolvedSegmentProps,
	IOutputLayerUi,
} from '../SegmentContainer/withResolvedSegment.js'
import { computeSegmentDuration, getPartInstanceTimingId } from '../../lib/rundownTiming.js'
import { RundownViewShelf } from '../RundownView/RundownViewShelf.js'
import { PartInstanceId, SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { catchError, useDebounce } from '../../lib/lib.js'
import { CorelibPubSub } from '@sofie-automation/corelib/dist/pubsub'
import { useSubscription, useTracker } from '../../lib/ReactMeteorData/ReactMeteorData.js'
import { logger } from '../../lib/logging.js'
import {
	FALLBACK_ZOOM_FACTOR,
	LIVELINE_HISTORY_SIZE,
	MINIMUM_ZOOM_FACTOR,
	SIMULATED_PLAYBACK_HARD_MARGIN,
	TIMELINE_RIGHT_PADDING,
} from './Constants.js'
import { UIPartInstances, UIParts } from '../Collections.js'
import { RundownTimingProviderContext } from '../RundownView/RundownTiming/withTiming.js'

// Kept for backwards compatibility
export type {
	SegmentUi,
	PartUi,
	PieceUi,
	ISourceLayerUi,
	IOutputLayerUi,
} from '../SegmentContainer/withResolvedSegment.js'

interface IState {
	scrollLeft: number
	collapsedOutputs: {
		[key: string]: boolean
	}
	followLiveLine: boolean
	livePosition: number
	displayTimecode: number
	isLiveSegment: boolean
	isNextSegment: boolean
	currentLivePart: PartUi | undefined
	currentNextPart: PartUi | undefined
	autoNextPart: boolean
	budgetDuration: number | undefined
	budgetGap: number
	timeScale: number
	maxTimeScale: number
	showingAllSegment: boolean
}

interface IProps extends IResolvedSegmentProps {
	id: string
}

export function SegmentTimelineContainer(props: Readonly<IProps>): JSX.Element {
	const partIds = useTracker(
		() =>
			UIParts.find(
				{
					segmentId: props.segmentId,
				},
				{
					fields: {
						_id: 1,
					},
				}
			).map((part) => part._id),
		[props.segmentId],
		[]
	)
	useSubscription(CorelibPubSub.pieces, [props.rundownId], partIds)

	const partInstanceIds = useTracker(
		() =>
			UIPartInstances.find(
				{
					segmentId: props.segmentId,
					reset: {
						$ne: true,
					},
				},
				{
					fields: {
						_id: 1,
						part: 1,
					},
				}
			).map((instance) => instance._id),
		[props.segmentId]
	)

	const debouncedPartInstanceIds = useDebounce<PartInstanceId[] | undefined>(
		partInstanceIds,
		40,
		(oldVal, newVal) => !oldVal || (!!newVal && !equivalentArrays(oldVal, newVal))
	)
	useSubscription(CorelibPubSub.pieceInstances, [props.rundownId], debouncedPartInstanceIds ?? [], {})

	// Convert to an array and sort to allow the `useSubscription` to better detect them being unchanged
	const sortedSegmentIds = useMemo(() => {
		const segmentIds = Array.from(props.segmentsIdsBefore.values())

		segmentIds.sort()

		return segmentIds
	}, [props.segmentsIdsBefore])
	const sortedRundownIds = useMemo(() => {
		const rundownIds = Array.from(props.rundownIdsBefore.values())

		rundownIds.sort()

		return rundownIds
	}, [props.rundownIdsBefore])

	// past infinites subscription
	useSubscription(CorelibPubSub.piecesInfiniteStartingBefore, props.rundownId, sortedSegmentIds, sortedRundownIds)

	return <SegmentTimelineContainerContent {...props} />
}

const SegmentTimelineContainerContent = withResolvedSegment(
	class SegmentTimelineContainerContent extends React.Component<IProps & ITrackedResolvedSegmentProps, IState> {
		static contextType = RundownTimingProviderContext
		declare context: React.ContextType<typeof RundownTimingProviderContext>

		isVisible: boolean
		visibilityChangeTimeout: NodeJS.Timeout | undefined
		rundownCurrentPartInstanceId: PartInstanceId | null = null
		timelineDiv: HTMLDivElement | null = null
		intersectionObserver: IntersectionObserver | undefined
		mountedTime = 0
		nextPartOffset = 0

		constructor(props: IProps & ITrackedResolvedSegmentProps) {
			super(props)

			this.state = {
				collapsedOutputs: UIStateStorage.getItemBooleanMap(
					`rundownView.${this.props.playlist._id}`,
					`segment.${props.segmentId}.outputs`,
					{}
				),
				scrollLeft: 0,
				followLiveLine: false,
				livePosition: 0,
				displayTimecode: 0,
				isLiveSegment: !!props.ownCurrentPartInstance,
				isNextSegment: !!props.ownNextPartInstance,
				autoNextPart: false,
				currentLivePart: undefined,
				currentNextPart: undefined,
				budgetDuration: undefined,
				budgetGap: 0,
				timeScale: props.timeScale,
				maxTimeScale: props.timeScale,
				showingAllSegment: true,
			}

			this.isVisible = false
		}

		shouldComponentUpdate(nextProps: IProps & ITrackedResolvedSegmentProps, nextState: IState) {
			return !_.isMatch(this.props, nextProps) || !_.isMatch(this.state, nextState)
		}

		componentDidMount(): void {
			SpeechSynthesiser.init()

			this.rundownCurrentPartInstanceId = this.props.playlist.currentPartInfo?.partInstanceId ?? null
			if (this.state.isLiveSegment === true) {
				this.onFollowLiveLine(true)
				this.startLive()
			}
			RundownViewEventBus.on(RundownViewEvents.REWIND_SEGMENTS, this.onRewindSegment)
			RundownViewEventBus.on(RundownViewEvents.GO_TO_PART, this.onGoToPart)
			RundownViewEventBus.on(RundownViewEvents.GO_TO_PART_INSTANCE, this.onGoToPartInstance)
			// Delay is to ensure UI has settled before checking:
			setTimeout(() => {
				window.requestAnimationFrame(() => {
					this.mountedTime = Date.now()
					if (this.state.isLiveSegment && this.props.followLiveSegments && !this.isVisible) {
						scrollToSegment(this.props.segmentId, true).catch((error) => {
							if (!error.toString().match(/another scroll/)) console.warn(error)
						})
					}
				})
			}, 500)
			window.addEventListener('resize', this.onWindowResize)
			this.updateMaxTimeScale()
				.then(() => this.showEntireSegment())
				.catch(catchError('updateMaxTimeScale'))
		}

		componentDidUpdate(prevProps: IProps & ITrackedResolvedSegmentProps) {
			let isLiveSegment = false
			let isNextSegment = false
			let currentLivePart: PartExtended | undefined = undefined
			let currentNextPart: PartExtended | undefined = undefined

			let autoNextPart = false

			if (this.props.ownCurrentPartInstance && this.props.ownCurrentPartInstance.segmentId === this.props.segmentId) {
				isLiveSegment = true
				currentLivePart = this.props.parts.find((part) => part.instance._id === this.props.ownCurrentPartInstance?._id)
			}
			if (this.props.ownNextPartInstance) {
				isNextSegment = true
				currentNextPart = this.props.parts.find((part) => part.instance._id === this.props.ownNextPartInstance?._id)
			}
			autoNextPart = !!(
				currentLivePart &&
				currentLivePart.instance.part.autoNext &&
				currentLivePart.instance.part.expectedDuration
			)
			if (isNextSegment && !isLiveSegment && !autoNextPart && this.props.ownCurrentPartInstance) {
				if (
					this.props.ownCurrentPartInstance &&
					this.props.ownCurrentPartInstance.part.expectedDuration &&
					this.props.ownCurrentPartInstance.part.autoNext
				) {
					autoNextPart = true
				}
			}

			this.rundownCurrentPartInstanceId = this.props.playlist.currentPartInfo?.partInstanceId ?? null

			// segment is becoming live
			if (this.state.isLiveSegment === false && isLiveSegment === true) {
				this.setState({ isLiveSegment: true })
				this.onFollowLiveLine(true)
				this.startLive()
			}
			// segment is stopping from being live
			if (this.state.isLiveSegment === true && isLiveSegment === false) {
				this.setState({ isLiveSegment: false }, () => {
					if (Settings.autoRewindLeavingSegment) {
						this.onRewindSegment()
						this.onShowEntireSegment()
					}
				})
				this.stopLive()
			}

			const currentNextPartInstanceTimingId = currentNextPart
				? getPartInstanceTimingId(currentNextPart?.instance)
				: undefined
			const firstPartInstanceTimingId = this.props.parts[0]
				? getPartInstanceTimingId(this.props.parts[0].instance)
				: undefined

			// Setting the correct scroll position on parts when setting is next
			const nextPartDisplayStartsAt =
				(currentNextPartInstanceTimingId &&
					this.context.durations?.partDisplayStartsAt?.[currentNextPartInstanceTimingId]) ||
				0
			const partOffset =
				nextPartDisplayStartsAt -
				(firstPartInstanceTimingId
					? (this.context.durations?.partDisplayStartsAt?.[firstPartInstanceTimingId] ?? 0)
					: 0)
			const nextPartIdOrOffsetHasChanged =
				currentNextPart &&
				this.props.playlist.nextPartInfo &&
				(prevProps.playlist.nextPartInfo?.partInstanceId !== this.props.playlist.nextPartInfo.partInstanceId ||
					this.nextPartOffset !== partOffset)
			const isBecomingNextSegment = this.state.isNextSegment === false && isNextSegment
			// the segment isn't live, will be next, and either the nextPartId has changed or it is just becoming next
			if (
				!isLiveSegment &&
				isNextSegment &&
				currentNextPart &&
				(nextPartIdOrOffsetHasChanged || isBecomingNextSegment)
			) {
				const timelineWidth = this.timelineDiv instanceof HTMLElement ? getElementWidth(this.timelineDiv) : 0 // unsure if this is a good default/substitute
				// If part is not within viewport scroll to its start
				if (
					this.state.scrollLeft > partOffset ||
					this.state.scrollLeft * this.state.timeScale + timelineWidth < partOffset * this.state.timeScale
				) {
					this.setState({
						scrollLeft: partOffset,
					})
				}
				this.nextPartOffset = partOffset
			}

			// rewind all scrollLeft's to 0 on rundown activate
			if (
				this.props.playlist &&
				this.props.playlist.activationId &&
				prevProps.playlist &&
				!prevProps.playlist.activationId
			) {
				this.setState({
					scrollLeft: 0,
				})
			} else if (
				this.props.playlist &&
				!this.props.playlist.activationId &&
				prevProps.playlist &&
				prevProps.playlist.activationId
			) {
				this.setState({
					livePosition: 0,
				})
			}

			if (this.props.followLiveSegments && !prevProps.followLiveSegments) {
				this.onFollowLiveLine(true)
			}

			const budgetDuration = this.getSegmentBudgetDuration()

			if (!isLiveSegment && this.props.parts !== prevProps.parts) {
				this.updateMaxTimeScale().catch(catchError('updateMaxTimeScale'))
			}

			if (!isLiveSegment && this.props.parts !== prevProps.parts && this.state.showingAllSegment) {
				this.showEntireSegment()
			}

			this.setState({
				isLiveSegment,
				isNextSegment,
				currentLivePart,
				currentNextPart,
				autoNextPart,
				budgetDuration,
			})
		}

		componentWillUnmount(): void {
			if (this.intersectionObserver && this.state.isLiveSegment && this.props.followLiveSegments) {
				if (typeof this.props.onSegmentScroll === 'function') this.props.onSegmentScroll()
			}

			this.stopLive()
			RundownViewEventBus.off(RundownViewEvents.REWIND_SEGMENTS, this.onRewindSegment)
			RundownViewEventBus.off(RundownViewEvents.GO_TO_PART, this.onGoToPart)
			RundownViewEventBus.off(RundownViewEvents.GO_TO_PART_INSTANCE, this.onGoToPartInstance)
			window.removeEventListener('resize', this.onWindowResize)
		}

		private getSegmentBudgetDuration(): number | undefined {
			return this.props.segmentui?.segmentTiming?.budgetDuration
		}

		onWindowResize = _.throttle(() => {
			if (this.state.showingAllSegment) {
				this.updateMaxTimeScale()
					.then(() => this.showEntireSegment())
					.catch(catchError('updateMaxTimeScale'))
			}
		}, 250)

		onTimeScaleChange = (timeScaleVal: number) => {
			if (Number.isFinite(timeScaleVal) && timeScaleVal > 0) {
				this.setState((state) => ({
					timeScale: timeScaleVal,
					showingAllSegment: timeScaleVal === state.maxTimeScale,
				}))
			}
		}

		onCollapseOutputToggle = (outputLayer: IOutputLayerUi) => {
			const collapsedOutputs = { ...this.state.collapsedOutputs }
			collapsedOutputs[outputLayer._id] =
				outputLayer.isDefaultCollapsed && collapsedOutputs[outputLayer._id] === undefined
					? false
					: collapsedOutputs[outputLayer._id] !== true
			UIStateStorage.setItem(
				`rundownView.${this.props.playlist._id}`,
				`segment.${this.props.segmentId}.outputs`,
				collapsedOutputs
			)
			this.setState({ collapsedOutputs })
		}
		/** The user has scrolled scrollLeft seconds to the left in a child component */
		onScroll = (scrollLeft: number) => {
			this.setState({
				scrollLeft: Math.max(
					0,
					Math.min(
						scrollLeft,
						(computeSegmentDuration(
							this.context.durations,
							this.props.parts.map((i) => i.instance.part._id),
							true
						) || 1) -
							LIVELINE_HISTORY_SIZE / this.state.timeScale
					)
				),
				followLiveLine: false,
			})
			if (typeof this.props.onSegmentScroll === 'function') this.props.onSegmentScroll()
		}

		onRewindSegment = () => {
			if (!this.state.isLiveSegment) {
				this.updateMaxTimeScale()
					.then(() => {
						this.showEntireSegment()
						this.setState({
							scrollLeft: 0,
							livePosition: 0,
						})
					})
					.catch(catchError('updateMaxTimeScale'))
			}
		}

		onGoToPartInner = (part: PartUi, zoomInToFit?: boolean) => {
			this.setState((state) => {
				const timelineWidth = this.timelineDiv instanceof HTMLElement ? getElementWidth(this.timelineDiv) : 0 // unsure if this is good default/substitute
				let newScale: number | undefined
				let scrollLeft = state.scrollLeft

				if (zoomInToFit) {
					// display dur in ms
					const displayDur = SegmentTimelinePartClass.getPartDisplayDuration(part, this.context?.durations) || 1
					// is the padding is larger than the width of the resulting size?
					const tooSmallTimeline = timelineWidth < TIMELINE_RIGHT_PADDING * 3
					// width in px, pad on both sides
					const desiredWidth = tooSmallTimeline
						? timelineWidth * 0.8
						: Math.max(1, timelineWidth - TIMELINE_RIGHT_PADDING * 2)
					// scale = pixels / time
					newScale = desiredWidth / displayDur

					// the left padding
					const padding = tooSmallTimeline ? (timelineWidth * 0.1) / newScale : TIMELINE_RIGHT_PADDING / newScale
					// offset in ms
					scrollLeft = part.startsAt - padding
					// scrollLeft should be at least 0
					scrollLeft = Math.max(0, scrollLeft)
				} else if (
					this.state.scrollLeft > part.startsAt ||
					this.state.scrollLeft * this.state.timeScale + timelineWidth < part.startsAt * this.state.timeScale
				) {
					// If part is not within viewport scroll to its start
					scrollLeft = part.startsAt
				}

				/**
				 * note from mint @ 07-09-23
				 *
				 * there are some edge cases still here. the ones i'm aware of are:
				 *  - when following the live line, this will zoom but not scroll
				 *  - when a segment starts with a short part, followed by a long part the left padding will be inconsistent
				 */

				return {
					scrollLeft,
					timeScale: newScale ?? state.timeScale,
					showingAllSegment: newScale !== undefined ? false : state.showingAllSegment,
				}
			})
		}

		onGoToPart = (e: GoToPartEvent) => {
			if (this.props.segmentId === e.segmentId) {
				const part = this.props.parts.find((part) => part.partId === e.partId)
				if (part) {
					this.onGoToPartInner(part, e.zoomInToFit)
				}
			}
		}

		onGoToPartInstance = (e: GoToPartInstanceEvent) => {
			if (this.props.segmentId === e.segmentId) {
				const part = this.props.parts.find((part) => part.instance._id === e.partInstanceId)

				if (part) {
					this.onGoToPartInner(part, e.zoomInToFit)
				}
			}
		}

		onAirLineRefresh = (e: TimingEvent) => {
			this.setState((state) => {
				if (state.isLiveSegment && state.currentLivePart) {
					const currentLivePartInstance = state.currentLivePart.instance

					const partOffset =
						(this.context.durations?.partDisplayStartsAt?.[getPartInstanceTimingId(currentLivePartInstance)] || 0) -
						(this.context.durations?.partDisplayStartsAt?.[getPartInstanceTimingId(this.props.parts[0]?.instance)] || 0)

					let isExpectedToPlay = !!currentLivePartInstance.timings?.plannedStartedPlayback
					const lastTake = currentLivePartInstance.timings?.take
					const lastStartedPlayback = currentLivePartInstance.timings?.plannedStartedPlayback
					const lastTakeOffset = currentLivePartInstance.timings?.playOffset || 0
					const virtualStartedPlayback =
						(lastTake || 0) > (lastStartedPlayback || -1)
							? lastTake
							: lastStartedPlayback !== undefined
								? lastStartedPlayback - lastTakeOffset
								: undefined

					if (lastTake && lastTake + SIMULATED_PLAYBACK_HARD_MARGIN > e.detail.currentTime) {
						isExpectedToPlay = true
					}

					const newLivePosition =
						isExpectedToPlay && virtualStartedPlayback
							? partOffset + e.detail.currentTime - virtualStartedPlayback + lastTakeOffset
							: partOffset + lastTakeOffset

					const budgetDuration = this.getSegmentBudgetDuration()

					return {
						livePosition: newLivePosition,
						scrollLeft: state.followLiveLine
							? Math.max(newLivePosition - LIVELINE_HISTORY_SIZE / state.timeScale, 0)
							: state.scrollLeft,
						budgetDuration,
					}
				}
				return null
			})
		}

		visibleChanged = (entries: IntersectionObserverEntry[]) => {
			// Add a small debounce to ensure UI has settled before checking
			if (this.visibilityChangeTimeout) {
				clearTimeout(this.visibilityChangeTimeout)
			}

			this.visibilityChangeTimeout = setTimeout(() => {
				if (entries[0].intersectionRatio < 0.99 && !isMaintainingFocus() && Date.now() - this.mountedTime > 2000) {
					if (typeof this.props.onSegmentScroll === 'function') this.props.onSegmentScroll()
					this.isVisible = false
				} else {
					this.isVisible = true
				}
			}, 1800)
		}

		startLive = () => {
			window.addEventListener(RundownTiming.Events.timeupdateHighResolution, this.onAirLineRefresh)

			const watchElement = this.timelineDiv?.parentElement
			if (!watchElement) {
				logger.warn(`Missing timelineDiv.parentElement in SegmentTimelineContainer.startLive`)
				return
			}

			// As of Chrome 76, IntersectionObserver rootMargin works in screen pixels when root
			// is viewport. This seems like an implementation bug and IntersectionObserver is
			// an Experimental Feature in Chrome, so this might change in the future.
			// Additionally, it seems that the screen scale factor needs to be taken into account as well
			const zoomFactor = window.outerWidth / window.innerWidth / window.devicePixelRatio
			this.intersectionObserver = new IntersectionObserver(this.visibleChanged, {
				rootMargin: `-${getHeaderHeight() * zoomFactor}px 0px -${20 * zoomFactor}px 0px`,
				threshold: [0, 0.25, 0.5, 0.75, 0.98],
			})
			if (!this.timelineDiv?.parentElement) return
			this.intersectionObserver.observe(watchElement)
		}

		stopLive = () => {
			window.removeEventListener(RundownTiming.Events.timeupdateHighResolution, this.onAirLineRefresh)
			if (this.intersectionObserver) {
				this.intersectionObserver.disconnect()
				this.intersectionObserver = undefined
			}
		}

		onFollowLiveLine = (state: boolean) => {
			this.setState({
				followLiveLine: state,
				scrollLeft: Math.max(this.state.livePosition - LIVELINE_HISTORY_SIZE / this.state.timeScale, 0),
			})
		}

		segmentRef = (el: SegmentTimelineClass, _segmentId: SegmentId) => {
			this.timelineDiv = el.timeline
		}

		getShowAllTimeScale = () => {
			if (!this.timelineDiv || isLiveSegmentButLivePositionNotSet(this.state.isLiveSegment, this.state.livePosition)) {
				return this.state.maxTimeScale
			}

			let calculatedTimelineDivWidth = 1
			if (this.timelineDiv instanceof HTMLElement) {
				calculatedTimelineDivWidth = getElementWidth(this.timelineDiv) - TIMELINE_RIGHT_PADDING || 1
			}

			const segmentDisplayDuration: number =
				computeSegmentDisplayDuration(this.context.durations, this.props.parts) || 1
			const livePosition = this.state.isLiveSegment ? this.state.livePosition : 0

			let newScale = calculatedTimelineDivWidth / (segmentDisplayDuration - livePosition)
			newScale = Math.min(MINIMUM_ZOOM_FACTOR, newScale)
			if (!Number.isFinite(newScale) || newScale === 0) {
				newScale = FALLBACK_ZOOM_FACTOR
			}
			return newScale
		}

		updateMaxTimeScale = () => {
			return new Promise<number>((resolve) =>
				this.setState(
					() => {
						const maxTimeScale = this.getShowAllTimeScale()
						return {
							maxTimeScale,
						}
					},
					() => resolve(this.state.maxTimeScale)
				)
			)
		}

		showEntireSegment = () => {
			this.updateMaxTimeScale()
				.then(() => {
					this.onTimeScaleChange(this.getShowAllTimeScale())
				})
				.catch(catchError('updateMaxTimeScale'))
		}

		onShowEntireSegment = () => {
			this.setState({
				scrollLeft: 0,
				followLiveLine: this.state.isLiveSegment ? true : this.state.followLiveLine,
			})
			this.showEntireSegment()
		}

		onZoomChange = (newScale: number) => {
			this.onTimeScaleChange(newScale)
		}

		render(): JSX.Element | null {
			return this.props.segmentui ? (
				<React.Fragment key={unprotectString(this.props.segmentui._id)}>
					{!this.props.segmentui.isHidden && (
						<SegmentTimeline
							id={this.props.id}
							segmentRef={this.segmentRef}
							key={unprotectString(this.props.segmentui._id)}
							segment={this.props.segmentui}
							studio={this.props.studio}
							parts={this.props.parts}
							segmentNoteCounts={this.props.segmentNoteCounts}
							timeScale={this.state.timeScale}
							maxTimeScale={this.state.maxTimeScale}
							onRecalculateMaxTimeScale={this.updateMaxTimeScale}
							showingAllSegment={this.state.showingAllSegment}
							onPieceClick={this.props.onPieceClick}
							onPieceDoubleClick={this.props.onPieceDoubleClick}
							onCollapseOutputToggle={this.onCollapseOutputToggle}
							collapsedOutputs={this.state.collapsedOutputs}
							scrollLeft={this.state.scrollLeft}
							playlist={this.props.playlist}
							followLiveSegments={this.props.followLiveSegments}
							isLiveSegment={this.state.isLiveSegment}
							isNextSegment={this.state.isNextSegment}
							isQueuedSegment={this.props.playlist.queuedSegmentId === this.props.segmentId}
							hasRemoteItems={this.props.hasRemoteItems}
							hasGuestItems={this.props.hasGuestItems}
							autoNextPart={this.state.autoNextPart}
							hasAlreadyPlayed={this.props.hasAlreadyPlayed}
							followLiveLine={this.state.followLiveLine}
							liveLineHistorySize={LIVELINE_HISTORY_SIZE}
							livePosition={this.state.livePosition}
							displayLiveLineCounter={this.props.displayLiveLineCounter}
							onContextMenu={this.props.onContextMenu}
							onFollowLiveLine={this.onFollowLiveLine}
							onShowEntireSegment={this.onShowEntireSegment}
							onZoomChange={this.onZoomChange}
							onSwitchViewMode={this.props.onSwitchViewMode}
							onScroll={this.onScroll}
							isLastSegment={this.props.isLastSegment}
							lastValidPartIndex={this.props.lastValidPartIndex}
							onHeaderNoteClick={this.props.onHeaderNoteClick}
							showCountdownToSegment={this.props.showCountdownToSegment}
							fixedSegmentDuration={this.props.fixedSegmentDuration}
							showDurationSourceLayers={this.props.showDurationSourceLayers}
						/>
					)}
					{this.props.segmentui.showShelf && this.props.adLibSegmentUi && (
						<RundownViewShelf
							studio={this.props.studio}
							segment={this.props.segmentui}
							playlist={this.props.playlist}
							showStyleBase={this.props.showStyleBase}
							adLibSegmentUi={this.props.adLibSegmentUi}
							hotkeyGroup={unprotectString(this.props.segmentui._id) + '_RundownViewShelf'}
							miniShelfFilter={this.props.miniShelfFilter}
							studioMode={this.props.studioMode}
						/>
					)}
				</React.Fragment>
			) : null
		}
	}
)

function isLiveSegmentButLivePositionNotSet(isLiveSegment: boolean, livePosition: number): boolean {
	return isLiveSegment && livePosition === 0
}
