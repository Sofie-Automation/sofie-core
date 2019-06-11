import { Meteor } from 'meteor/meteor'
import { Random } from 'meteor/random'
import * as React from 'react'
import * as _ from 'underscore'

import { Translated } from '../lib/ReactMeteorData/react-meteor-data'
import { MomentFromNow } from '../lib/Moment'

import { NotificationCenter, NoticeLevel, Notification, NotificationList, NotifierHandle } from '../lib/notifications/notifications'
import { WithManagedTracker } from '../lib/reactiveData/reactiveDataHelper'
import { TranslationFunction, translate } from 'react-i18next'
import { NotificationCenterPopUps } from '../lib/notifications/NotificationCenterPanel'
import { PubSub } from '../../lib/api/pubsub'
import { CoreSystem } from '../../lib/collections/CoreSystem'

export class ConnectionStatusNotifier extends WithManagedTracker {
	private _notificationList: NotificationList
	private _notifier: NotifierHandle
	private _translator: TranslationFunction

	constructor (t: TranslationFunction) {
		super()

		this.subscribe(PubSub.coreSystem, null)

		this._translator = t

		this._notificationList = new NotificationList([])
		this._notifier = NotificationCenter.registerNotifier((): NotificationList => {
			return this._notificationList
		})

		let lastNotificationId: string | undefined = undefined
		let lastStatus: any = undefined

		this.autorun(() => {
			const connected = Meteor.status().connected
			const status = Meteor.status().status
			const reason = Meteor.status().reason
			const retryTime = Meteor.status().retryTime

			if (lastNotificationId) {
				const buf = lastNotificationId
				lastNotificationId = undefined
				try {
					NotificationCenter.drop(buf)
				} catch (e) {
					// if the last notification can't be dropped, ignore
				}
			}

			const cs = CoreSystem.findOne()
			let systemNotification: Notification | undefined = undefined
			if (cs && cs.systemInfo && cs.systemInfo.enabled) {
				systemNotification = new Notification(
					Random.id(),
					NoticeLevel.CRITICAL,
					cs.systemInfo.message,
					'SystemMessage',
					undefined,
					true,
					undefined,
					1000)
			}

			document.title = 'Sofie' + (cs && cs.name ? ' - ' + cs.name : '')

			let newNotification = new Notification(
				Random.id(),
				this.getNoticeLevel(status),
				this.getStatusText(status, reason, retryTime),
				t('Sofie Automation Server'),
				Date.now(),
				!connected,
				(status === 'failed' || status === 'waiting' || status === 'offline')
				? [
					{
						label: 'Show issue',
						type: 'default'
					}
				] : undefined,
				-100)
			newNotification.on('action', (notification, type, e) => {
				switch (type) {
					case 'default':
						Meteor.reconnect()
				}
			})

			if (newNotification.persistent) {
				this._notificationList.set(_.compact([newNotification, systemNotification]))
			} else {
				this._notificationList.set(_.compact([systemNotification]))
				if (lastStatus !== status) {
					NotificationCenter.push(newNotification)
					lastNotificationId = newNotification.id
				}
			}

			lastStatus = status
		})
	}

	stop () {
		super.stop()

		this._notifier.stop()
	}

	private getNoticeLevel (status: string) {
		switch (status) {
			case 'connected':
				return NoticeLevel.NOTIFICATION
			case 'connecting':
				return NoticeLevel.WARNING
			default:
				return NoticeLevel.CRITICAL
		}
	}

	private getStatusText (
		status: string,
		reason: string | undefined,
		retryTime: number | undefined
	): string | React.ReactElement<HTMLElement> | null {
		const t = this._translator
		switch (status) {
			case 'connecting':
				return <span>{t('Connecting to the')} {t('Sofie Automation Server')}.</span>
			case 'failed':
				return <span>{t('Cannot connect to the')} {t('Sofie Automation Server:')}) + reason}</span>
			case 'waiting':
				return <span>{t('Reconnecting to the')} {t('Sofie Automation Server')} <MomentFromNow unit='seconds'>{retryTime}</MomentFromNow></span>
			case 'offline':
				return <span>{t('Your machine is offline and cannot connect to the')} {t('Sofie Automation Server')}.</span>
			case 'connected':
				return <span>{t('Connected to the')} {t('Sofie Automation Server')}.</span>
		}
		return null
	}
}

interface IProps {
}
interface IState {
	dismissed: boolean
}

export const ConnectionStatusNotification = translate()(class extends React.Component<Translated<IProps>, IState> {
	private notifier: ConnectionStatusNotifier

	constructor (props: Translated<IProps>) {
		super(props)

	}

	componentDidMount () {
		this.notifier = new ConnectionStatusNotifier(this.props.t)
	}

	componentWillUnmount () {
		this.notifier.stop()
	}

	render () {
		// this.props.connected
		return <NotificationCenterPopUps />
	}
})
