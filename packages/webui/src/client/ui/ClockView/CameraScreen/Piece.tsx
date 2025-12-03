import React, { useContext, useMemo } from 'react'
import { PartId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import classNames from 'classnames'
import { CanvasSizeContext } from './index.js'
import { PieceExtended } from '../../../lib/RundownResolver.js'
import { PieceElement } from '../../SegmentContainer/PieceElement.js'
import { getSplitItems } from '../../SegmentContainer/getSplitItems.js'

const PIECE_TYPE_INDICATOR_BORDER_RADIUS = 11

export const Piece = React.memo(function Piece({
	piece,
	partId,
	left,
	width,
	zoom,
	isLive,
}: {
	piece: PieceExtended
	partId: PartId
	left: number
	width: number | null
	zoom: number
	isLive: boolean
}): JSX.Element | null {
	const canvasWidth = useContext(CanvasSizeContext)

	const indicatorPadding = -1 * PIECE_TYPE_INDICATOR_BORDER_RADIUS
	let pixelLeft = Math.max(indicatorPadding, left * zoom) + PIECE_TYPE_INDICATOR_BORDER_RADIUS
	let pixelWidth = Math.min(canvasWidth, (width ?? canvasWidth) * zoom + Math.min(left * zoom, 0))

	if (isLive) {
		pixelLeft = 0
		pixelWidth = Math.min(canvasWidth, (width ?? canvasWidth) * zoom) + PIECE_TYPE_INDICATOR_BORDER_RADIUS
	}

	const style = useMemo<React.CSSProperties>(
		() =>
			width === null
				? {
						width: `100%`,
						transform: `translate(${pixelLeft}px, 0)`,
					}
				: {
						width: `${pixelWidth}px`,
						transform: `translate(${pixelLeft}px, 0)`,
					},
		[width, pixelLeft, pixelWidth]
	)

	return (
		<div className={classNames('camera-screen__piece', { live: isLive })}>
			{pixelLeft < canvasWidth ? (
				<PieceElement
					className="camera-screen__piece-background"
					layer={piece.sourceLayer}
					piece={piece}
					partId={partId}
					style={style}
				>
					{getSplitItems(piece, 'camera-screen__piece-sub-background')}
				</PieceElement>
			) : null}
			<PieceElement
				className="camera-screen__piece-type-indicator"
				partId={partId}
				layer={piece.sourceLayer}
				piece={piece}
			>
				{getSplitItems(piece, 'camera-screen__piece-type-indicator-sub-background')}
			</PieceElement>
			<div className="camera-screen__piece-label">{piece.instance.piece.name}</div>
		</div>
	)
})
