import { Logger } from 'winston'
import { WebSocket } from 'ws'
import { literal } from '@sofie-automation/shared-lib/dist/lib/lib'
import { WebSocketTopicBase, WebSocketTopic } from '../wsHandler.js'
import { CollectionHandlers } from '../liveStatusServer.js'
import { DBNotificationObj } from '@sofie-automation/corelib/dist/dataModel/Notifications'
import { toNotificationStatus } from './helpers/notification/toNotificationStatus.js'
import { NotificationObj } from '@sofie-automation/live-status-gateway-api'

const THROTTLE_PERIOD_MS = 100

export interface NotificationsEvent {
	event: 'notifications'
	activeNotifications: NotificationObj[]
}

export class NotificationsTopic extends WebSocketTopicBase implements WebSocketTopic {
	private _notifications: DBNotificationObj[] = []

	constructor(logger: Logger, handlers: CollectionHandlers) {
		super(NotificationsTopic.name, logger, THROTTLE_PERIOD_MS)

		// Subscribe to notifications handler
		handlers.notificationsHandler.subscribe(this.onNotificationsUpdate)
	}

	sendStatus(subscribers: Iterable<WebSocket>): void {
		const message = literal<NotificationsEvent>({
			event: 'notifications',
			activeNotifications: this._notifications
				.map(toNotificationStatus)
				.filter((notification) => notification !== undefined),
		})

		this.sendMessage(subscribers, message)
	}

	private onNotificationsUpdate = (notifications: DBNotificationObj[] | undefined): void => {
		this.logUpdateReceived('notifications')
		this._notifications = notifications ?? []
		this.throttledSendStatusToAll()
	}
}
