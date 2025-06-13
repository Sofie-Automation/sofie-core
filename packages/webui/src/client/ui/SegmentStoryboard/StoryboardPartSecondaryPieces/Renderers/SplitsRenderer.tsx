import { IDefaultRendererProps } from './DefaultRenderer.js'
import { getSplitItems } from '../../../SegmentContainer/getSplitItems.js'

export function SplitsRenderer({ piece: pieceInstance }: Readonly<IDefaultRendererProps>): JSX.Element {
	const splitItems = getSplitItems(pieceInstance, 'segment-storyboard__part__piece__contents__item')

	return (
		<>
			<div className="segment-storyboard__part__piece__contents">{splitItems}</div>
			{pieceInstance.instance.piece.name}
		</>
	)
}
