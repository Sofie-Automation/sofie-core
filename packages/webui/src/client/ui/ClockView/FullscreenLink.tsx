import { useCallback, MouseEvent } from 'react'
import { Link, useHistory } from 'react-router-dom'
import { catchError } from '../../lib/lib.js'

interface FullscreenLinkProps {
	to: string
	children: React.ReactNode
	className?: string
}

/**
 * Appends fullscreen=1 to a URL path, handling existing query strings.
 */
function addFullscreenParam(url: string): string {
	const hasQuery = url.includes('?')
	return hasQuery ? `${url}&fullscreen=1` : `${url}?fullscreen=1`
}

/**
 * A link that navigates to a destination and also triggers fullscreen mode.
 * Regular clicks will navigate AND trigger fullscreen.
 * Cmd-click, Ctrl-click, or middle-click will open in a new tab (normal link behavior).
 * The URL will include ?fullscreen=1 so the FullscreenOverlay can prompt for fullscreen if needed.
 */
export function FullscreenLink({ to, children, className }: Readonly<FullscreenLinkProps>): JSX.Element {
	const history = useHistory()
	const fullscreenUrl = addFullscreenParam(to)

	const handleClick = useCallback(
		(e: MouseEvent<HTMLAnchorElement>) => {
			// Allow normal link behavior for modifier keys or non-left clicks
			if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) {
				return
			}

			e.preventDefault()

			// Request fullscreen first, then navigate
			document.documentElement
				.requestFullscreen({
					navigationUI: 'hide',
				})
				.then(() => {
					history.push(fullscreenUrl)
				})
				.catch((err) => {
					// If fullscreen fails (e.g., not allowed), still navigate
					catchError('FullscreenLink.requestFullscreen')(err)
					history.push(fullscreenUrl)
				})
		},
		[fullscreenUrl, history]
	)

	return (
		<Link to={fullscreenUrl} onClick={handleClick} className={className}>
			{children}
		</Link>
	)
}
