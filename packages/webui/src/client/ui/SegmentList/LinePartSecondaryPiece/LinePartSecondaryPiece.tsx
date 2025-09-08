import classNames from 'classnames'
import React, { CSSProperties, useCallback, useContext, useMemo, useRef } from 'react'
import { PieceExtended } from '../../../lib/RundownResolver.js'
import { RundownUtils } from '../../../lib/rundown.js'
import { PieceUi } from '../../SegmentContainer/withResolvedSegment.js'
import { useContentStatusForPieceInstance } from '../../SegmentTimeline/withMediaObjectStatus.js'
import {
	PreviewPopUpContext,
	IPreviewPopUpSession,
	convertSourceLayerItemToPreview,
} from '../../PreviewPopUp/PreviewPopUpContext.js'

interface IProps {
	piece: PieceExtended
	timelineBase: number
	partDuration: number
	onClick?: (item: PieceUi, e: React.MouseEvent<HTMLDivElement>) => void
	onDoubleClick?: (item: PieceUi, e: React.MouseEvent<HTMLDivElement>) => void
}

function timeInBase(time: number, partDuration: number, timelineBase: number): number {
	const pieceMaxDuration = Math.min(time, partDuration)
	const size = Math.min(1, pieceMaxDuration / timelineBase)
	return size * 100
}

export const LinePartSecondaryPiece: React.FC<IProps> = React.memo(function LinePartSecondaryPiece({
	piece,
	partDuration,
	timelineBase,
	onClick: incomingOnClick,
	onDoubleClick: incomingOnDoubleClick,
}) {
	const contentStatus = useContentStatusForPieceInstance(piece.instance)

	const pieceEl = useRef<HTMLDivElement>(null)
	const typeClass = piece?.sourceLayer?.type ? RundownUtils.getSourceLayerClassName(piece?.sourceLayer?.type) : ''

	const pieceStyle = useMemo<CSSProperties>(() => {
		const width = timeInBase(piece.renderedDuration ?? Math.max(timelineBase, partDuration), timelineBase, timelineBase)
		const left = timeInBase(piece.renderedInPoint ?? 0, timelineBase, timelineBase)
		const overflow = Math.max(0, left + width - 100)
		return {
			width: `${width - overflow}%`,
			left: `${left}%`,
		}
	}, [piece, partDuration, timelineBase])

	const previewContext = useContext(PreviewPopUpContext)
	const previewSession = useRef<IPreviewPopUpSession | null>(null)
	const previewProps = convertSourceLayerItemToPreview(piece.sourceLayer?.type, piece.instance.piece, contentStatus, {
		in: piece.renderedInPoint,
		dur: piece.renderedDuration,
	})

	const onPointerEnter = (e: React.PointerEvent<HTMLDivElement>) => {
		if (e.pointerType !== 'mouse') {
			return
		}

		if (previewProps.contents.length > 0)
			previewSession.current = previewContext.requestPreview(e.target as any, previewProps.contents, {
				...previewProps.options,
				initialOffsetX: e.screenX,
			})
	}

	const onPointerLeave = (e: React.PointerEvent<HTMLDivElement>) => {
		if (e.pointerType !== 'mouse') {
			return
		}
		if (previewSession.current) {
			previewSession.current.close()
			previewSession.current = null
		}
	}

	const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
		if (e.pointerType !== 'mouse') {
			return
		}
	}

	const onClick = useCallback(
		(e: React.MouseEvent<HTMLDivElement>) => {
			incomingOnClick?.(piece, e)
		},
		[piece, incomingOnClick]
	)

	const onDoubleClick = useCallback(
		(e: React.MouseEvent<HTMLDivElement>) => {
			incomingOnDoubleClick?.(piece, e)
		},
		[piece, incomingOnDoubleClick]
	)

	return (
		<div
			ref={pieceEl}
			className={classNames('segment-opl__secondary-piece', typeClass)}
			style={pieceStyle}
			data-duraton={piece.renderedDuration}
			data-obj-id={piece.instance._id}
			data-piece-id={piece.instance.isTemporary ? piece.instance.piece._id : piece.instance._id}
			data-label={piece.instance.piece.name}
			onPointerEnter={onPointerEnter}
			onPointerLeave={onPointerLeave}
			onPointerMove={onPointerMove}
			onClick={onClick}
			onDoubleClick={onDoubleClick}
		></div>
	)
})
