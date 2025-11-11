import { SourceLayerType } from '@sofie-automation/blueprints-integration'
import { useContext, useMemo, useRef } from 'react'
import { PieceExtended } from '../../../lib/RundownResolver.js'
import {
	PreviewPopUpContext,
	IPreviewPopUpSession,
	convertSourceLayerItemToPreview,
} from '../../PreviewPopUp/PreviewPopUpContext.js'
import { useContentStatusForPieceInstance } from '../../SegmentTimeline/withMediaObjectStatus.js'

interface IProps {
	pieces: PieceExtended[]
}

export function LinePartScriptPiece({ pieces }: IProps): JSX.Element {
	const pieceEl = useRef<HTMLDivElement>(null)
	const thisPieces = useMemo(
		() =>
			pieces.filter(
				(piece) =>
					piece.sourceLayer &&
					piece.sourceLayer.type === SourceLayerType.SCRIPT &&
					(piece.renderedDuration === null || piece.renderedDuration > 0)
			),
		[pieces]
	)

	const previewContext = useContext(PreviewPopUpContext)
	const previewSession = useRef<IPreviewPopUpSession | null>(null)
	const contentStatus = useContentStatusForPieceInstance(thisPieces?.[0]?.instance)
	const previewProps =
		thisPieces[0] &&
		convertSourceLayerItemToPreview(thisPieces[0].sourceLayer?.type, thisPieces[0].instance.piece, contentStatus, {
			in: thisPieces[0].renderedInPoint,
			dur: thisPieces[0].renderedDuration,
		})

	function onMouseEnter(e: React.PointerEvent<HTMLDivElement>) {
		// setHover(true)
		if (previewProps?.contents && previewProps.contents.length > 0)
			previewSession.current = previewContext.requestPreview(e.target as any, previewProps.contents, {
				...previewProps.options,
				initialOffsetX: e.screenX,
			})
	}

	function onMouseLeave() {
		if (previewSession.current) {
			previewSession.current.close()
			previewSession.current = null
		}
	}

	const hasPiece = thisPieces[0]
	let scriptLabel = ''
	if (hasPiece) {
		const scriptLabelSplit = hasPiece.instance.piece.name.split('||')
		scriptLabel = scriptLabelSplit[1] || scriptLabelSplit[0]
	}

	// In order to have the left-hand-side ellipsis work it's magic, we need to wrap the text in LTR non-printable,
	// control characters, otherwise the browser will move whatever leading punctuation there is to the end
	scriptLabel = '\u202A' + scriptLabel + '\u202C'

	return (
		<div
			className="segment-opl__piece-indicator-placeholder segment-opl__piece-indicator-placeholder--script"
			data-items={JSON.stringify(thisPieces.map((piece) => piece.instance.piece.name))}
			ref={pieceEl}
			onMouseEnter={onMouseEnter}
			onMouseLeave={onMouseLeave}
		>
			{hasPiece && (
				<div className="segment-opl__piece-indicator segment-opl__piece-indicator--script script">{scriptLabel}</div>
			)}
			{!hasPiece && <div className="segment-opl__piece-indicator"></div>}
		</div>
	)
}
