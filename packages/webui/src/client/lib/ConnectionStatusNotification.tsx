import { Meteor } from 'meteor/meteor'
import { DDP } from 'meteor/ddp'
import * as React from 'react'
import _ from 'underscore'
import { MomentFromNow } from './Moment.js'
import {
	NotificationCenter,
	NoticeLevel,
	Notification,
	NotificationList,
	NotifierHandle,
} from './notifications/notifications.js'
import { WithManagedTracker } from './reactiveData/reactiveDataHelper.js'
import { useTranslation } from 'react-i18next'
import { NotificationCenterPopUps } from './notifications/NotificationCenterPanel.js'
import { MeteorPubSub } from '@sofie-automation/meteor-lib/dist/api/pubsub'
import { ICoreSystem, ServiceMessage, Criticality } from '@sofie-automation/meteor-lib/dist/collections/CoreSystem'
import { TFunction } from 'react-i18next'
import { getRandomId } from '@sofie-automation/corelib/dist/lib'
import { CoreSystem } from '../collections/index.js'
import { useEffect } from 'react'

export class ConnectionStatusNotifier extends WithManagedTracker {
	private _notificationList: NotificationList
	private _notifier: NotifierHandle
	private _translator: TFunction
	private _serviceMessageRegistry: { [index: string]: ServiceMessage }

	constructor(t: TFunction) {
		super()

		this.subscribe(MeteorPubSub.coreSystem)

		this._translator = t

		this._notificationList = new NotificationList([])
		this._notifier = NotificationCenter.registerNotifier((): NotificationList => {
			return this._notificationList
		})

		// internal registry for service messages
		this._serviceMessageRegistry = {}

		let lastNotificationId: string | undefined = undefined
		let lastStatus: any = undefined

		this.autorun(() => {
			const meteorStatus = Meteor.status()
			const cs = CoreSystem.findOne()

			if (lastNotificationId) {
				const buf = lastNotificationId
				lastNotificationId = undefined
				try {
					NotificationCenter.drop(buf)
				} catch (_e) {
					// if the last notification can't be dropped, ignore
				}
			}

			const systemNotification: Notification | undefined = createSystemNotification(cs)
			const newNotification = this.createNewStatusNotification(meteorStatus)

			if (newNotification.persistent) {
				this._notificationList.set(_.compact([newNotification, systemNotification]))
			} else {
				this._notificationList.set(_.compact([systemNotification]))
				if (lastStatus !== status) {
					NotificationCenter.push(newNotification)
					lastNotificationId = newNotification.id
				}
			}

			if (cs) {
				this.updateServiceMessages(cs.serviceMessages)
			}

			lastStatus = status
		})
	}

	stop(): void {
		super.stop()

		this._notifier.stop()
	}

	private getNoticeLevel(status: string) {
		switch (status) {
			case 'connected':
				return NoticeLevel.NOTIFICATION
			case 'connecting':
				return NoticeLevel.WARNING
			default:
				return NoticeLevel.CRITICAL
		}
	}

	private getNoticeLevelForCriticality(criticality: Criticality) {
		switch (criticality) {
			case Criticality.CRITICAL:
				return NoticeLevel.CRITICAL

			case Criticality.WARNING:
				return NoticeLevel.WARNING

			case Criticality.NOTIFICATION:
			default:
				return NoticeLevel.NOTIFICATION
		}
	}

	private getStatusText(
		status: DDP.Status,
		reason: string | undefined,
		retryTime: number | undefined
	): string | React.ReactElement<HTMLElement> | null {
		const t = this._translator
		const platformName = t('Sofie Automation Server')
		switch (status) {
			case 'connecting':
				return <span>{t('Connecting to the {{platformName}}', { platformName })}.</span>
			case 'failed':
				return <span>{t('Cannot connect to the {{platformName}}: {{reason}}', { platformName, reason })}</span>
			case 'waiting':
				return (
					<span>
						{t('Reconnecting to the {{platformName}}', { platformName })}{' '}
						<MomentFromNow unit="seconds">{retryTime}</MomentFromNow>
					</span>
				)
			case 'offline':
				return <span>{t('Your machine is offline and cannot connect to the {{platformName}}.', { platformName })}</span>
			case 'connected':
				return <span>{t('Connected to the {{platformName}}.', { platformName })}</span>
		}
		return null
	}

	private createNewStatusNotification(meteorStatus: DDP.DDPStatus): Notification {
		const { status, reason, retryTime, connected } = meteorStatus
		const t = this._translator
		const notification = new Notification(
			getRandomId(),
			this.getNoticeLevel(status),
			this.getStatusText(status, reason, retryTime),
			this._translator('Sofie Automation Server'),
			Date.now(),
			!connected,
			status === 'failed' || status === 'waiting' || status === 'offline'
				? [
						{
							label: t('Reconnect now'),
							type: 'primary',
							icon: 'icon-retry',
							action: () => {
								Meteor.reconnect()
							},
						},
					]
				: undefined,
			-100
		)

		return notification
	}

	private updateServiceMessages(serviceMessages: { [index: string]: ServiceMessage }): void {
		const systemMessageIds = Object.keys(serviceMessages)

		// remove from internal list where ids not in active list
		Object.keys(this._serviceMessageRegistry)
			.filter((id) => systemMessageIds.indexOf(id) < 0)
			.forEach((idToRemove) => {
				delete this._serviceMessageRegistry[idToRemove]
				NotificationCenter.drop(idToRemove)
			})

		const localMessagesId = Object.keys(this._serviceMessageRegistry)
		// add ids not found in internal list
		systemMessageIds
			.filter((id) => localMessagesId.indexOf(id) < 0)
			.forEach((id) => {
				const newMessage = serviceMessages[id]
				this._serviceMessageRegistry[id] = newMessage

				const notification = this.createNotificationFromServiceMessage(newMessage)
				NotificationCenter.push(notification)
			})

		// compare and update where ids are in both lists, update if changed
		systemMessageIds
			.filter((id) => localMessagesId.indexOf(id) > -1)
			.forEach((id) => {
				const current = serviceMessages[id]
				if (!_.isEqual(current, this._serviceMessageRegistry[id])) {
					this._serviceMessageRegistry[id] = current
					const notification = this.createNotificationFromServiceMessage(current)
					NotificationCenter.drop(id)
					NotificationCenter.push(notification)
				}
			})
	}

	private createNotificationFromServiceMessage(message: ServiceMessage): Notification {
		return new Notification(
			message.id,
			this.getNoticeLevelForCriticality(message.criticality),
			message.message,
			message.sender || '(service message)',
			message.timestamp,
			true
		)
	}
}

function createSystemNotification(cs: ICoreSystem | undefined): Notification | undefined {
	if (cs && cs.systemInfo && cs.systemInfo.enabled) {
		return new Notification(
			getRandomId(),
			NoticeLevel.CRITICAL,
			cs.systemInfo.message,
			'SystemMessage',
			undefined,
			true,
			undefined,
			1000
		)
	}

	return undefined
}

export function ConnectionStatusNotification(): JSX.Element {
	const { t } = useTranslation()

	useEffect(() => {
		const notifier = new ConnectionStatusNotifier(t)

		return () => {
			notifier.stop()
		}
	}, [t])

	return <NotificationCenterPopUps />
}
