import { useEffect } from 'react'

export function useBlackBrowserTheme(): void {
	useEffect(() => {
		const themeColorMeta = document.head.querySelector('meta[name="theme-color"]')
		if (!themeColorMeta) return

		const oldValue = themeColorMeta.getAttribute('data-content')
		themeColorMeta.setAttribute('content', '#000000')

		return () => {
			if (oldValue) themeColorMeta.setAttribute('content', oldValue)
			else themeColorMeta.removeAttribute('content')
		}
	}, [])
}
