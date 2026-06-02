import { useContext, useEffect, useRef, useState } from 'react'
import { getPieceScrubDurationMs } from '../../../lib/ui/splitsPreviewVideo.js'
import type { ISourceLayer } from '@sofie-automation/blueprints-integration'
import { getElementDocumentOffset, type OffsetPosition } from '../../../utils/positions.js'
import { getElementHeight, getElementWidth } from '../../../utils/dimensions.js'
import { ThumbnailRenderer } from './Renderers/ThumbnailRendererFactory.js'
import { PieceElement } from '../../SegmentContainer/PieceElement.js'
import type { PartId, PartInstanceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { useContentStatusForPieceInstance } from '../../SegmentTimeline/withMediaObjectStatus.js'
import {
	convertSourceLayerItemToPreview,
	type IPreviewPopUpSession,
	PreviewPopUpContext,
} from '../../PreviewPopUp/PreviewPopUpContext.js'
import type { UIStudio } from '@sofie-automation/corelib/src/dataModel/Studio.js'
import type { PieceExtended } from '@sofie-automation/corelib/src/dataModel/Piece.js'
import { SplitButtonLayerBackground } from '../../Shelf/DashboardPieceButton/subcomponents/SplitButtonLayerBackground.js'

interface IProps {
	partId: PartId
	partInstanceId: PartInstanceId
	partAutoNext: boolean
	partPlannedStoppedPlayback: number | undefined
	layer: ISourceLayer | undefined
	piece: PieceExtended
	studio: UIStudio
	isLive: boolean
	isNext: boolean
	highlight?: boolean
}

export function StoryboardPartThumbnailInner({
	piece,
	layer,
	partId,
	partInstanceId,
	studio,
	highlight,
	partAutoNext,
	partPlannedStoppedPlayback,
	isLive,
	isNext,
}: IProps): JSX.Element {
	const [hover, setHover] = useState(false)
	const [origin, setOrigin] = useState<OffsetPosition>({ left: 0, top: 0 })
	const [width, setWidth] = useState(0)
	const [height, setHeight] = useState(0)
	const [mousePosition, setMousePosition] = useState(0)
	const thumbnailEl = useRef<HTMLDivElement>(null)

	const previewContext = useContext(PreviewPopUpContext)
	const previewSession = useRef<IPreviewPopUpSession | null>(null)

	const contentStatus = useContentStatusForPieceInstance(piece.instance)
	const { contents: previewContents, options: previewOptions } = convertSourceLayerItemToPreview(
		layer?.type,
		piece.instance.piece,
		contentStatus
	)

	const scrubDurationMs = getPieceScrubDurationMs(piece.instance.piece.content, contentStatus)

	useEffect(() => {
		if (previewSession.current && previewContents.length > 0) {
			previewSession.current.update(previewContents)
		}
	}, [previewContents])

	const onPointerEnter = (e: React.PointerEvent<HTMLDivElement>) => {
		if (e.pointerType !== 'mouse') {
			return
		}

		const el = thumbnailEl.current
		const newOffset = el && getElementDocumentOffset(el)
		const newWidth = el && getElementWidth(el)
		const newHeight = el && getElementHeight(el)

		if (newOffset !== null) {
			setOrigin(newOffset)
		}
		if (newWidth !== null) {
			setWidth(newWidth)
		}
		if (newHeight !== null) {
			setHeight(newHeight)
		}

		const mousePos =
			newOffset !== null && newWidth !== null
				? Math.max(0, Math.min(1, (e.pageX - newOffset.left - 5) / (newWidth - 10)))
				: 0
		const time = mousePos * scrubDurationMs
		setMousePosition(mousePos)

		if (previewContents.length > 0 && el) {
			previewSession.current = previewContext.requestPreview(el, previewContents, {
				...previewOptions,
				time,
				initialOffsetX: e.clientX,
				trackMouse: true,
			})
		}

		setHover(true)
	}

	const onPointerLeave = (e: React.PointerEvent<HTMLDivElement>) => {
		if (e.pointerType !== 'mouse') {
			return
		}
		setHover(false)

		if (previewSession.current) {
			previewSession.current.close()
			previewSession.current = null
		}
	}

	const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
		if (e.pointerType !== 'mouse') {
			return
		}
		const offset = thumbnailEl.current && getElementDocumentOffset(thumbnailEl.current)
		const thumbWidth = thumbnailEl.current && getElementWidth(thumbnailEl.current)
		const left = offset?.left ?? origin.left
		const w = thumbWidth ?? width
		const newMousePosition = w > 10 ? Math.max(0, Math.min(1, (e.pageX - left - 5) / (w - 10))) : 0
		setMousePosition(newMousePosition)
		previewSession.current?.setPointerTime(newMousePosition * scrubDurationMs)
	}

	return (
		<PieceElement
			className="segment-storyboard__part__thumbnail"
			layer={layer}
			partId={partId}
			piece={piece}
			highlight={highlight}
			onPointerEnter={onPointerEnter}
			onPointerLeave={onPointerLeave}
			onPointerMove={onPointerMove}
			ref={thumbnailEl}
		>
			<SplitButtonLayerBackground piece={piece.instance.piece} />
			<ThumbnailRenderer
				partId={partId}
				partInstanceId={partInstanceId}
				partAutoNext={partAutoNext}
				partPlannedStoppedPlayback={partPlannedStoppedPlayback}
				hoverScrubTimePosition={mousePosition * scrubDurationMs}
				hovering={hover}
				layer={layer}
				height={height}
				originPosition={origin}
				pieceInstance={piece}
				studio={studio}
				isLive={isLive}
				isNext={isNext}
			/>
		</PieceElement>
	)
}
