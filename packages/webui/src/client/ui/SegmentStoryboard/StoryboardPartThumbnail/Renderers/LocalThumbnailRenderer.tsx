import { EvsContent } from '@sofie-automation/blueprints-integration'
import { IProps } from './ThumbnailRendererFactory.js'
import { getSizeClassForLabel } from '../../utils/getLabelClass.js'

export function LocalThumbnailRenderer({ pieceInstance }: Readonly<IProps>): JSX.Element {
	const localContent = pieceInstance.instance.piece.content as EvsContent

	const { color } = localContent

	return (
		<>
			<div
				className={`segment-storyboard__thumbnail__label ${getSizeClassForLabel(pieceInstance.instance.piece.name)}`}
			>
				{color && (
					<span
						style={{ color: color.startsWith('#') ? color : `#${color}` }}
						className="segment-storyboard__thumbnail__label segment-storyboard__thumbnail__label__colored-mark"
					></span>
				)}
				{pieceInstance.instance.piece.name}
			</div>
		</>
	)
}
