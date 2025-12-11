import _ from 'underscore'
import * as AMQP from 'amqplib'
import { logger } from '../../logging.js'
import { ExternalMessageQueueObjRabbitMQ } from '@sofie-automation/blueprints-integration'
import { ExternalMessageQueueObjId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { FatalExternalMessageError } from '../ExternalMessageQueue.js'
import { ExternalMessageQueueObj } from '@sofie-automation/corelib/dist/dataModel/ExternalMessageQueue'
import { retrieveBlueprintConfigRefs } from '../../blueprints/config.js'
import { StudioCacheContext } from '../../jobs/index.js'

interface Message {
	_id: ExternalMessageQueueObjId
	exchangeTopic: string
	routingKey: string
	headers: { [header: string]: string } | undefined
	message: string
	promise: PromiseWithResolvers<void>
}
abstract class Manager {
	protected open = false
	/** How many errors the connection has emitted */
	protected errorCount = 0
	/* If true, the connection needs to be restarted */
	protected fatalError = false

	private initializing?: Promise<void>

	protected resetProps() {
		this.open = false
		this.errorCount = 0
		this.fatalError = false
	}

	public async prepare() {
		if (this.initializing) {
			await this.initializing
		} else if (this.needToInitialize()) {
			try {
				this.initializing = this.init()
				await this.initializing
			} finally {
				// make sure this doesn't hang around
				delete this.initializing
			}
		}
	}

	protected abstract init(): Promise<void>

	private needToInitialize() {
		return !this.open || this.fatalError || this.errorCount > 10
	}
}
class ConnectionManager extends Manager {
	private connection: AMQP.Connection | undefined
	public channelManager: ChannelManager | undefined

	/** https://www.rabbitmq.com/connection-blocked.html */
	protected blocked = false

	private hostURL: string

	constructor(hostURL: string) {
		super()

		this.hostURL = hostURL
	}

	protected async init() {
		super.resetProps()
		this.blocked = false

		if (this.connection) {
			this.connection.close().catch(() => null) // already closed connections will error
			delete this.connection
			delete this.channelManager
		}

		this.connection = await this.initConnection()
		this.channelManager = new ChannelManager(this.connection, this.hostURL)
	}

	private async initConnection(): Promise<AMQP.Connection> {
		try {
			const connection = await AMQP.connect(this.hostURL, {
				// socketOptions
				heartbeat: 0, // default
			})

			connection.on('error', (err) => {
				logger.warn(`AMQP connection to "${this.hostURL}" error`, err)
				this.errorCount++
			})
			connection.on('close', () => {
				this.open = false
				logger.warn(`AMQP connection to "${this.hostURL}" closed`)
			})
			connection.on('blocked', (reason) => {
				this.blocked = true
				logger.warn(`AMQP connection to "${this.hostURL}" blocked`, reason)
			})
			connection.on('unblocked', () => {
				this.blocked = false
				logger.warn(`AMQP connection to "${this.hostURL}" unblocked`)
			})
			this.open = true

			return connection
		} catch (err) {
			this.errorCount++
			this.fatalError = true

			logger.warn(`AMQP connection to "${this.hostURL}" failed to connect`, err)
			throw err instanceof Error ? err : new Error(stringifyError(err))
		}
	}
}
class ChannelManager extends Manager {
	private readonly connection: AMQP.Connection
	private readonly hostURL: string
	private channel: AMQP.ConfirmChannel | undefined

	private outgoingQueue: Array<Message> = []
	private handleOutgoingQueueTimeout: NodeJS.Timer | null = null

	constructor(connection: AMQP.Connection, hostURL: string) {
		super()

		this.connection = connection
		this.hostURL = hostURL
	}
	protected async init() {
		super.resetProps()

		if (this.channel) {
			await this.channel.close()
			delete this.channel
		}

		this.channel = await this.initChannel(this.connection)
	}
	private async initChannel(connection: AMQP.Connection): Promise<AMQP.ConfirmChannel> {
		try {
			const channel = await connection.createConfirmChannel()

			channel.on('error', (err) => {
				this.errorCount++
				logger.warn(`AMQP channel for "${this.hostURL}" errored`, err)
			})
			channel.on('close', () => {
				this.open = false
				logger.warn(`AMQP channel for "${this.hostURL}" closed`)
			})
			// When a "mandatory" message cannot be delivered, it's returned here:
			// channel.on('return', message => {
			// 	logger.warn('AMQP channel for "${this.hostURL}" message failed to send', message)
			// })
			channel.on('drain', () => {
				logger.debug(`AMQP channel for "${this.hostURL}" drained`)
				this.triggerHandleOutgoingQueue()
			})
			this.open = true

			return channel
		} catch (err) {
			this.fatalError = true
			this.errorCount++
			throw new Error('Error when creating AMQP channel ' + err)
		}
	}

	async sendMessage(
		exchangeTopic: string,
		routingKey: string,
		messageId: ExternalMessageQueueObjId,
		message: string,
		headers: { [headers: string]: string } | undefined
	): Promise<void> {
		if (!this.channel) throw new Error(`AMQP channel for "${this.hostURL}" is not initialised`)

		await this.channel.assertExchange(exchangeTopic, 'topic', { durable: true })

		const promise = Promise.withResolvers<void>()

		this.outgoingQueue.push({
			_id: messageId,
			exchangeTopic,
			routingKey,
			headers,
			message,
			promise,
		})

		setImmediate(() => {
			this.triggerHandleOutgoingQueue()
		})

		return promise.promise
	}

	private triggerHandleOutgoingQueue() {
		if (!this.handleOutgoingQueueTimeout) {
			this.handleOutgoingQueueTimeout = setTimeout(() => {
				try {
					this.handleOutgoingQueueTimeout = null
					this.handleOutgoingQueue()
				} catch (e) {
					logger.warn(`AMQP channel for "${this.hostURL}" errored in triggerHandleOutgoingQueue`, e)
					this.handleOutgoingQueueTimeout = null
					this.triggerHandleOutgoingQueue()
				}
			}, 100)
		}
	}
	private handleOutgoingQueue() {
		if (!this.channel) throw new Error(`AMQP channel for "${this.hostURL}" is not initialised`)

		const firstMessageInQueue: Message | undefined = this.outgoingQueue.shift()

		if (firstMessageInQueue) {
			const messageToSend: Message = firstMessageInQueue

			const sent = this.channel.publish(
				messageToSend.exchangeTopic,
				messageToSend.routingKey,
				Buffer.from(messageToSend.message),
				{
					// options
					headers: messageToSend.headers,
					messageId: unprotectString(messageToSend._id),
					persistent: true, // same thing as deliveryMode=2
				},
				(err, _ok) => {
					if (err) {
						messageToSend.promise.reject(err)
					} else {
						messageToSend.promise.resolve()
					}
					// Trigger handling the next message
					this.triggerHandleOutgoingQueue()
				}
			)
			if (!sent) {
				// The write buffer is full, we will try again on the 'drain' event

				// Put the message back on the queue:
				this.outgoingQueue.unshift(messageToSend)
			} else {
				logger.debug('AMQP: message sent, waiting for ok...')
			}
		}
	}
}

const connectionsCache: { [hostURL: string]: ConnectionManager } = {}
/**
 *
 * @param hostURL example: 'amqp://localhost'
 */
async function getChannelManager(hostURL: string): Promise<ChannelManager> {
	// Check if we have an existing connection in the cache:
	let connectionManager: ConnectionManager | undefined = connectionsCache[hostURL]

	if (!connectionManager) {
		connectionManager = new ConnectionManager(hostURL)
		connectionsCache[hostURL] = connectionManager
	}
	// Let the connectionManager set up the connection:
	await connectionManager.prepare()

	if (!connectionManager.channelManager) {
		throw new Error(`AMQP channel for "${hostURL}" failed to initialise`)
	}
	// Let the connectionManager set up the channel:
	await connectionManager.channelManager.prepare()

	return connectionManager.channelManager
}
export async function sendRabbitMQMessage(
	context: StudioCacheContext,
	msg0: ExternalMessageQueueObjRabbitMQ & ExternalMessageQueueObj
): Promise<void> {
	const msg: ExternalMessageQueueObjRabbitMQ = msg0 // for typings

	let hostURL: string = msg.receiver.host
	const exchangeTopic: string = msg.receiver.topic
	const routingKey: string = msg.message.routingKey
	let message: any = msg.message.message
	const headers: { [header: string]: string } = msg.message.headers

	if (!hostURL) throw new FatalExternalMessageError(`RabbitMQ: Message host not set`)
	if (!exchangeTopic) throw new FatalExternalMessageError(`RabbitMQ: Message topic not set`)
	if (!routingKey) throw new FatalExternalMessageError(`RabbitMQ: Message routing key not set`)
	if (!message) throw new FatalExternalMessageError(`RabbitMQ: Message message not set`)

	hostURL = await retrieveBlueprintConfigRefs(
		context,
		hostURL,
		(str) => {
			return encodeURIComponent(str)
		},
		true
	)

	const channelManager = await getChannelManager(hostURL)

	if (_.isObject(message)) message = JSON.stringify(message)

	await channelManager.sendMessage(exchangeTopic, routingKey, msg0._id, message, headers)
}
