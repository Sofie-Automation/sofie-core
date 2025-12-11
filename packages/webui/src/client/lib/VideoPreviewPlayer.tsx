import { IStudioSettings } from '@sofie-automation/corelib/dist/dataModel/Studio'
import classNames from 'classnames'
import { useEffect, useRef } from 'react'
import { StyledTimecode } from './StyledTimecode.js'

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

interface IProps {
	studioSettings: Pick<IStudioSettings, 'frameRate'> | undefined
	previewUrl: string
	timePosition: number
	itemDuration: number
	seek: number
	loop: boolean
}

export function VideoPreviewPlayer({
	previewUrl,
	timePosition,
	itemDuration,
	seek,
	loop,
	studioSettings,
}: Readonly<IProps>): JSX.Element {
	const videoElement = useRef<HTMLVideoElement>(null)

	useEffect(() => {
		if (!videoElement.current) return

		setVideoElementPosition(videoElement.current, timePosition, itemDuration, seek, loop)
	}, [videoElement.current, timePosition, itemDuration, seek, loop])

	const offsetTimePosition = timePosition + seek
	const showFrameMarker = offsetTimePosition === 0 || offsetTimePosition >= itemDuration

	return (
		<>
			<video src={previewUrl} ref={videoElement} crossOrigin="anonymous" playsInline={true} muted={true} />
			{showFrameMarker && (
				<div
					className={classNames('video-preview-player__frame-marker', {
						'video-preview-player__frame-marker--first-frame': offsetTimePosition === 0,
						'video-preview-player__frame-marker--last-frame': itemDuration > 0 && offsetTimePosition >= itemDuration,
					})}
				>
					<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
						<path d="M6 14.5L18.5 14.5V18.5H6H1.5V14V1.5H5.5V14V14.5H6Z" fill="#FFD600" stroke="black" />
					</svg>
				</div>
			)}
			<span className="video-preview-player__timecode">
				<StyledTimecode studioSettings={studioSettings} time={offsetTimePosition} />
			</span>
		</>
	)
}
