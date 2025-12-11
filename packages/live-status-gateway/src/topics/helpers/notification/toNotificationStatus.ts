import { NoteSeverity } from '@sofie-automation/blueprints-integration'
import { DBNotificationObj } from '@sofie-automation/corelib/dist/dataModel/Notifications'
import { interpollateTranslation } from '@sofie-automation/corelib/dist/TranslatableMessage'
import { NotificationObj, NotificationSeverity } from '@sofie-automation/live-status-gateway-api'
import { literal, unprotectString } from '@sofie-automation/server-core-integration'
import { toNotificationTarget } from './notificationTarget/toNotificationTarget.js'

export function toNotificationStatus(dbNotification: DBNotificationObj): NotificationObj | undefined {
	return literal<NotificationObj>({
		_id: unprotectString(dbNotification._id),
		severity: toNotificationSeverity(dbNotification.severity),
		message: interpollateTranslation(dbNotification.message.key, dbNotification.message.args),
		relatedTo: toNotificationTarget(dbNotification.relatedTo),
		created: dbNotification.created,
		modified: dbNotification.modified,
	})
}

function toNotificationSeverity(severity: NoteSeverity): NotificationSeverity {
	switch (severity) {
		case NoteSeverity.WARNING:
			return NotificationSeverity.WARNING
		case NoteSeverity.ERROR:
			return NotificationSeverity.ERROR
		case NoteSeverity.INFO:
			return NotificationSeverity.ERROR
	}
}
