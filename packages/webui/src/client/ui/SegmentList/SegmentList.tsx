import React, { ReactNode, useLayoutEffect, useMemo, useRef, useState } from 'react'
import classNames from 'classnames'
import { DBRundownPlaylist, RundownHoldState } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { UIStateStorage } from '../../lib/UIStateStorage.js'
import { PartUi, PieceUi, SegmentNoteCounts, SegmentUi } from '../SegmentContainer/withResolvedSegment.js'
import { IContextMenuContext } from '../RundownView.js'
import { useCombinedRefs } from '../../lib/lib.js'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { isPartPlayable } from '@sofie-automation/corelib/dist/dataModel/Part'
import { LinePart } from './LinePart.js'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { ISourceLayerExtended } from '../../lib/RundownResolver.js'
import { SegmentViewMode } from '../SegmentContainer/SegmentViewModes.js'
import { SegmentListHeader } from './SegmentListHeader.js'
import { useInView } from 'react-intersection-observer'
import { getHeaderHeight } from '../../lib/viewPort.js'
import { SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { NoteSeverity } from '@sofie-automation/blueprints-integration'
import * as RundownResolver from '../../lib/RundownResolver.js'

interface IProps {
	id: string
	isLiveSegment: boolean
	isNextSegment: boolean
	isQueuedSegment: boolean
	hasAlreadyPlayed: boolean

	currentPartWillAutoNext: boolean

	key: string
	segment: SegmentUi
	playlist: DBRundownPlaylist
	parts: Array<PartUi>
	segmentNoteCounts: SegmentNoteCounts

	fixedSegmentDuration: boolean
	showCountdownToSegment: boolean
	onHeaderNoteClick?: (segmentId: SegmentId, level: NoteSeverity) => void
	onContextMenu?: (contextMenuContext: IContextMenuContext) => void
	onSwitchViewMode?: (newViewMode: SegmentViewMode) => void
	onPieceDoubleClick?: (item: PieceUi, e: React.MouseEvent<HTMLDivElement>) => void
}

const SegmentListInner = React.forwardRef<HTMLDivElement, IProps>(function SegmentList(props, ref) {
	const innerRef = useRef<HTMLDivElement>(null)
	const {
		ref: inViewRef,
		inView,
		entry,
	} = useInView({
		threshold: [0, 1],
		rootMargin: `-${getHeaderHeight() + 12}px 0px 0px 0px`,
		fallbackInView: true,
		skip: !props.isLiveSegment && !props.isNextSegment,
	})
	const combinedRef = useCombinedRefs(null, ref, innerRef, inViewRef)
	const [isHeaderDetachedStick, setHeaderDetachedStick] = useState(false)
	const [highlight, _setHighlight] = useState(false)
	const [useTimeOfDayCountdowns, setUseTimeOfDayCountdowns] = useState(
		UIStateStorage.getItemBoolean(
			`rundownView.${props.playlist._id}`,
			`segment.${props.segment._id}.useTimeOfDayCountdowns`,
			!!props.playlist.timeOfDayCountdowns
		)
	)

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

	const onTimeUntilClick = () => {
		const newUseTimeOfDayCountdowns = !useTimeOfDayCountdowns
		setUseTimeOfDayCountdowns(!useTimeOfDayCountdowns)
		UIStateStorage.setItem(
			`rundownView.${props.playlist._id}`,
			`segment.${props.segment._id}.useTimeOfDayCountdowns`,
			newUseTimeOfDayCountdowns
		)
	}

	const adLibIndicatorColumns = useMemo(() => {
		const sourceColumns: Record<string, ISourceLayerExtended[]> = {}
		Object.values<ISourceLayerExtended>(props.segment.sourceLayers).forEach((sourceLayer) => {
			if (!sourceLayer.onListViewAdLibColumn) return
			let thisSourceColumn = sourceColumns[sourceLayer.name]
			if (!thisSourceColumn) {
				sourceColumns[sourceLayer.name] = []
				thisSourceColumn = sourceColumns[sourceLayer.name]
			}
			thisSourceColumn.push(sourceLayer)
		})
		return sourceColumns
	}, [props.segment.sourceLayers])

	const indicatorColumns = useMemo(() => {
		const sourceColumns: Record<string, ISourceLayerExtended[]> = {}
		Object.values<ISourceLayerExtended>(props.segment.sourceLayers).forEach((sourceLayer) => {
			if (sourceLayer.isHidden) return
			if (!sourceLayer.onListViewColumn) return
			let thisSourceColumn = sourceColumns[sourceLayer.name]
			if (!thisSourceColumn) {
				sourceColumns[sourceLayer.name] = []
				thisSourceColumn = sourceColumns[sourceLayer.name]
			}
			thisSourceColumn.push(sourceLayer)
		})
		return sourceColumns
	}, [props.segment.sourceLayers])

	const parts: ReactNode[] = []
	// let currentPartIndex: number = -1
	// let nextPartIndex: number = -1

	const playlistHasNextPart = !!props.playlist.nextPartInfo

	const renderedParts = props.parts.filter((part) => !(part.instance.part.invalid && part.instance.part.gap))
	const isSinglePartInSegment = renderedParts.length === 1
	let lastTimingGroup: string | undefined = undefined
	renderedParts.forEach((part) => {
		const isLivePart = part.instance._id === props.playlist.currentPartInfo?.partInstanceId
		const isNextPart = part.instance._id === props.playlist.nextPartInfo?.partInstanceId

		// if (isLivePart) currentPartIndex = index
		// if (isNextPart) nextPartIndex = index

		if (part.instance.part.invalid && part.instance.part.gap) return null

		const partComponent = (
			<LinePart
				key={unprotectString(part.instance._id)}
				part={part}
				segment={props.segment}
				isLivePart={isLivePart}
				isNextPart={isNextPart}
				isSinglePartInSegment={isSinglePartInSegment}
				isPreceededByTimingGroupSibling={part.instance.part.displayDurationGroup === lastTimingGroup}
				hasAlreadyPlayed={
					!!part.instance.timings?.reportedStoppedPlayback || !!part.instance.timings?.plannedStoppedPlayback
				}
				displayLiveLineCounter={false}
				inHold={!!(props.playlist.holdState && props.playlist.holdState !== RundownHoldState.COMPLETE)}
				currentPartWillAutonext={isNextPart && props.currentPartWillAutoNext}
				indicatorColumns={indicatorColumns}
				adLibIndicatorColumns={adLibIndicatorColumns}
				doesPlaylistHaveNextPart={playlistHasNextPart}
				onPieceDoubleClick={props.onPieceDoubleClick}
				onContextMenu={props.onContextMenu}
				isPlaylistLooping={RundownResolver.isLoopRunning(props.playlist)}
				isQuickLoopStart={RundownResolver.isQuickLoopStart(part.partId, props.playlist)}
				isQuickLoopEnd={RundownResolver.isQuickLoopEnd(part.partId, props.playlist)}
			/>
		)

		lastTimingGroup = part.instance.part.displayDurationGroup

		parts.push(partComponent)
	})

	const isHeaderDetached =
		(inView &&
			(props.isLiveSegment || (props.isNextSegment && !props.playlist.currentPartInfo)) &&
			parts.length > 1 &&
			entry &&
			entry.intersectionRatio < 1 &&
			entry.boundingClientRect.top < window.innerHeight / 2) ??
		false

	useLayoutEffect(() => {
		if (!isHeaderDetached || !combinedRef.current) {
			setHeaderDetachedStick(false)
			return
		}

		const partEl = combinedRef.current.querySelector('.segment-opl__part')
		if (!partEl) return

		const { top, height } = combinedRef.current.getBoundingClientRect()
		const absoluteTop = top + window.scrollY
		const { height: partHeight } = partEl.getBoundingClientRect()

		function onScroll() {
			if (window.scrollY > absoluteTop + height - getHeaderHeight() - partHeight * 2 - 10) {
				setHeaderDetachedStick(true)
			} else {
				setHeaderDetachedStick(false)
			}
		}

		window.addEventListener('scroll', onScroll)

		return () => {
			window.removeEventListener('scroll', onScroll)
		}
	}, [isHeaderDetached, parts.length])

	return (
		<div
			id={props.id}
			className={classNames('segment-timeline', 'segment-opl', {
				live: props.isLiveSegment,
				next: !props.isLiveSegment && props.isNextSegment,
				queued: props.isQueuedSegment,

				'has-played': props.hasAlreadyPlayed && !props.isLiveSegment && !props.isNextSegment,

				'invert-flash': highlight,

				'time-of-day-countdowns': useTimeOfDayCountdowns,
			})}
			data-segment-id={props.segment._id}
			ref={combinedRef}
		>
			<SegmentListHeader
				isDetached={isHeaderDetached}
				isDetachedStick={isHeaderDetachedStick}
				parts={props.parts}
				segment={props.segment}
				playlist={props.playlist}
				segmentNoteCounts={props.segmentNoteCounts}
				highlight={highlight}
				isLiveSegment={props.isLiveSegment}
				isNextSegment={props.isNextSegment}
				hasAlreadyPlayed={props.hasAlreadyPlayed}
				isQueuedSegment={props.isQueuedSegment}
				fixedSegmentDuration={props.fixedSegmentDuration}
				showCountdownToSegment={props.showCountdownToSegment}
				useTimeOfDayCountdowns={useTimeOfDayCountdowns}
				getSegmentContext={getSegmentContext}
				onTimeUntilClick={onTimeUntilClick}
				onSwitchViewMode={props.onSwitchViewMode}
				onHeaderNoteClick={props.onHeaderNoteClick}
			/>
			<div className="segment-opl__part-list">{parts}</div>
		</div>
	)
})

export const SegmentList = React.memo(SegmentListInner)
