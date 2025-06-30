import React from 'react'
import { ISourceLayer } from '@sofie-automation/blueprints-integration'
import { PieceExtended } from '../../lib/RundownResolver.js'
import { pieceUiClassNames } from '../../lib/ui/pieceUiClassNames.js'
import { PartId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { useContentStatusForItem } from '../SegmentTimeline/withMediaObjectStatus.js'

interface IProps {
	className: string
	partId: PartId
	layer: ISourceLayer | undefined
	piece: PieceExtended
	style?: React.CSSProperties
	highlight?: boolean

	onPointerEnter?: React.PointerEventHandler<HTMLDivElement> | undefined
	onPointerLeave?: React.PointerEventHandler<HTMLDivElement> | undefined
	onPointerMove?: React.PointerEventHandler<HTMLDivElement> | undefined
	onClick?: React.EventHandler<React.MouseEvent<HTMLDivElement>>
	onDoubleClick?: React.EventHandler<React.MouseEvent<HTMLDivElement>>
}

export const PieceElement = React.forwardRef<HTMLDivElement, React.PropsWithChildren<IProps>>(function PieceElement(
	{
		className,
		partId,
		layer,
		piece,
		highlight,
		style,
		children,
		onPointerEnter,
		onPointerLeave,
		onPointerMove,
		onClick,
		onDoubleClick,
	}: React.PropsWithChildren<IProps>,
	ref
) {
	const contentStatus = useContentStatusForItem(piece)

	return (
		<div
			className={pieceUiClassNames(
				piece,
				contentStatus,
				className,
				false,
				layer?.type,
				partId,
				highlight,
				undefined,
				undefined
			)}
			data-obj-id={piece.instance._id}
			onPointerEnter={onPointerEnter}
			onPointerLeave={onPointerLeave}
			onPointerMove={onPointerMove}
			onClick={onClick}
			onDoubleClick={onDoubleClick}
			ref={ref}
			style={style}
			data-rendered-in={piece.renderedInPoint}
			data-rendered-duration={piece.renderedDuration}
		>
			{children}
		</div>
	)
})
