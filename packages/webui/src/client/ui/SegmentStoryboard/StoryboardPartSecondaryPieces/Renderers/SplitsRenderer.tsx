import type { IDefaultRendererProps } from './DefaultRenderer.js'
import { getSplitItems } from '../../../SegmentContainer/getSplitItems.js'
import { useContentStatusForPieceInstance } from '../../../SegmentTimeline/withMediaObjectStatus.js'

export function SplitsRenderer({ piece: pieceInstance }: Readonly<IDefaultRendererProps>): JSX.Element {
	const contentStatus = useContentStatusForPieceInstance(pieceInstance.instance)
	const splitItems = getSplitItems(
		pieceInstance,
		'segment-storyboard__part__piece__contents__item',
		contentStatus?.boxPreviews
	)

	return (
		<>
			<div className="segment-storyboard__part__piece__contents">{splitItems}</div>
			{pieceInstance.instance.piece.name}
		</>
	)
}
