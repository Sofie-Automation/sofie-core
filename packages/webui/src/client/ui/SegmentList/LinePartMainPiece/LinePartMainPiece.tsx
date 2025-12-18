import { EvsContent, SourceLayerType } from '@sofie-automation/blueprints-integration'
import React, { useContext, useMemo, useRef, useState } from 'react'
import { PieceExtended } from '../../../lib/RundownResolver.js'
// TODO: Move to a shared lib file
import { PartId, PartInstanceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import classNames from 'classnames'
import { UIStudio } from '@sofie-automation/meteor-lib/dist/api/studios'
import { getNoticeLevelForPieceStatus } from '../../../lib/notifications/notifications.js'
import { LoopingPieceIcon } from '../../../lib/ui/icons/looping.js'
import { PieceStatusIcon } from '../../../lib/ui/PieceStatusIcon.js'
import { getElementWidth } from '../../../utils/dimensions.js'
import { getElementDocumentOffset, OffsetPosition } from '../../../utils/positions.js'
import { getSplitItems } from '../../SegmentContainer/getSplitItems.js'
import { PieceElement } from '../../SegmentContainer/PieceElement.js'
import { getPieceSteps, PieceMultistepChevron } from '../../SegmentContainer/PieceMultistepChevron.js'
import { useContentStatusForPieceInstance } from '../../SegmentTimeline/withMediaObjectStatus.js'
import {
	convertSourceLayerItemToPreview,
	IPreviewPopUpSession,
	PreviewPopUpContext,
} from '../../PreviewPopUp/PreviewPopUpContext.js'

interface IProps {
	partId: PartId
	partInstanceId: PartInstanceId
	piece: PieceExtended
	studio: UIStudio | undefined
	timelineBase: number
	partDuration: number
	capToPartDuration: boolean
	isLive: boolean
}

function getPieceDuration(
	piece: PieceExtended,
	partDuration: number,
	timelineBase: number,
	capToPartDuration: boolean
): number {
	return capToPartDuration
		? // capToPartDuration is something that can be used when the part is Auto and there is no chance of the Piece
			// being extended
			Math.min(piece.renderedDuration ?? partDuration, partDuration)
		: Math.max(
				// renderedDuration can be null. If there is a sourceDuration, use that, if not, use timelineBase
				piece.renderedDuration ??
					(piece.instance.piece.content?.sourceDuration && !piece.instance.piece.content?.loop ? 0 : timelineBase),
				piece.instance.piece.content?.sourceDuration ?? 0
			)
}

function widthInBase(pieceMaxDuration: number, timelineBase: number): number {
	const size = Math.min(1, pieceMaxDuration / timelineBase)
	return size * 100
}

// TODO: Create useMediaObjectStatus that would set up new subscriptions
export function LinePartMainPiece({
	partId,
	piece,
	partDuration,
	timelineBase,
	capToPartDuration,
}: IProps): JSX.Element {
	const contentStatus = useContentStatusForPieceInstance(piece.instance)

	const [hover, setHover] = useState(false)
	const [origin, setOrigin] = useState<OffsetPosition>({ left: 0, top: 0 })
	const [width, setWidth] = useState(0)
	const [mousePosition, setMousePosition] = useState(0)
	const pieceEl = useRef<HTMLDivElement>(null)

	const pieceMaxDuration = getPieceDuration(piece, partDuration, timelineBase, capToPartDuration)
	const pieceStyle = useMemo<React.CSSProperties>(() => {
		return {
			// TODO: handle piece.enable.start
			width: `${widthInBase(pieceMaxDuration, timelineBase)}%`,
		}
	}, [pieceMaxDuration, timelineBase])

	const seek = (piece.instance.piece.content as any).seek ?? 0

	const anomalies = useMemo(
		() => (
			<>
				{contentStatus?.scenes &&
					contentStatus?.scenes.map(
						(i) =>
							i < pieceMaxDuration &&
							i - seek >= 0 && (
								<span
									className="segment-timeline__piece__scene-marker"
									key={i}
									style={{ left: `${((i - seek) / pieceMaxDuration) * 100}%` }}
								></span>
							)
					)}
				{contentStatus?.freezes &&
					contentStatus?.freezes.map(
						(i) =>
							i.start < pieceMaxDuration &&
							i.start - seek >= 0 && (
								<span
									className="segment-timeline__piece__anomaly-marker"
									key={i.start}
									style={{
										left: `${((i.start - seek) / pieceMaxDuration) * 100}%`,
										width: `${(i.duration / pieceMaxDuration) * 100}%`,
									}}
								></span>
							)
					)}
				{contentStatus?.blacks &&
					contentStatus?.blacks.map(
						(i) =>
							i.start < pieceMaxDuration &&
							i.start - seek >= 0 && (
								<span
									className="segment-timeline__piece__anomaly-marker segment-timeline__piece__anomaly-marker__freezes"
									key={i.start}
									style={{
										left: `${((i.start - seek) / pieceMaxDuration) * 100}%`,
										width: `${(i.duration / pieceMaxDuration) * 100}%`,
									}}
								></span>
							)
					)}
			</>
		),
		[contentStatus?.blacks, contentStatus?.freezes, contentStatus?.scenes]
	)

	const previewContext = useContext(PreviewPopUpContext)
	const previewSession = useRef<IPreviewPopUpSession | null>(null)
	const { contents: previewContents, options: previewOptions } = convertSourceLayerItemToPreview(
		piece.sourceLayer?.type,
		piece.instance.piece,
		contentStatus
	)

	const onPointerEnter = (e: React.PointerEvent<HTMLDivElement>) => {
		if (e.pointerType !== 'mouse') {
			return
		}
		setHover(true)

		if (previewContents.length > 0)
			previewSession.current = previewContext.requestPreview(e.target as any, previewContents, {
				...previewOptions,
				time: mousePosition * (piece.instance.piece.content.sourceDuration || 0),
				initialOffsetX: e.screenX,
				trackMouse: true,
			})

		const newOffset = pieceEl.current && getElementDocumentOffset(pieceEl.current)
		if (newOffset !== null) {
			setOrigin(newOffset)
		}
		const newWidth = pieceEl.current && getElementWidth(pieceEl.current)
		if (newWidth !== null) {
			setWidth(newWidth)
		}
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
		const newMousePosition = Math.max(0, Math.min(1, (e.pageX - origin.left - 5) / (width - 10)))
		setMousePosition(e.pageX - origin.left)

		previewSession.current?.setPointerTime(
			newMousePosition * (piece.instance.piece.content.sourceDuration ?? contentStatus?.contentDuration ?? 0)
		)
	}

	const noticeLevel = getNoticeLevelForPieceStatus(contentStatus?.status)

	const hasStepChevron = getPieceSteps(piece)

	const multistepChevron = (
		<PieceMultistepChevron className="segment-opl__main-piece__label__step-chevron" piece={piece} />
	)

	return (
		<PieceElement
			className="segment-opl__main-piece"
			piece={piece}
			layer={piece.sourceLayer}
			partId={partId}
			style={pieceStyle}
			ref={pieceEl}
			onPointerEnter={onPointerEnter}
			onPointerLeave={onPointerLeave}
			onPointerMove={onPointerMove}
		>
			{piece.sourceLayer?.type === SourceLayerType.SPLITS && (
				<div className="segment-opl__main-piece__bkg">{getSplitItems(piece, 'segment-opl__main-piece__item')}</div>
			)}
			{anomalies}
			<div
				className={classNames('segment-opl__main-piece__label', {
					mln: hasStepChevron,
				})}
			>
				{noticeLevel !== null && <PieceStatusIcon noticeLevel={noticeLevel} />}
				{multistepChevron}
				{piece.sourceLayer?.type === SourceLayerType.LOCAL && (piece.instance.piece.content as EvsContent).color && (
					<ColoredMark color={(piece.instance.piece.content as EvsContent).color} />
				)}
				{piece.instance.piece.name}
				{piece.instance.piece.content?.loop && (
					<LoopingPieceIcon className="segment-opl__main-piece__label-icon" playing={hover} />
				)}
			</div>
		</PieceElement>
	)
}

const ColoredMark = React.memo(function ColoredMark({ color }: { color: string | undefined }) {
	if (!color) return null

	return (
		<span
			style={{ color: color.startsWith('#') ? color : `#${color}` }}
			className="segment-opl__main-piece__label__colored-mark"
		></span>
	)
})
