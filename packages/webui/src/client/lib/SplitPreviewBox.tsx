import classNames from 'classnames'
import React from 'react'
import { RundownUtils } from './rundown'
import { SplitRole, SplitSubItem } from './ui/splitPreview'

export const RenderSplitPreview = React.memo(function RenderSplitPreview({
	subItems,
	showLabels,
}: {
	subItems: ReadonlyArray<Readonly<SplitSubItem>>
	showLabels: boolean
}) {
	const reversedSubItems = subItems.slice()
	reversedSubItems.reverse()

	return (
		<div className="video-preview">
			{reversedSubItems.map((item, index, array) => {
				return (
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
						{showLabels && item.role === SplitRole.BOX && <div className="video-preview__label">{item.label}</div>}
					</div>
				)
			})}
		</div>
	)
})
