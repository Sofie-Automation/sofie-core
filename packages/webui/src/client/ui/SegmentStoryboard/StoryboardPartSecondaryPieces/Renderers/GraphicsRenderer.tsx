import { GraphicsContent, NoraContent } from '@sofie-automation/blueprints-integration'
import { L3rdFloatingInspector } from '../../../FloatingInspectors/L3rdFloatingInspector'
import { PieceMultistepChevron } from '../../../SegmentContainer/PieceMultistepChevron'
import { IDefaultRendererProps } from './DefaultRenderer'
import { LoopingPieceIcon } from '../../../../lib/ui/icons/looping'

export function GraphicsRenderer({
	piece: pieceInstance,
	hovering,
	elementOffset,
	typeClass,
}: Readonly<IDefaultRendererProps>): JSX.Element {
	const content = pieceInstance.instance.piece.content as NoraContent | GraphicsContent | undefined

	return (
		<>
			<L3rdFloatingInspector
				showMiniInspector={!!hovering}
				content={content}
				position={{
					top: elementOffset?.top ?? 0,
					left: elementOffset?.left ?? 0,
					anchor: 'start',
					position: 'top-start',
				}}
				typeClass={typeClass}
				itemElement={null}
				piece={pieceInstance.instance.piece}
				pieceRenderedDuration={pieceInstance.renderedDuration}
				pieceRenderedIn={pieceInstance.renderedInPoint}
				displayOn="document"
			/>
			<PieceMultistepChevron className="segment-storyboard__piece__step-chevron" piece={pieceInstance} />
			{pieceInstance.instance.piece.name}
			{pieceInstance.instance.piece.content?.loop && (
				<LoopingPieceIcon className="segment-storyboard__part__piece-icon" playing={!!hovering} />
			)}
		</>
	)
}
