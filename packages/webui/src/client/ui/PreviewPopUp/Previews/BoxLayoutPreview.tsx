import type { SplitsContentBoxContent, SplitsContentBoxProperties } from '@sofie-automation/blueprints-integration'
import type { SplitBoxPreviewUrls } from '@sofie-automation/corelib/dist/dataModel/PieceContentStatus'
import type { SplitsBoxLayoutScrubSettings } from '../../../lib/ui/splitsPreviewVideo.js'
import { setVideoElementPosition } from '../../../lib/ui/videoPreviewScrub.js'
import classNames from 'classnames'
import { useEffect, useMemo, useRef } from 'react'
import { getSplitPreview, SplitRole, type SplitSubItem } from '../../../lib/ui/splitPreview.js'
import type { ReadonlyDeep } from 'type-fest'
import { RundownUtils } from '../../../lib/rundown.js'

interface BoxLayoutPreviewProps {
	content: {
		type: 'boxLayout'
		boxSourceConfiguration: ReadonlyDeep<(SplitsContentBoxContent & SplitsContentBoxProperties)[]>
		boxPreviews?: ReadonlyDeep<SplitBoxPreviewUrls[]>
		scrub?: SplitsBoxLayoutScrubSettings
		showLabels?: boolean
		backgroundArtSrc?: string
	}
	time: number | null
}

function SplitBoxMedia({
	item,
	time,
	scrub,
}: {
	item: Readonly<SplitSubItem>
	time: number | null
	scrub: SplitsBoxLayoutScrubSettings | undefined
}): React.ReactElement | null {
	const videoRef = useRef<HTMLVideoElement>(null)

	useEffect(() => {
		const el = videoRef.current
		if (!el || !item.previewUrl) return

		setVideoElementPosition(el, time ?? 0, scrub?.itemDuration ?? 0, item.seek ?? 0, scrub?.loop ?? false)
	}, [time, scrub?.itemDuration, scrub?.loop, item.previewUrl, item.seek])

	if (item.previewUrl) {
		return (
			<video
				ref={videoRef}
				src={item.previewUrl}
				className="video-preview__image"
				crossOrigin="anonymous"
				playsInline
				muted
			/>
		)
	}

	if (item.thumbnailUrl) {
		return <img src={item.thumbnailUrl} alt="" className="video-preview__image" />
	}

	return null
}

export function BoxLayoutPreview({ content, time }: BoxLayoutPreviewProps): React.ReactElement {
	const reversedItems = useMemo(
		() =>
			content.boxSourceConfiguration
				? getSplitPreview(content.boxSourceConfiguration, content.boxPreviews).slice().reverse()
				: [],
		[content.boxSourceConfiguration, content.boxPreviews]
	)

	return (
		<div className="preview-popUp__box-layout checkerboard-bg">
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
					<SplitBoxMedia item={item} time={time} scrub={content.scrub} />
					{content.showLabels && item.role === SplitRole.BOX && (
						<div className="video-preview__label">{item.label}</div>
					)}
				</div>
			))}
		</div>
	)
}
