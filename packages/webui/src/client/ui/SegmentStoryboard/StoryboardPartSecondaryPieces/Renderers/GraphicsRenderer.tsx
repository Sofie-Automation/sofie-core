import { PieceMultistepChevron } from '../../../SegmentContainer/PieceMultistepChevron.js'
import { IDefaultRendererProps } from './DefaultRenderer.js'
import { LoopingPieceIcon } from '../../../../lib/ui/icons/looping.js'

export function GraphicsRenderer({ piece: pieceInstance, hovering }: Readonly<IDefaultRendererProps>): JSX.Element {
	return (
		<>
			<PieceMultistepChevron className="segment-storyboard__piece__step-chevron" piece={pieceInstance} />
			{pieceInstance.instance.piece.name}
			{pieceInstance.instance.piece.content?.loop && (
				<LoopingPieceIcon className="segment-storyboard__part__piece-icon" playing={!!hovering} />
			)}
		</>
	)
}
