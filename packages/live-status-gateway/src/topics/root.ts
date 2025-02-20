import { Logger } from 'winston'
import { WebSocket } from 'ws'
import { literal } from '@sofie-automation/shared-lib/dist/lib/lib'
import { WebSocketTopicBase, WebSocketTopic } from '../wsHandler'

enum PublishMsg {
	ping = 'ping',
	subscribe = 'subscribe',
	unsubscribe = 'unsubscribe',
}

interface PongMsg {
	event: string
	reqid: number
}

enum SubscriptionStatus {
	subscribed = 'subscribed',
	unsubscribed = 'unsubscribed',
}

interface SubscriptionDetails {
	name: string
	status: SubscriptionStatus
}

interface SubscriptionResponse {
	event: string
	reqid: number
	subscription: SubscriptionDetails
	errorMessage?: string
}

export enum StatusChannels {
	studio = 'studio',
	activePlaylist = 'activePlaylist',
	activePieces = 'activePieces',
	segments = 'segments',
	adLibs = 'adLibs',
	packages = 'packages',
	buckets = 'buckets',
}

interface RootMsg {
	event: PublishMsg
	reqid: number
	subscription: {
		name: StatusChannels
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
		this._logger.info(`Process root message '${msg}'`)
		try {
			const msgObj = JSON.parse(msg as unknown as string) as RootMsg
			if (typeof msgObj.event === 'string' && typeof msgObj.reqid === 'number') {
				switch (msgObj.event) {
					case PublishMsg.ping:
						this.sendMessage(ws, literal<PongMsg>({ event: 'pong', reqid: msgObj.reqid }))
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
		} catch (e) {
			this._logger.error(`Process root message expected an object as payload`)
		}
	}

	addTopic(channel: string, topic: WebSocketTopic): void {
		if (channel in StatusChannels) this._topics.set(channel, topic)
	}

	subscribe(ws: WebSocket, name: string, reqid: number): void {
		const topic = this._topics.get(name)
		const curUnsubscribed = topic && !topic.hasSubscriber(ws) && name in StatusChannels
		if (curUnsubscribed) {
			this.sendMessage(
				ws,
				literal<SubscriptionResponse>({
					event: 'subscriptionStatus',
					reqid: reqid,
					subscription: literal<SubscriptionDetails>({
						name: name,
						status: SubscriptionStatus.subscribed,
					}),
				})
			)
			topic.addSubscriber(ws)
		} else {
			this.sendMessage(
				ws,
				literal<SubscriptionResponse>({
					errorMessage: `Subscribe to '${name}' topic failed`,
					event: 'subscriptionStatus',
					reqid: reqid,
					subscription: literal<SubscriptionDetails>({
						name: name,
						status: curUnsubscribed ? SubscriptionStatus.unsubscribed : SubscriptionStatus.subscribed,
					}),
				})
			)
		}
	}

	unsubscribe(ws: WebSocket, name: string, reqid: number): void {
		const topic = this._topics.get(name)
		const curSubscribed = topic && topic.hasSubscriber(ws) && name in StatusChannels
		if (curSubscribed) {
			topic.removeSubscriber(ws)
			this.sendMessage(
				ws,
				literal<SubscriptionResponse>({
					event: 'subscriptionStatus',
					reqid: reqid,
					subscription: literal<SubscriptionDetails>({
						name: name,
						status: SubscriptionStatus.unsubscribed,
					}),
				})
			)
		} else {
			this.sendMessage(
				ws,
				literal<SubscriptionResponse>({
					errorMessage: `Unsubscribe from '${name}' topic failed`,
					event: 'subscriptionStatus',
					reqid: reqid,
					subscription: literal<SubscriptionDetails>({
						name: name,
						status: curSubscribed ? SubscriptionStatus.subscribed : SubscriptionStatus.unsubscribed,
					}),
				})
			)
		}
	}

	sendStatus(): void {
		// no status here
	}
}
