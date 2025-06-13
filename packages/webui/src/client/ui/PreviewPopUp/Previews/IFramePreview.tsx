import { useCallback, useEffect, useRef } from 'react'
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

	const onLoadListener = useCallback(() => {
		if (content.postMessage) {
			const url = new URL(content.href)
			iFrameElement.current?.contentWindow?.postMessage(content.postMessage, url.origin)
		}
	}, [])

	useEffect(() => {
		if (!iFrameElement) return

		iFrameElement.current?.addEventListener('load', onLoadListener)

		return () => iFrameElement.current?.removeEventListener('load', onLoadListener)
	}, [iFrameElement.current, onLoadListener])

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
