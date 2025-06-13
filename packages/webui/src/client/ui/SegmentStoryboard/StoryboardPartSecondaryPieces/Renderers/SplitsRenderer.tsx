import { SplitsContent } from '@sofie-automation/blueprints-integration'
import { IDefaultRendererProps } from './DefaultRenderer'
import { SplitsFloatingInspector } from '../../../FloatingInspectors/SplitsFloatingInspector'
import { getSplitItems } from '../../../SegmentContainer/getSplitItems'

export function SplitsRenderer({
	piece: pieceInstance,
	hovering,
	elementOffset,
	typeClass,
}: Readonly<IDefaultRendererProps>): JSX.Element {
	const splitItems = getSplitItems(pieceInstance, 'segment-storyboard__part__piece__contents__item')

	return (
		<>
			<div className="segment-storyboard__part__piece__contents">{splitItems}</div>
			<SplitsFloatingInspector
				position={{
					top: elementOffset?.top ?? 0,
					left: elementOffset?.left ?? 0,
					anchor: 'start',
					position: 'top-start',
				}}
				itemElement={null}
				content={pieceInstance.instance.piece.content as Partial<SplitsContent>}
				showMiniInspector={!!hovering}
				typeClass={typeClass}
			/>
			{pieceInstance.instance.piece.name}
		</>
	)
}
