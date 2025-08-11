import { PieceMultistepChevron } from '../../../SegmentContainer/PieceMultistepChevron.js'
import { IProps } from './ThumbnailRendererFactory.js'
import { LoopingPieceIcon } from '../../../../lib/ui/icons/looping.js'

export function GraphicsThumbnailRenderer({ pieceInstance, hovering }: Readonly<IProps>): JSX.Element {
	return (
		<>
			<div className="segment-storyboard__thumbnail__label segment-storyboard__thumbnail__label--sm">
				<PieceMultistepChevron className="segment-storyboard__piece__step-chevron" piece={pieceInstance} />
				{pieceInstance.instance.piece.content?.loop && (
					<LoopingPieceIcon className="segment-storyboard__thumbnail__label-icon" playing={hovering} />
				)}
				{pieceInstance.instance.piece.name}
			</div>
		</>
	)
}
