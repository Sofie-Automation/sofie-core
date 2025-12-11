import { ReactiveVar } from 'meteor/reactive-var'
import _ from 'underscore'
import { Tracker } from 'meteor/tracker'
import { Meteor } from 'meteor/meteor'
import { EventEmitter } from 'events'
import { assertNever, getRandomString } from '@sofie-automation/corelib/dist/lib'
import type { Time } from '@sofie-automation/shared-lib/dist/lib/lib'
import {
	ProtectedString,
	unprotectString,
	isProtectedString,
	protectString,
} from '@sofie-automation/shared-lib/dist/lib/protectedString'
import { isTranslatableMessage, ITranslatableMessage } from '@sofie-automation/corelib/dist/TranslatableMessage'
import { PieceStatusCode } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { MeteorCall } from '../../lib/meteorApi.js'
import { RundownId, SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { LocalStorageProperty } from '../localStorage.js'

let reportNotificationsId: string | null = null

export function getReportNotifications(): string | null {
	return reportNotificationsId
}

export function setReportNotifications(id: string | null): void {
	reportNotificationsId = id
}

Meteor.startup(() => {
	reportNotificationsId = localStorage.getItem(LocalStorageProperty.LOG_NOTIFICATIONS)
})

/**
 * Priority level for Notifications.
 *
 * @export
 * @enum {number}
 */
export enum NoticeLevel {
	/** Highest priority notification. Subject matter will affect operations. */
	CRITICAL = 0b0001, // 1
	/** High priority notification. Operations will not be affected, but non-critical functions may be affected or the result may be undesirable. */
	WARNING = 0b0010, // 2
	/** Confirmation of a successful operation and general information. */
	NOTIFICATION = 0b0100, // 4
	/** Tips to the user */
	TIP = 0b1000, // 8
}

/**
 * An action object interface defining actions that the user can take on an action
 *
 * @export
 * @interface NotificationAction
 */
export interface NotificationAction {
	/** User-presented string label on the action button */
	label: string
	/** Action type. If set to 'default', will attach this action to a click on the notification. */
	type: string // for a default, use 'default'
	/** Icon shown on the action button. */
	icon?: any
	/** The method that will be called when the user takes the action. */
	action?: (e: any) => void
	/** If true, will disable the action (ie the button will show, but not clickable). */
	disabled?: boolean
}

/** A source of notifications */
export type Notifier = () => NotificationList

const notifiers: { [index: string]: NotifierHandle } = {}

const notifications: { [index: string]: Notification } = {}
const notificationsDep: Tracker.Dependency = new Tracker.Dependency()

interface NotificationHandle {
	id: string
	stop: () => void
}

/**
 * A reactive list of notifications, produced by a Notifier.
 *
 * @export
 * @class NotificationList
 * @extends {ReactiveVar<Notification[]>}
 */
export class NotificationList extends ReactiveVar<Notification[]> {}

/**
 * A handle object to a registered notifier.
 *
 * @export
 * @class NotifierObject
 */
export class NotifierHandle {
	id: string
	source: Notifier
	handle: Tracker.Computation
	result: Array<Notification> = []

	/**
	 * Creates an instance of NotifierHandle. Used internally by the Notification Center singleton.
	 * @param {string} notifierId
	 * @param {Notifier} source
	 * @memberof NotifierHandle
	 */
	constructor(notifierId: string, source: Notifier) {
		this.id = notifierId
		this.source = source
		this.handle = Tracker.nonreactive(() => {
			return Tracker.autorun(() => {
				this.result = source().get()
				notificationsDep.changed()
			})
		})

		notifiers[notifierId] = this
	}

	/**
	 * Stop notifications from this notifier.
	 *
	 * @memberof NotifierHandle
	 */
	stop(): void {
		this.handle.stop()

		delete notifiers[this.id]

		notificationsDep.changed()
	}
}

export type NotificationsSource = RundownId | SegmentId | string | undefined
/**
 * Singleton handling all the notifications.
 *
 * @class NotificationCenter0
 */
class NotificationCenter0 {
	/** Default notification timeout for non-persistent notifications */
	private readonly NOTIFICATION_TIMEOUT = 5000
	/** The highlighted source of notifications */
	private highlightedSource: ReactiveVar<NotificationsSource>
	/** The highlighted level of highlighted level */
	private highlightedLevel: ReactiveVar<NoticeLevel>

	private _isOpen = false

	/** In concentration mode, non-Critical notifications will be snoozed automatically */
	private _isConcentrationMode = false

	constructor() {
		this.highlightedSource = new ReactiveVar<NotificationsSource>(undefined)
		this.highlightedLevel = new ReactiveVar<NoticeLevel>(NoticeLevel.TIP)

		const notifLogUserId = getReportNotifications()
		if (notifLogUserId) {
			let oldNotificationIds: string[] = []
			Tracker.autorun(() => {
				const newNotifIds = this.getNotificationIDs()
				const oldNotifIds = new Set(oldNotificationIds)

				newNotifIds
					.filter((id) => !oldNotifIds.has(id))
					.forEach((id) => {
						const notification = notifications[id]

						if (notification && !notification.snoozed) {
							const message = isTranslatableMessage(notification.message)
								? notification.message.key
								: typeof notification.message === 'string'
									? notification.message
									: '[React Element]'

							MeteorCall.client
								.clientLogNotification(
									notification.created,
									notifLogUserId,
									notification.status,
									message,
									notification.source
								)
								.catch((e) => {
									console.log(e)
								})
						}
					})

				oldNotificationIds = newNotifIds
			})
		}
	}

	get isConcentrationMode(): boolean {
		return this._isConcentrationMode
	}

	set isConcentrationMode(value: boolean) {
		this._isConcentrationMode = value

		if (value)
			NotificationCenter.snoozeAll(
				{
					status: NoticeLevel.TIP,
				},
				{
					status: NoticeLevel.NOTIFICATION,
				},
				{
					status: NoticeLevel.WARNING,
				}
			)
	}

	get isOpen(): boolean {
		return this._isOpen
	}

	set isOpen(value: boolean) {
		this._isOpen = value

		if (value) NotificationCenter.snoozeAll()
	}

	/**
	 * Register a notifier in the Notification center.
	 *
	 * @param {Notifier} source The notifier to be registered.
	 * @returns {NotifierHandle} The handler than can be used to unregister a notifier.
	 * @memberof NotificationCenter0
	 */
	registerNotifier(source: Notifier): NotifierHandle {
		const notifierId = getRandomString()

		return new NotifierHandle(notifierId, source)
	}

	/**
	 * Push a single-use notification into the Notification Center.
	 *
	 * @param {Notification} notice The notification to be added.
	 * @returns {NotificationHandle} The handler that can be used to drop the notification.
	 * @memberof NotificationCenter0
	 */
	push(notice: Notification): NotificationHandle {
		const id = notice.id || getRandomString()
		notifications[id] = notice
		notice.id = id
		notificationsDep.changed()

		if (!notice.persistent) {
			this.timeout(notice)
		}

		if (!notice.snoozed && this._isOpen) {
			notice.snooze()
		}
		if (!notice.snoozed && this._isConcentrationMode) {
			if (notice.status !== NoticeLevel.CRITICAL && notice.timeout === undefined && notice.persistent === true) {
				notice.snooze()
			}
		}

		return {
			id,
			stop: () => {
				this.drop(id)
			},
		}
	}

	/**
	 * Remove a notification from the Notification Center
	 *
	 * @param {string} id The ID of a notification
	 * @memberof NotificationCenter0
	 */
	drop(id: string): void {
		if (notifications[id]) {
			notifications[id].emit('dropped')
			delete notifications[id]
			notificationsDep.changed()
		} else {
			throw new Meteor.Error(404, `Notification "${id}" could not be found in the Notification Center`)
		}
	}

	/**
	 * Get a reactive array of notifications in the Notification Center
	 *
	 * @returns {Array<Notification>}
	 * @memberof NotificationCenter0
	 */
	getNotifications(): Array<Notification> {
		notificationsDep.depend()

		return _.flatten(
			Object.values<NotifierHandle>(notifiers)
				.map((item) => {
					item.result.forEach((i) => {
						if (this._isOpen && !i.snoozed) i.snooze()
						if (
							this._isConcentrationMode &&
							!i.snoozed &&
							i.status !== NoticeLevel.CRITICAL &&
							i.timeout === undefined &&
							i.persistent === true
						) {
							i.snooze()
						}
					})
					return item.result
				})
				.concat(Object.values<Notification>(notifications))
		)
	}

	/**
	 * Get a reactive array of notification id's in the Notification Center
	 *
	 * @returns {Array<string>}
	 * @memberof NotificationCenter0
	 */
	getNotificationIDs(): Array<string> {
		notificationsDep.depend()

		return Object.keys(notifications)
	}

	/**
	 * Get a reactive number of notifications in the Notification Center
	 *
	 * @returns {number}
	 * @memberof NotificationCenter0
	 */
	count(filter?: NoticeLevel): number {
		notificationsDep.depend()

		// return (
		// 	Object.values(notifiers)
		// 		.map((item) => (item.result || []).length)
		// 		.reduce((a, b) => a + b, 0) + Object.values(notifications).length
		// )
		if (filter === undefined) {
			return (
				Object.values<NotifierHandle>(notifiers).reduce<number>((a, b) => a + (b.result || []).length, 0) +
				Object.values<Notification>(notifications).length
			)
		} else {
			return (
				Object.values<NotifierHandle>(notifiers).reduce<number>(
					(a, b) => a + (b.result || []).filter((item) => (item.status & filter) !== 0).length,
					0
				) + Object.values<Notification>(notifications).filter((item) => (item.status & filter) !== 0).length
			)
		}
	}

	/**
	 * Dismiss all notifications in the Notification Center
	 *
	 * @memberof NotificationCenter0
	 */
	snoozeAll(...filters: Partial<Notification>[]) {
		let n = this.getNotifications()
		if (filters && filters.length) {
			const matchers = filters.map((filter) => _.matches(filter))
			n = n.filter((v, _index, _array) => matchers.map((m) => m(v)).reduce((value, memo) => value || memo, false))
		}
		n.forEach((item) => item.snooze())
	}

	/**
	 * Highlight all notifications from a given source at a given notification level
	 *
	 * @param {(string | undefined)} source
	 * @param {NoticeLevel} level
	 * @memberof NotificationCenter0
	 */
	highlightSource(source: SegmentId | undefined, level: NoticeLevel) {
		this.highlightedSource.set(source)
		this.highlightedLevel.set(level)
	}

	/**
	 * Get the highlighted source ID
	 *
	 * @returns
	 * @memberof NotificationCenter0
	 */
	getHighlightedSource() {
		return this.highlightedSource.get()
	}

	/**
	 * Get the highlighted level
	 *
	 * @returns
	 * @memberof NotificationCenter0
	 */
	getHighlightedLevel() {
		return this.highlightedLevel.get()
	}

	/**
	 * Timeout the notification once the notification timeout elapses.
	 *
	 * @param {Notification} notice
	 * @memberof NotificationCenter0
	 */
	private timeout(notice: Notification): void {
		Meteor.setTimeout(() => {
			if (notice) {
				const id = notice.id
				if (id && notifications[id]) {
					this.drop(id)
				}
			}
		}, notice.timeout || this.NOTIFICATION_TIMEOUT)
	}
}

export const NotificationCenter = new NotificationCenter0()

/**
 * A Notification that can be presented to the user
 *
 * @export
 * @class Notification
 * @extends {EventEmitter}
 */
export class Notification extends EventEmitter {
	id: string | undefined
	status: NoticeLevel
	message: string | React.ReactElement<HTMLElement> | ITranslatableMessage | null
	source: NotificationsSource
	persistent?: boolean
	timeout?: number
	snoozed?: boolean
	actions?: Array<NotificationAction>
	created: Time
	rank: number

	constructor(
		id: string | ProtectedString<any> | undefined,
		status: NoticeLevel,
		message: string | React.ReactElement<HTMLElement> | ITranslatableMessage | null,
		source: NotificationsSource,
		created?: Time,
		persistent?: boolean,
		actions?: Array<NotificationAction>,
		rank?: number,
		timeout?: number
	) {
		super()

		this.id = isProtectedString(id) ? unprotectString(id) : id
		this.status = status
		this.message = message
		this.source = source
		this.persistent = persistent || false
		this.actions = actions || undefined
		this.created = created || Date.now()
		this.rank = rank || 0
		this.timeout = timeout
	}

	/**
	 * Check if two notifications are equal
	 *
	 * @static
	 * @param {(Notification | undefined)} a
	 * @param {(Notification | undefined)} b
	 * @returns {boolean}
	 * @memberof Notification
	 */
	static isEqual(a: Notification | undefined, b: Notification | undefined): boolean {
		if (typeof a !== typeof b) return false
		return _.isEqual(
			_.omit(a, ['created', 'snoozed', 'actions', '_events']),
			_.omit(b, ['created', 'snoozed', 'actions', '_events'])
		)
	}

	/**
	 * Compare two notifications, for use in sorting
	 *
	 * @static
	 * @param {Notification} a
	 * @param {Notification} b
	 * @returns {number}
	 * @memberof Notification
	 */
	static compare(a: Notification, b: Notification): number {
		return (
			(!!a.persistent === !!b.persistent ? 0 : a.persistent && !b.persistent ? 1 : -1) ||
			a.status - b.status ||
			a.rank - b.rank ||
			a.created - b.created
		)
	}

	/**
	 * Dismiss a notification (snooze it, but not remove it)
	 *
	 * @memberof Notification
	 */
	snooze(): void {
		this.snoozed = true
		notificationsDep.changed()
		this.emit('snoozed', this)
	}

	/**
	 * Remove notification from the Notification Center
	 *
	 * @memberof Notification
	 */
	drop(): void {
		if (this.id) {
			NotificationCenter.drop(this.id)
		}
	}

	/**
	 * Callback called by the Notification Center when a user takes an action
	 *
	 * @param {string} type
	 * @param {*} event
	 * @memberof Notification
	 */
	action(type: string, event: React.SyntheticEvent): void {
		this.emit('action', this, type, event)
	}
}

export function getNoticeLevelForPieceStatus(statusCode: PieceStatusCode | undefined): NoticeLevel | null {
	switch (statusCode) {
		case PieceStatusCode.OK:
		case PieceStatusCode.UNKNOWN:
		case undefined:
			return null
		case PieceStatusCode.SOURCE_NOT_SET:
			return NoticeLevel.CRITICAL
		case PieceStatusCode.SOURCE_MISSING:
		case PieceStatusCode.SOURCE_BROKEN:
		case PieceStatusCode.SOURCE_UNKNOWN_STATE:
			return NoticeLevel.WARNING
		case PieceStatusCode.SOURCE_HAS_ISSUES:
		case PieceStatusCode.SOURCE_NOT_READY:
			return NoticeLevel.NOTIFICATION
		default:
			assertNever(statusCode)
			return NoticeLevel.WARNING
	}
}

Meteor.startup(() => {
	const windowAny: any = window

	windowAny['testNotification'] = function (
		delay: number,
		level: NoticeLevel = NoticeLevel.CRITICAL,
		fakePersistent = false
	) {
		NotificationCenter.push(
			new Notification(
				undefined,
				level,
				'Notification test',
				protectString('test'),
				undefined,
				fakePersistent,
				undefined,
				100000,
				delay || 10000
			)
		)
	}
	windowAny['notificationCenter'] = NotificationCenter
})
