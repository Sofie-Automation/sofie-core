import { SplitsContentBoxContent, SplitsContentBoxProperties } from '@sofie-automation/blueprints-integration'
import classNames from 'classnames'
import { useMemo } from 'react'
import { RundownUtils } from '../../../lib/rundown.js'
import { getSplitPreview, SplitRole } from '../../../lib/ui/splitPreview.js'
import { ReadonlyDeep } from 'type-fest'

interface BoxLayoutPreviewProps {
	content: {
		type: 'boxLayout'
		boxSourceConfiguration: ReadonlyDeep<(SplitsContentBoxContent & SplitsContentBoxProperties)[]>
		showLabels?: boolean
		backgroundArtSrc?: string
	}
}

export function BoxLayoutPreview({ content }: BoxLayoutPreviewProps): React.ReactElement {
	const reversedItems = useMemo(
		() => (content.boxSourceConfiguration ? getSplitPreview(content.boxSourceConfiguration).slice().reverse() : []),
		[content.boxSourceConfiguration]
	)

	return (
		<div className="preview-popUp__box-layout">
			{content.backgroundArtSrc && (
				<div className="video-preview background">
					<img src={content.backgroundArtSrc} alt="" />
				</div>
			)}
			{reversedItems.map((item, index, array) => (
				<div
					className={classNames(
						'video-preview',
						RundownUtils.getSourceLayerClassName(item.type),
						{
							background: item.role === SplitRole.ART,
							box: item.role === SplitRole.BOX,
						},
						{
							second: array.length > 1 && index > 0 && item.type === array[index - 1].type,
						},
						{ upper: index >= array.length / 2 },
						{ lower: index < array.length / 2 }
					)}
					key={item._id + '-preview'}
					style={{
						left: ((item.content?.x ?? 0) * 100).toString() + '%',
						top: ((item.content?.y ?? 0) * 100).toString() + '%',
						width: ((item.content?.scale ?? 1) * 100).toString() + '%',
						height: ((item.content?.scale ?? 1) * 100).toString() + '%',
						clipPath: item.content?.crop
							? `inset(${item.content.crop.top * 100}% ${item.content.crop.right * 100}% ${
									item.content.crop.bottom * 100
								}% ${item.content.crop.left * 100}%)`
							: undefined,
					}}
				>
					{content.showLabels && item.role === SplitRole.BOX && (
						<div className="video-preview__label">{item.label}</div>
					)}
				</div>
			))}
		</div>
	)
}
