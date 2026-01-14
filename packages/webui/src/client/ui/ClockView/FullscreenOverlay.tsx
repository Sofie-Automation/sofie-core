import { useState, useEffect, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { parse as queryStringParse } from 'query-string'
import { useTranslation } from 'react-i18next'
import { catchError } from '../../lib/lib.js'

import './FullscreenOverlay.scss'

const PARAM_NAME_FULLSCREEN = 'fullscreen'

/**
 * A semi-transparent overlay that prompts the user to click to enter fullscreen mode.
 * Only shows when fullscreen=1 is in the URL query string.
 * Automatically hides when fullscreen is active, and reappears when fullscreen is exited.
 */
export function FullscreenOverlay(): JSX.Element | null {
	const { t } = useTranslation()
	const location = useLocation()
	const [isFullscreen, setIsFullscreen] = useState(() => document.fullscreenElement !== null)

	// Check if fullscreen=1 is in the URL
	const fullscreenRequested = (() => {
		const queryParams = queryStringParse(location.search, { arrayFormat: 'comma' })
		const fullscreenParam = queryParams[PARAM_NAME_FULLSCREEN] ?? false
		return Array.isArray(fullscreenParam) ? fullscreenParam[0] === '1' : fullscreenParam === '1'
	})()

	useEffect(() => {
		function handleFullscreenChange() {
			setIsFullscreen(document.fullscreenElement !== null)
		}

		document.addEventListener('fullscreenchange', handleFullscreenChange)
		return () => {
			document.removeEventListener('fullscreenchange', handleFullscreenChange)
		}
	}, [])

	const requestFullscreen = useCallback(() => {
		if (document.fullscreenElement !== null) return

		document.documentElement
			.requestFullscreen({
				navigationUI: 'hide',
			})
			.catch(catchError('FullscreenOverlay.requestFullscreen'))
	}, [])

	// Don't render if fullscreen not requested, already fullscreen, or not supported
	if (!fullscreenRequested || isFullscreen || !document.fullscreenEnabled) {
		return null
	}

	return (
		<button
			className="fullscreen-overlay"
			onClick={requestFullscreen}
			type="button"
			aria-label={t('Click or press Enter for fullscreen')}
		>
			<div className="fullscreen-overlay__content">
				<div className="fullscreen-overlay__icon">⛶</div>
				<div className="fullscreen-overlay__text">{t('Click anywhere for fullscreen')}</div>
			</div>
		</button>
	)
}
