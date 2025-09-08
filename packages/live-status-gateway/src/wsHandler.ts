import { Logger } from 'winston'
import { WebSocket } from 'ws'
import { AllMessages } from '@sofie-automation/live-status-gateway-api'
import _ from 'underscore'

export abstract class WebSocketTopicBase {
	protected _name: string
	protected _logger: Logger
	protected _subscribers: Set<WebSocket> = new Set()
	protected throttledSendStatusToAll: () => void

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

	addSubscriber(ws: WebSocket): void {
		this._logger.info(`${this._name} adding a websocket subscriber`)
		this._subscribers.add(ws)
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

	sendMessage(recipients: WebSocket | Iterable<WebSocket>, msg: AllMessages): void {
		recipients = isIterable(recipients) ? recipients : [recipients]

		let count = 0
		let msgStr = ''
		for (const ws of recipients) {
			if (!msgStr) msgStr = JSON.stringify(msg) // Optimization: only stringify if there are any recipients
			count++
			ws.send(msgStr)
		}
		this._logger.silly(`Send ${this._name} message '${msgStr}' to ${count} recipients`)
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
