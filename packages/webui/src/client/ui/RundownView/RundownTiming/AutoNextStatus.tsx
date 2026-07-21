import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { TimingDataResolution, TimingTickResolution, useTiming } from './withTiming.js'
import { NotificationCenter, Notification, NoticeLevel } from '../../../lib/notifications/notifications.js'

export function AutoNextStatus(): JSX.Element | null {
	const { t } = useTranslation()

	const timingDurations = useTiming(TimingTickResolution.High, TimingDataResolution.High, [
		'currentPartWillAutoNext',
		'currentPartAutoNextBlockedByInvalidReason',
	])

	const wasBlockedRef = useRef(false)
	useEffect(() => {
		const isBlocked = !!timingDurations.currentPartAutoNextBlockedByInvalidReason
		if (isBlocked && !wasBlockedRef.current) {
			NotificationCenter.push(
				new Notification(
					undefined,
					NoticeLevel.CRITICAL,
					t('Auto-take failed: {{error}}', { error: t('Part has issues and cannot be taken') }),
					'userAction'
				)
			)
		}
		wasBlockedRef.current = isBlocked
	}, [t, timingDurations.currentPartAutoNextBlockedByInvalidReason])

	return timingDurations.currentPartWillAutoNext ? (
		<div className="rundown-view__part__icon rundown-view__part__icon--auto-next">{t('Auto')}</div>
	) : null
}
