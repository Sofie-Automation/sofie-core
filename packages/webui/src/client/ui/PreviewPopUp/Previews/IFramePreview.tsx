import { useEffect, useRef } from 'react'
import { relativeToSiteRootUrl } from '../../../url.js'

interface IFramePreviewProps {
	content: {
		type: 'iframe'
		href: string
		awaitMessage?: any
		postMessage?: any
		dimensions?: { width: number; height: number }
	}
	time: number | null
}

export function IFramePreview({ content }: IFramePreviewProps): React.ReactElement {
	const iFrameElement = useRef<HTMLIFrameElement>(null)

	useEffect(() => {
		const currentIFrame = iFrameElement.current
		if (!currentIFrame) return

		const postMessageToIFrame = () => {
			if (content.postMessage) {
				// use * as URL reference to avoid cors when posting message with new reference:
				currentIFrame.contentWindow?.postMessage(content.postMessage, '*')
			}
		}

		currentIFrame.addEventListener('load', postMessageToIFrame)

		if (currentIFrame.contentDocument?.readyState === 'complete') {
			postMessageToIFrame()
		}

		return () => currentIFrame.removeEventListener('load', postMessageToIFrame)
	}, [content.postMessage, content.href])

	const style: Record<string, string | number> = {}
	if (content.dimensions) {
		style['--preview-render-width'] = content.dimensions.width
		style['--preview-render-height'] = content.dimensions.height
	}

	return (
		<div className="preview-popUp__iframe">
			<div className="preview" style={style}>
				<img src={relativeToSiteRootUrl('/images/previewBG.jpg')} alt="" />
				{content.href && (
					<iframe
						key={content.href} // Use the url as the key, so that the old renderer unloads immediately when changing url
						sandbox="allow-scripts allow-same-origin"
						src={content.href}
						ref={iFrameElement}
					></iframe>
				)}
			</div>
		</div>
	)
}
