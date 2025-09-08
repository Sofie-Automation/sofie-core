import { Logger } from 'winston'
import { WebSocket } from 'ws'
import { literal } from '@sofie-automation/shared-lib/dist/lib/lib'
import { WebSocketTopicBase, WebSocketTopic } from '../wsHandler.js'
import {
	PongEvent,
	SubscriptionStatusSuccess,
	SubscriptionStatusError,
	SubscriptionDetails,
	SubscriptionStatus,
	SubscriptionName,
} from '@sofie-automation/live-status-gateway-api'

enum PublishMsg {
	ping = 'ping',
	subscribe = 'subscribe',
	unsubscribe = 'unsubscribe',
}

interface RootMsg {
	event: PublishMsg
	reqid: number
	subscription: {
		name: SubscriptionName
	}
}

export class RootChannel extends WebSocketTopicBase implements WebSocketTopic {
	_topics: Map<string, WebSocketTopic> = new Map()
	_heartbeat: NodeJS.Timeout | undefined

	constructor(logger: Logger) {
		super('Root', logger)
		this._heartbeat = setInterval(() => this.sendHeartbeat(this._subscribers), 2000)
	}

	close(): void {
		clearInterval(this._heartbeat)
	}

	removeSubscriber(ws: WebSocket): void {
		super.removeSubscriber(ws)
		this._topics.forEach((h) => h.removeSubscriber(ws))
	}

	processMessage(ws: WebSocket, msg: object): void {
		// eslint-disable-next-line @typescript-eslint/no-base-to-string
		this._logger.info(`Process root message '${msg}'`)
		try {
			const msgObj = JSON.parse(msg as unknown as string) as RootMsg
			if (typeof msgObj.event === 'string' && typeof msgObj.reqid === 'number') {
				switch (msgObj.event) {
					case PublishMsg.ping:
						this.sendMessage(ws, literal<PongEvent>({ event: 'pong', reqid: msgObj.reqid }))
						return
					case PublishMsg.subscribe:
						this._logger.info(`Subscribe request to '${msgObj.subscription.name}' channel`)
						this.subscribe(ws, msgObj.subscription.name, msgObj.reqid)
						return
					case PublishMsg.unsubscribe:
						this._logger.info(`Unsubscribe request to '${msgObj.subscription.name}' channel`)
						this.unsubscribe(ws, msgObj.subscription.name, msgObj.reqid)
						return
					default:
						this._logger.info(`Process root message received unexpected event`)
				}
			} else this._logger.error(`Process root message received malformed payload`)
		} catch (_e) {
			this._logger.error(`Process root message expected an object as payload`)
		}
	}

	addTopic(channel: string, topic: WebSocketTopic): void {
		if (Object.values<string>(SubscriptionName).includes(channel)) this._topics.set(channel, topic)
	}

	subscribe(ws: WebSocket, name: SubscriptionName, reqid: number): void {
		const topic = this._topics.get(name)
		const curUnsubscribed =
			topic && !topic.hasSubscriber(ws) && Object.values<string>(SubscriptionName).includes(name)
		if (curUnsubscribed) {
			this.sendMessage(
				ws,
				literal<SubscriptionStatusSuccess>({
					event: 'subscriptionStatus',
					reqid: reqid,
					subscription: literal<SubscriptionDetails>({
						name: name,
						status: SubscriptionStatus.SUBSCRIBED,
					}),
				})
			)
			topic.addSubscriber(ws)
		} else {
			this.sendMessage(
				ws,
				literal<SubscriptionStatusError>({
					errorMessage: `Subscribe to '${name}' topic failed`,
					event: 'subscriptionStatus',
					reqid: reqid,
					subscription: literal<SubscriptionDetails>({
						name: name,
						status: curUnsubscribed ? SubscriptionStatus.UNSUBSCRIBED : SubscriptionStatus.SUBSCRIBED,
					}),
				})
			)
		}
	}

	unsubscribe(ws: WebSocket, name: SubscriptionName, reqid: number): void {
		const topic = this._topics.get(name)
		const curSubscribed = topic && topic.hasSubscriber(ws) && Object.values<string>(SubscriptionName).includes(name)
		if (curSubscribed) {
			topic.removeSubscriber(ws)
			this.sendMessage(
				ws,
				literal<SubscriptionStatusSuccess>({
					event: 'subscriptionStatus',
					reqid: reqid,
					subscription: literal<SubscriptionDetails>({
						name: name,
						status: SubscriptionStatus.UNSUBSCRIBED,
					}),
				})
			)
		} else {
			this.sendMessage(
				ws,
				literal<SubscriptionStatusError>({
					errorMessage: `Unsubscribe from '${name}' topic failed`,
					event: 'subscriptionStatus',
					reqid: reqid,
					subscription: literal<SubscriptionDetails>({
						name: name,
						status: curSubscribed ? SubscriptionStatus.SUBSCRIBED : SubscriptionStatus.UNSUBSCRIBED,
					}),
				})
			)
		}
	}

	sendStatus(): void {
		// no status here
	}
}
