import { ScriptContent, SourceLayerType } from '@sofie-automation/blueprints-integration'
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { PieceExtended } from '../../../lib/RundownResolver'
import { IFloatingInspectorPosition } from '../../FloatingInspectors/IFloatingInspectorPosition'
import { MicFloatingInspector } from '../../FloatingInspectors/MicFloatingInspector'

interface IProps {
	pieces: PieceExtended[]
}

export function LinePartScriptPiece({ pieces }: IProps): JSX.Element {
	const pieceEl = useRef<HTMLDivElement>(null)
	const [miniInspectorPosition, setMiniInspectorPosition] = useState<IFloatingInspectorPosition>({
		position: 'bottom',
		anchor: 'start',
		left: 0,
		top: 0,
	})
	const [isHover, setHover] = useState(false)
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
	useLayoutEffect(() => {
		if (!pieceEl.current) return

		const { top, left, width } = pieceEl.current.getBoundingClientRect()

		setMiniInspectorPosition({
			top: top + window.scrollY,
			left: left + width / 2 + window.scrollX,
			position: 'bottom',
			anchor: 'start',
		})
	}, [])

	function onMouseEnter() {
		setHover(true)
	}

	function onMouseLeave() {
		setHover(false)
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
			{hasPiece && hasPiece.instance.piece.content && (
				<MicFloatingInspector
					content={hasPiece.instance.piece.content as ScriptContent}
					position={miniInspectorPosition}
					itemElement={pieceEl.current}
					showMiniInspector={isHover}
					typeClass={'script'}
				/>
			)}
		</div>
	)
}
