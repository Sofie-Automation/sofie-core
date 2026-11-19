import { Logger } from 'winston'
import { WebSocket } from 'ws'
import { AllMessages } from '@sofie-automation/live-status-gateway-api'
import _ from 'underscore'

export abstract class WebSocketTopicBase {
	protected _name: string
	protected _logger: Logger
	protected _subscribers: Set<WebSocket> = new Set()
	protected throttledSendStatusToAll: () => void
	/**
	 * The message that every subscriber received last, as it was sent.
	 * Undefined until a message is sent to all subscribers, and again from when a subscriber joins,
	 * as the subscribers may then hold different messages.
	 */
	private _lastMessageSentToAllSubscribers: string | undefined

	constructor(name: string, logger: Logger, throttlePeriodMs = 0) {
		this._name = name
		this._logger = logger

		this._logger.info(`Starting ${this._name} topic`)
		this.throttledSendStatusToAll =
			throttlePeriodMs > 0
				? _.throttle(this.sendStatusToAll, throttlePeriodMs, {
						leading: false,
						trailing: true,
					})
				: this.sendStatusToAll
	}

	get subscriberCount(): number {
		return this._subscribers.size
	}

	addSubscriber(ws: WebSocket): void {
		this._logger.info(`${this._name} adding a websocket subscriber`)
		this._subscribers.add(ws)
		// The new subscriber gets the current message now, which the others may not have yet
		this._lastMessageSentToAllSubscribers = undefined
		this.sendStatus([ws])
	}

	hasSubscriber(ws: WebSocket): boolean {
		return this._subscribers.has(ws)
	}

	removeSubscriber(ws: WebSocket): void {
		if (this._subscribers.delete(ws)) this._logger.info(`${this._name} removing a websocket subscriber`)
	}

	processMessage(_ws: WebSocket, msg: object): void {
		this._logger.error(`Process ${this._name} message not expected '${JSON.stringify(msg)}'`)
	}

	/**
	 * Sends the message to the recipients.
	 * A message to all subscribers is not sent when it equals the last one they all received.
	 * A topic sends to all its subscribers by passing its own set of subscribers, as sendStatusToAll does.
	 * A message to other recipients, such as a reply or a new subscriber's first message, is always sent.
	 * So is a message that a topic sends to each subscriber separately.
	 */
	sendMessage(recipients: WebSocket | Iterable<WebSocket>, msg: AllMessages): void {
		// A topic sends to all its subscribers by passing its own set of subscribers
		const isToAllSubscribers = recipients === this._subscribers
		const recipientList = isIterable(recipients) ? Array.from(recipients) : [recipients]
		if (recipientList.length === 0) return // Optimization: only stringify if there are any recipients

		const msgStr = JSON.stringify(msg)
		if (isToAllSubscribers) {
			const isUnchanged = msgStr === this._lastMessageSentToAllSubscribers
			if (isUnchanged) {
				this._logger.silly(
					`Skip ${this._name} message to ${recipientList.length} recipients, as it is unchanged`
				)
				return
			}
		}

		for (const ws of recipientList) {
			ws.send(msgStr)
		}
		if (isToAllSubscribers) {
			this._lastMessageSentToAllSubscribers = msgStr
		}
		this._logger.silly(`Send ${this._name} message '${msgStr}' to ${recipientList.length} recipients`)
	}

	sendHeartbeat(recipients: Set<WebSocket>): void {
		const msgStr = JSON.stringify({ event: 'heartbeat' })
		for (const ws of recipients.values()) {
			ws.send(msgStr)
		}
	}

	protected logUpdateReceived(collectionName: string, extraInfo?: string): void {
		let message = `${this._name} received ${collectionName} update`
		if (extraInfo) {
			message += `, ${extraInfo}`
		}
		this._logger.debug(message)
	}

	abstract sendStatus(_subscribers: Iterable<WebSocket>): void

	protected sendStatusToAll = (): void => {
		this.sendStatus(this._subscribers)
	}
}

export interface WebSocketTopic {
	subscriberCount: number
	addSubscriber(ws: WebSocket): void
	hasSubscriber(ws: WebSocket): boolean
	removeSubscriber(ws: WebSocket): void
	processMessage(ws: WebSocket, msg: object): void
	sendMessage(ws: WebSocket, msg: object): void
}

function isIterable<T>(obj: T | Iterable<T>): obj is Iterable<T> {
	// checks for null and undefined
	if (obj == null) {
		return false
	}
	return typeof (obj as any)[Symbol.iterator] === 'function'
}
