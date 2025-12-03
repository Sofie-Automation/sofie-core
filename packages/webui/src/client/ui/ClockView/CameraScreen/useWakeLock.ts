import { useEffect, useRef } from 'react'
import { catchError } from '../../../lib/lib.js'

export function useWakeLock(): void {
	const wakeLockRef = useRef<WakeLockSentinel | null>(null)
	useEffect(() => {
		if (!wakeLockRef.current) {
			;(async () => {
				wakeLockRef.current = (await navigator.wakeLock?.request('screen')) ?? null
			})().catch(catchError('request wakeLock'))
		}

		async function acquireWakeLock() {
			if (wakeLockRef.current !== null && document.visibilityState === 'visible') {
				wakeLockRef.current = (await navigator.wakeLock?.request('screen')) ?? null
			}
		}

		function onVisibilityChange() {
			acquireWakeLock().catch(console.warn)
		}

		document.addEventListener('visibilitychange', onVisibilityChange)

		return () => {
			if (wakeLockRef.current !== null) {
				wakeLockRef.current.release().catch(() => null)
				wakeLockRef.current = null
			}

			document.removeEventListener('visibilitychange', onVisibilityChange)
		}
	}, [])
}
