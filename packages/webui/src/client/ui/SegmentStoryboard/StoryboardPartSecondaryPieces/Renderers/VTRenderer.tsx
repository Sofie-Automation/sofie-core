import { IDefaultRendererProps } from './DefaultRenderer.js'
import { LoopingPieceIcon } from '../../../../lib/ui/icons/looping.js'

export function VTRenderer({ piece: pieceInstance, hovering }: Readonly<IDefaultRendererProps>): JSX.Element {
	return (
		<>
			{pieceInstance.instance.piece.name}
			{pieceInstance.instance.piece.content?.loop && (
				<LoopingPieceIcon className="segment-storyboard__part__piece-icon" playing={!!hovering} />
			)}
		</>
	)
}
