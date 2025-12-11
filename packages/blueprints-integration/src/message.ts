import { Time } from './common.js'

export interface IBlueprintExternalMessageQueueObj {
	/** If set, the message references an existing message (that is to be overrritten) */
	_id?: string

	/** Type of message */
	type: IBlueprintExternalMessageQueueType
	/**
	 * If set, the message won't be sent automatically.
	 * Contains the reason for why the message was queued and not sent.
	 */
	queueForLaterReason?: string
	/** Receiver details */
	receiver: any
	/** Messate details */
	message: any
	/** Retry sending message until this time */
	retryUntil?: Time
}
export enum IBlueprintExternalMessageQueueType {
	SLACK = 'slack',
	RABBIT_MQ = 'rabbitmq',
}

export interface ExternalMessageQueueObjSlack extends IBlueprintExternalMessageQueueObj {
	type: IBlueprintExternalMessageQueueType.SLACK
	/** Slack Webhook URL */
	receiver: string
	/** Message to send to Slack */
	message: string
}

export interface ExternalMessageQueueObjRabbitMQ extends IBlueprintExternalMessageQueueObj {
	type: IBlueprintExternalMessageQueueType.RABBIT_MQ
	receiver: {
		/** RabbitMQ host endpoint */
		host: string
		/** RabbitMQ topic */
		topic: string
	}
	message: {
		/** RabbitMQ routing key */
		routingKey: string
		/** Message to send */
		message: string
		/** Message headers to send */
		headers: { [key: string]: string }
	}
}
