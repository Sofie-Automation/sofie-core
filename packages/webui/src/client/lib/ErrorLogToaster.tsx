import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Tracker } from 'meteor/tracker'
import { CorelibPubSub } from '@sofie-automation/corelib/dist/pubsub'
import { translateMessage } from '@sofie-automation/corelib/dist/TranslatableMessage'
import { useSubscription } from './ReactMeteorData/ReactMeteorData.js'
import { ErrorLog } from '../collections/index.js'
import { NoticeLevel, Notification, NotificationCenter } from './notifications/notifications.js'
import { errorLogNotificationId } from './clientUserAction.js'
import type { ErrorLogItemId } from '@sofie-automation/corelib/dist/dataModel/Ids'

/**
 * Shows a notification for every new error in the ErrorLog, so that all clients see errors from all clients
 */
export function ErrorLogToaster(): null {
	const { t } = useTranslation()
	const ready = useSubscription(CorelibPubSub.errorLog)

	useEffect(() => {
		if (!ready) return

		// The documents present when the subscription becomes ready are the existing history,
		// only notify about errors added after that
		let seenIds: Set<ErrorLogItemId> | undefined

		const computation = Tracker.autorun(() => {
			const items = ErrorLog.find({}, { sort: { timestamp: 1 } }).fetch()

			if (!seenIds) {
				seenIds = new Set(items.map((item) => item._id))
				return
			}

			for (const item of items) {
				if (seenIds.has(item._id)) continue
				seenIds.add(item._id)

				const id = errorLogNotificationId(item._id)
				// The client which caused the error may already show a more specific notification for it
				if (Tracker.nonreactive(() => NotificationCenter.getNotificationIDs().includes(id))) continue

				NotificationCenter.push(
					new Notification(
						id,
						NoticeLevel.CRITICAL,
						t('{{error}}', {
							error: translateMessage(item.error.message, t),
						}),
						'errorLog'
					)
				)
			}
		})

		return () => computation.stop()
	}, [ready, t])

	return null
}
