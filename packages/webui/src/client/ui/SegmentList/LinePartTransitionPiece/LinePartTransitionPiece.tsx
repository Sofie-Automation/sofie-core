import type { PieceExtended } from '@sofie-automation/corelib/src/dataModel/Piece'

interface IProps {
	piece: PieceExtended
}

export const LinePartTransitionPiece: React.FC<IProps> = function LinePartTransitionPiece({ piece }) {
	return (
		<div className="segment-opl__transition-piece" data-obj-id={piece.instance._id}>
			{piece.instance.piece.name}
		</div>
	)
}
