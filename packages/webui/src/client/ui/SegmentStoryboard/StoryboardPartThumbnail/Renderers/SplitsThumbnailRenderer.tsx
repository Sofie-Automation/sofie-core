import type { SplitsContent } from '@sofie-automation/blueprints-integration'
import type { IProps } from './ThumbnailRendererFactory.js'
import { RenderSplitPreview } from '../../../../lib/SplitPreviewBox.js'
import { getSplitPreview } from '../../../../lib/ui/splitPreview.js'
import { useContentStatusForPieceInstance } from '../../../SegmentTimeline/withMediaObjectStatus.js'

export function SplitsThumbnailRenderer({ pieceInstance }: Readonly<IProps>): JSX.Element {
	const contentStatus = useContentStatusForPieceInstance(pieceInstance.instance)
	const subItems = getSplitPreview(
		(pieceInstance.instance.piece.content as SplitsContent).boxSourceConfiguration,
		contentStatus?.boxPreviews
	)

	return (
		<>
			<div className="segment-storyboard__thumbnail__split-layout checkerboard-bg">
				<RenderSplitPreview subItems={subItems} showLabels={false} flatLayout />
			</div>
			<div className="segment-storyboard__thumbnail__label segment-storyboard__thumbnail__label--lg">
				{pieceInstance.instance.piece.name}
			</div>
		</>
	)
}
