import { useContext, useEffect, useRef } from 'react'
import { StyledTimecode } from '../../../lib/StyledTimecode.js'
import classNames from 'classnames'
import StudioContext from '../../RundownView/StudioContext.js'

interface VTPreviewProps {
	content: {
		type: 'video'
		src: string
		seek?: number
		loop?: boolean
		itemDuration?: number
	}
	time: number | null
}

function setVideoElementPosition(
	vEl: HTMLVideoElement,
	timePosition: number,
	itemDuration: number,
	seek: number,
	loop: boolean
) {
	let targetTime = timePosition + seek
	if (loop && vEl.duration > 0) {
		targetTime =
			targetTime % ((itemDuration > 0 ? Math.min(vEl.duration * 1000, itemDuration) : vEl.duration * 1000) * 1000)
	} else if (itemDuration > 0) {
		targetTime = Math.min(timePosition, itemDuration)
	}
	vEl.currentTime = targetTime / 1000
}

export function VTPreviewElement({ content, time }: VTPreviewProps): React.ReactElement {
	const videoElement = useRef<HTMLVideoElement>(null)
	const studioContext = useContext(StudioContext)

	useEffect(() => {
		// Create a stable reference to the video element:
		const currentVideoElement = videoElement.current
		if (!currentVideoElement) return

		setVideoElementPosition(
			currentVideoElement,
			time ?? 0,
			content.itemDuration ?? 0,
			content.seek ?? 0,
			content.loop ?? false
		)
	}, [time, content.itemDuration, content.seek, content.loop])

	const itemDuration = content.itemDuration ?? 0
	const offsetTimePosition = (time ?? 0) + (content.seek ?? 0)
	// note - we should probably be following the content's framerate for this
	const showFrameMarker = offsetTimePosition <= 20 || (itemDuration > 0 && offsetTimePosition >= itemDuration - 20)

	return (
		<div className="preview-popUp__video">
			{showFrameMarker && (
				<div
					className={classNames('preview-popUp__video-frame-marker', {
						'preview-popUp__video-frame-marker--first-frame': offsetTimePosition <= 20,
						'preview-popUp__video-frame-marker--last-frame':
							itemDuration > 0 && offsetTimePosition >= itemDuration - 20,
					})}
				>
					<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
						<path d="M6 14.5L18.5 14.5V18.5H6H1.5V14V1.5H5.5V14V14.5H6Z" fill="#FFD600" stroke="black" />
					</svg>
				</div>
			)}
			<video src={content.src} ref={videoElement} crossOrigin="anonymous" playsInline={true} muted={true} />
			<div className="time">
				<StyledTimecode studioSettings={studioContext?.settings} time={Math.round(time ?? 0)} />
			</div>
		</div>
	)
}
