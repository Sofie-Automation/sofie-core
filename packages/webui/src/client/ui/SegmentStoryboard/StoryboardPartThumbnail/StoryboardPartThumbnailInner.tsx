import React, { useRef, useState } from 'react'
import { ISourceLayer } from '@sofie-automation/blueprints-integration'
import { PieceExtended } from '../../../lib/RundownResolver'
import { getElementDocumentOffset, OffsetPosition } from '../../../utils/positions'
import { getElementHeight, getElementWidth } from '../../../utils/dimensions'
import { ThumbnailRenderer } from './Renderers/ThumbnailRendererFactory'
import { PieceElement } from '../../SegmentContainer/PieceElement'
import { UIStudio } from '@sofie-automation/meteor-lib/dist/api/studios'
import { PartId, PartInstanceId } from '@sofie-automation/corelib/dist/dataModel/Ids'

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

	const onPointerEnter = (e: React.PointerEvent<HTMLDivElement>) => {
		if (e.pointerType !== 'mouse') {
			return
		}
		setHover(true)

		const newOffset = thumbnailEl.current && getElementDocumentOffset(thumbnailEl.current)
		if (newOffset !== null) {
			setOrigin(newOffset)
		}
		const newWidth = thumbnailEl.current && getElementWidth(thumbnailEl.current)
		if (newWidth !== null) {
			setWidth(newWidth)
		}
		const newHeight = thumbnailEl.current && getElementHeight(thumbnailEl.current)
		if (newHeight !== null) {
			setHeight(newHeight)
		}
	}

	const onPointerLeave = (e: React.PointerEvent<HTMLDivElement>) => {
		if (e.pointerType !== 'mouse') {
			return
		}
		setHover(false)
	}

	const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
		if (e.pointerType !== 'mouse') {
			return
		}
		const newMousePosition = Math.max(0, Math.min(1, (e.pageX - origin.left - 5) / (width - 10)))
		setMousePosition(newMousePosition)
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
			<ThumbnailRenderer
				partId={partId}
				partInstanceId={partInstanceId}
				partAutoNext={partAutoNext}
				partPlannedStoppedPlayback={partPlannedStoppedPlayback}
				hoverScrubTimePosition={mousePosition * (piece.instance.piece.content.sourceDuration || 0)}
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
