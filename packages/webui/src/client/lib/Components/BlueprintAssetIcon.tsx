import { useEffect, useMemo, useState } from 'react'
import { createPrivateApiPath } from '../../url.js'

const GLOBAL_BLUEPRINT_ASSET_CACHE: Record<string, string> = {}

export function BlueprintAssetIcon({ src, className }: { src: string; className?: string }): JSX.Element | null {
	const url = useMemo(() => {
		if (src.startsWith('data:')) return new URL(src)
		return new URL(createPrivateApiPath('/blueprints/assets/' + src), location.href)
	}, [src])
	const [svgAsset, setSvgAsset] = useState<string | null>(GLOBAL_BLUEPRINT_ASSET_CACHE[url.href] ?? null)

	useEffect(() => {
		if (svgAsset) return
		if (url.origin !== window.origin && url.origin !== null) {
			console.error(`Invalid origin for BlueprintAssetIcon: ${url}`)
			return
		}

		const abort = new AbortController()

		fetch(url, {
			redirect: 'follow',
			referrerPolicy: 'origin',
			signal: abort.signal,
		})
			.then((res) => {
				if (res.status !== 200) throw new Error(`Invalid response code: ${url} ${res.status} ${res.statusText}`)
				if (!res.headers.get('content-type')?.startsWith('image/svg'))
					throw new Error(`Asset is not an SVG image: ${url}`)

				return res.text()
			})
			.then((body) => {
				GLOBAL_BLUEPRINT_ASSET_CACHE[url.href] = body
				if (abort.signal.aborted) return
				setSvgAsset(body)
			})
			.catch((err) => {
				console.error(err)
				setSvgAsset(null)
			})

		return () => {
			abort.abort()
		}
	}, [url, svgAsset])

	const dangerouslySetInnerHTML = useMemo(() => {
		if (!svgAsset) return undefined

		return {
			__html: svgAsset,
		}
	}, [svgAsset])

	if (svgAsset === null) {
		return null
	}

	return <div className={className} dangerouslySetInnerHTML={dangerouslySetInnerHTML}></div>
}
