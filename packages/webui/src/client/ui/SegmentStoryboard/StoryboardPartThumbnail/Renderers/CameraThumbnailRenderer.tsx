import { getSizeClassForLabel } from '../../utils/getLabelClass.js'
import { IProps } from './ThumbnailRendererFactory.js'

export function CameraThumbnailRenderer({ pieceInstance }: Readonly<IProps>): JSX.Element {
	return (
		<>
			<div
				className={`segment-storyboard__thumbnail__label ${getSizeClassForLabel(pieceInstance.instance.piece.name)}`}
			>
				{pieceInstance.instance.piece.name}
			</div>
		</>
	)
}
