import {
	PlaylistTimingType,
	ExternalMessageQueueObjSlack,
	IBlueprintExternalMessageQueueType,
} from '@sofie-automation/blueprints-integration'
import { DBRundown, Rundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { MockJobContext, setupDefaultJobEnvironment } from '../../__mocks__/context.js'
import { getCurrentTime } from '../../lib/index.js'
import { queueExternalMessages } from '../handle.js'
import { setupMockShowStyleCompound } from '../../__mocks__/presetCollections.js'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { getRandomId, omit } from '@sofie-automation/corelib/dist/lib'
import { ExternalMessageQueueRunner } from '../ExternalMessageQueue.js'
import { InvalidateWorkerDataCache, WorkerDataCacheWrapper } from '../../workers/caches.js'
import { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ReadonlyObjectDeep } from 'type-fest/source/readonly-deep'
import { StudioCacheContext } from '../../jobs/index.js'
import { defer, MockMongoCollection } from '../../__mocks__/collection.js'
import { ExternalMessageQueueObj } from '@sofie-automation/corelib/dist/dataModel/ExternalMessageQueue'
import { sendSlackMessageToWebhook } from '../integration/slack.js'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'

describe('Test external message queue static methods', () => {
	let context: MockJobContext
	let rundown: Rundown
	let playlist: DBRundownPlaylist
	beforeAll(async () => {
		context = setupDefaultJobEnvironment()

		const showStyle = await setupMockShowStyleCompound(context)

		const now = getCurrentTime()
		await context.mockCollections.RundownPlaylists.insertOne({
			_id: protectString('playlist_1'),
			externalId: 'mock_rpl',
			name: 'Mock',
			studioId: protectString(''),
			created: 0,
			modified: 0,
			currentPartInfo: {
				partInstanceId: protectString('part_now'),
				rundownId: protectString('rundown_1'),
				manuallySelected: false,
				consumesQueuedSegmentId: false,
			},
			nextPartInfo: {
				partInstanceId: protectString('partNext'),
				rundownId: protectString('rundown_1'),
				manuallySelected: false,
				consumesQueuedSegmentId: false,
			},
			previousPartInfo: null,
			activationId: protectString('active'),
			timing: {
				type: PlaylistTimingType.None,
			},
			rundownIdsInOrder: [protectString('rundown_1')],
		})
		await context.mockCollections.Rundowns.insertOne({
			_id: protectString('rundown_1'),
			name: 'Mockito 1',
			externalId: 'mockito',
			playlistId: protectString('playlist_1'),

			studioId: context.studio._id,
			showStyleVariantId: showStyle.showStyleVariantId,
			showStyleBaseId: showStyle._id,
			created: now,
			modified: now,
			importVersions: {
				studio: 'wibble',
				showStyleBase: 'wobble',
				showStyleVariant: 'jelly',
				blueprint: 'on',
				core: 'plate',
			},
			timing: {
				type: PlaylistTimingType.None,
			},
			source: {
				type: 'http',
				// nrcsName: 'mockNRCS',
			},
		})
		rundown = (await context.mockCollections.Rundowns.findOne()) as Rundown
		playlist = (await context.mockCollections.RundownPlaylists.findOne(rundown.playlistId)) as DBRundownPlaylist
	})

	test('add a slack-type message', async () => {
		// setLogLevel(LogLevel.DEBUG)

		await expect(context.mockCollections.ExternalMessageQueue.findOne()).resolves.toBeFalsy()

		const slackMessage: ExternalMessageQueueObjSlack = {
			type: IBlueprintExternalMessageQueueType.SLACK,
			receiver: 'fred',
			message: 'whats up doc?',
		}
		expect(rundown).toBeTruthy()
		await queueExternalMessages(context.mockCollections.ExternalMessageQueue, rundown, playlist, [slackMessage])

		const messages = await context.mockCollections.ExternalMessageQueue.findFetch()
		expect(messages).toHaveLength(1)
		const message = messages[0]
		expect(message).toBeTruthy()
		expect(message).toMatchObject({
			type: 'slack',
			receiver: slackMessage.receiver,
			tryCount: 0,
			studioId: rundown.studioId,
			rundownId: rundown._id,
		})
		expect(message.expires).toBeGreaterThan(getCurrentTime())
	})
})

class MockDataCacheWrapper implements WorkerDataCacheWrapper {
	#context: MockJobContext

	constructor(context: MockJobContext) {
		this.#context = context
	}

	// #pendingCacheInvalidations: InvalidateWorkerDataCache | undefined
	get studioId(): StudioId {
		return this.#context.studioId
	}
	invalidateCaches(_data: ReadonlyObjectDeep<InvalidateWorkerDataCache>): void {
		// Ignore for now
	}
	async processInvalidations(): Promise<void> {
		// Ignore for now
	}
	createStudioCacheContext(): StudioCacheContext {
		return this.#context
	}
}

describe('Test sending messages to mocked endpoints', () => {
	jest.useFakeTimers()

	async function setupEnvironment() {
		const context = setupDefaultJobEnvironment()

		// // This isn't written to the db by default
		// await context.mockCollections.Studios.insertOne(context.studio)

		const showStyle = await setupMockShowStyleCompound(context)

		const now = getCurrentTime()

		const rundownId = await context.mockCollections.Rundowns.insertOne({
			_id: protectString('rundown_1'),
			name: 'Mockito 1',
			externalId: 'mockito',
			playlistId: protectString('playlist_1'),

			studioId: context.studio._id,
			showStyleVariantId: showStyle.showStyleVariantId,
			showStyleBaseId: showStyle._id,
			created: now,
			modified: now,
			importVersions: {
				studio: 'wibble',
				showStyleBase: 'wobble',
				showStyleVariant: 'jelly',
				blueprint: 'on',
				core: 'plate',
			},
			timing: {
				type: PlaylistTimingType.None,
			},
			source: {
				type: 'http',
				// nrcsName: 'mockNRCS',
			},
		})
		await context.mockCollections.RundownPlaylists.insertOne({
			_id: protectString('playlist_1'),
			externalId: 'mock_rpl',
			name: 'Mock',
			studioId: protectString(''),
			created: 0,
			modified: 0,
			currentPartInfo: {
				partInstanceId: protectString('part_now'),
				rundownId: rundownId,
				manuallySelected: false,
				consumesQueuedSegmentId: false,
			},
			nextPartInfo: {
				partInstanceId: protectString('partNext'),
				rundownId: rundownId,
				manuallySelected: false,
				consumesQueuedSegmentId: false,
			},
			previousPartInfo: null,
			activationId: protectString('active'),
			timing: {
				type: PlaylistTimingType.None,
			},
			rundownIdsInOrder: [protectString('rundown_1')],
		})

		const rundown = (await context.mockCollections.Rundowns.findOne(rundownId)) as DBRundown
		expect(rundown).toBeTruthy()

		// Allow watchers on the collection
		const mockMessageCollection = MockMongoCollection.fromReal<ExternalMessageQueueObj>(
			context.mockCollections.ExternalMessageQueue
		)
		mockMessageCollection.allowWatchers = true

		const mockDataCache = new MockDataCacheWrapper(context)
		const runner = await ExternalMessageQueueRunner.create(context.directCollections, mockDataCache)

		try {
			expect(mockMessageCollection.watchers).toHaveLength(1)
		} catch (e) {
			// Make sure we don't leak the runner
			await runner.destroy()
			throw e
		}
		const watcher = mockMessageCollection.watchers[0]

		// Skip over the startup execution
		await defer()
		jest.advanceTimersByTime(60000)
		await defer()

		return { context, rundown, runner, mockMessageCollection, watcher }
	}

	test('send a slack-type message', async () => {
		const { context, rundown, runner, mockMessageCollection, watcher } = await setupEnvironment()

		try {
			// setLogLevel(LogLevel.DEBUG)
			await expect(context.mockCollections.ExternalMessageQueue.findOne()).resolves.toBeFalsy()

			const slackMessage: ExternalMessageQueueObjSlack = {
				type: IBlueprintExternalMessageQueueType.SLACK,
				receiver: 'fred',
				message: 'whats up doc?',
			}
			expect(rundown).toBeTruthy()

			const msg: ExternalMessageQueueObj = {
				_id: getRandomId(),
				studioId: context.studio._id,
				expires: getCurrentTime() + 3600 + 60000,
				created: getCurrentTime(),
				tryCount: 0,
				...omit(slackMessage, '_id'),
			}
			await context.mockCollections.ExternalMessageQueue.insertOne(msg)

			await expect(context.mockCollections.ExternalMessageQueue.findOne()).resolves.toBeTruthy()
			mockMessageCollection.clearOpLog()

			// It shouldn't fire by itself just yet
			await defer()
			jest.advanceTimersByTime(60000)
			await defer()
			expect(sendSlackMessageToWebhook).toHaveBeenCalledTimes(0)

			// Inform the watcher of the change
			watcher.emit('change', {
				_id: msg._id,
				operationType: 'insert',
				ns: {
					db: 'sofie',
					coll: CollectionName.ExternalMessageQueue,
				},
				documentKey: {
					_id: msg._id,
				},
				fullDocument: msg,
				collectionUUID: null as any,
			})

			// Run the queue
			await defer()
			jest.advanceTimersByTime(1000)
			const sendTime = getCurrentTime()
			await defer()
			jest.advanceTimersByTime(500)
			const replyTime = getCurrentTime()
			await defer()

			// Make sure it looks correct
			expect(sendSlackMessageToWebhook).toHaveBeenCalledTimes(1)
			expect(mockMessageCollection.operations).toHaveLength(3)
			expect(mockMessageCollection.operations[0].type).toBe('findFetch')
			expect(mockMessageCollection.operations.slice(1)).toStrictEqual([
				{
					args: [
						msg._id,
						{
							$set: {
								lastTry: sendTime,
								manualRetry: false,
								tryCount: 1,
							},
						},
					],
					type: 'update',
				},
				{
					args: [
						msg._id,
						{
							$set: {
								sent: replyTime,
								sentReply: 'whats up doc?',
							},
						},
					],
					type: 'update',
				},
			])
			mockMessageCollection.clearOpLog()
		} finally {
			await runner.destroy()
		}
	})
	/* eslint-disable jest/no-commented-out-tests */
	/*
	describe('failing to send a message and retrying', () => {
		let message: ExternalMessageQueueObj

		afterAll(() => {
			if (!message) return
			Meteor.call(ExternalMessageQueueAPIMethods.remove, message._id)
			expect(ExternalMessageQueue.findOne()).toBeFalsy()
		})

		test('fail to send a slack-type message', async () => {
			// setLogLevel(LogLevel.DEBUG)
			expect(ExternalMessageQueue.findOne()).toBeFalsy()

			const slackMessage: ExternalMessageQueueObjSlack = {
				type: IBlueprintExternalMessageQueueType.SLACK,
				receiver: 'fred',
				message: 'whats error doc?',
				retryUntil: getCurrentTime() + 1000000,
			}
			expect(rundown).toBeTruthy()
			const sendTime = getCurrentTime()
			queueExternalMessages(rundown, [slackMessage])

			expect(ExternalMessageQueue.findOne()).toBeTruthy()
			await runAllTimers()

			expect(sendSlackMessageToWebhook).toHaveBeenCalledTimes(2)
			try {
				await (sendSlackMessageToWebhook as jest.Mock).mock.results[1].value
				fail('promise should reject')
			} catch (e) {
				expect(e.message).toBe('[500] Failed to send slack message')
			}

			message = ExternalMessageQueue.findOne() as ExternalMessageQueueObj
			expect(message).toBeTruthy()
			expect(message.errorMessage).toBe('Failed to send slack message')
			expect(message.errorMessageTime).toBeGreaterThanOrEqual(sendTime)
			expect(message.lastTry).toBeGreaterThanOrEqual(sendTime)
			expect(message.tryCount).toBe(1)
			expect(message.sent).toBeUndefined()
		})

		test('does not try to send again immediately', async () => {
			// setLogLevel(LogLevel.DEBUG)
			await runAllTimers()
			// Does not try to send again yet ... too close to lastTry
			expect(sendSlackMessageToWebhook).toHaveBeenCalledTimes(2)
		})

		test('after a minute, tries to resend', async () => {
			// setLogLevel(LogLevel.DEBUG)
			// Reset the last try clock
			const sendTime = getCurrentTime()
			ExternalMessageQueue.update(message._id, {
				$set: {
					lastTry: message.lastTry ? message.lastTry - 1.2 * 60 * 1000 : 0,
				},
			})
			await runAllTimers()
			expect(sendSlackMessageToWebhook).toHaveBeenCalledTimes(3)

			message = ExternalMessageQueue.findOne() as ExternalMessageQueueObj
			expect(message).toBeTruthy()
			expect(message.errorMessage).toBe('Failed to send slack message')
			expect(message.errorMessageTime).toBeGreaterThanOrEqual(sendTime)
			expect(message.lastTry).toBeGreaterThanOrEqual(sendTime)
			expect(message.tryCount).toBe(2)
			expect(message.sent).toBeUndefined()
		})

		test('does not retry to send if on hold', async () => {
			// setLogLevel(LogLevel.DEBUG)

			Meteor.call(ExternalMessageQueueAPIMethods.toggleHold, message._id)
			message = ExternalMessageQueue.findOne() as ExternalMessageQueueObj
			expect(message).toBeTruthy()
			expect(message.hold).toBe(true)

			ExternalMessageQueue.update(message._id, {
				$set: {
					lastTry: message.lastTry ? message.lastTry - 1.2 * 60 * 1000 : 0,
				},
			})
			await runAllTimers()
			expect(sendSlackMessageToWebhook).toHaveBeenCalledTimes(3)

			Meteor.call(ExternalMessageQueueAPIMethods.toggleHold, message._id)
			message = ExternalMessageQueue.findOne() as ExternalMessageQueueObj
			expect(message).toBeTruthy()
			expect(message.hold).toBe(false)
		})

		test('does not retry after retryUntil time', async () => {
			// setLogLevel(LogLevel.DEBUG)

			ExternalMessageQueue.update(message._id, {
				$set: {
					lastTry: message.lastTry ? message.lastTry - 1.2 * 60 * 1000 : 0,
					retryUntil: getCurrentTime() - 10,
				},
			})
			await runAllTimers()
			expect(sendSlackMessageToWebhook).toHaveBeenCalledTimes(3)
		})

		test('can be forced to retry manually once', async () => {
			// setLogLevel(LogLevel.DEBUG)

			Meteor.call(ExternalMessageQueueAPIMethods.toggleHold, message._id)
			message = ExternalMessageQueue.findOne() as ExternalMessageQueueObj
			expect(message).toBeTruthy()
			expect(message.hold).toBe(true)
			expect(message.retryUntil).toBeLessThan(getCurrentTime())
			expect(message.manualRetry).toBe(false)

			Meteor.call(ExternalMessageQueueAPIMethods.retry, message._id)

			message = ExternalMessageQueue.findOne() as ExternalMessageQueueObj
			await runAllTimers()
			expect(sendSlackMessageToWebhook).toHaveBeenCalledTimes(4)

			message = ExternalMessageQueue.findOne() as ExternalMessageQueueObj
			expect(message).toBeTruthy()
			expect(message.hold).toBe(false) // expected to take message off hold
			expect(message.manualRetry).toBe(false)
			expect(message.tryCount).toBe(3)
			expect(message.sent).toBeUndefined()
		})
	})

	test('send a soap-type message', async () => {
		// setLogLevel(LogLevel.DEBUG)
		expect(
			ExternalMessageQueue.findOne({
				type: IBlueprintExternalMessageQueueType.SOAP,
			})
		).toBeFalsy()
		expect(sendSOAPMessage).toHaveBeenCalledTimes(0)

		const soapMessage: ExternalMessageQueueObjSOAP = {
			type: IBlueprintExternalMessageQueueType.SOAP,
			receiver: { url: 'http://clean.me/with/soap' },
			message: {
				fcn: 'CallMeMaybe',
				clip_key: {},
				clip: {},
			},
		}
		expect(rundown).toBeTruthy()
		const sendTime = getCurrentTime()
		queueExternalMessages(rundown, [soapMessage])

		expect(
			ExternalMessageQueue.findOne({
				type: IBlueprintExternalMessageQueueType.SOAP,
			})
		).toBeTruthy()
		await runAllTimers()
		expect(sendSOAPMessage).toHaveBeenCalledTimes(1)
		await (sendSOAPMessage as jest.Mock).mock.results[0].value
		let message = ExternalMessageQueue.findOne() as ExternalMessageQueueObj
		expect(message).toBeTruthy()
		expect(message.sent).toBeGreaterThanOrEqual(sendTime)
		expect(message.sentReply).toBeUndefined()
		expect(message.tryCount).toBe(1)
		Meteor.call(ExternalMessageQueueAPIMethods.remove, message._id)

		expect(
			ExternalMessageQueue.findOne({
				type: IBlueprintExternalMessageQueueType.SOAP,
			})
		).toBeFalsy()
	})

	test('fail to send a soap message', async () => {
		// setLogLevel(LogLevel.DEBUG)
		expect(ExternalMessageQueue.findOne()).toBeFalsy()

		const soapMessage: ExternalMessageQueueObjSOAP = {
			type: IBlueprintExternalMessageQueueType.SOAP,
			receiver: { url: 'http://clean.me/with/soap' },
			message: {
				fcn: 'CallMeMaybe error',
				clip_key: {},
				clip: {},
			},
		}
		expect(rundown).toBeTruthy()
		const sendTime = getCurrentTime()
		queueExternalMessages(rundown, [soapMessage])

		expect(ExternalMessageQueue.findOne()).toBeTruthy()
		await runAllTimers()

		expect(sendSOAPMessage).toHaveBeenCalledTimes(2)
		try {
			await (sendSOAPMessage as jest.Mock).mock.results[1].value
			fail('promise should reject')
		} catch (e) {
			expect(e.message).toBe('[500] Failed to send SOAP message')
		}

		let message = ExternalMessageQueue.findOne() as ExternalMessageQueueObj
		expect(message).toBeTruthy()
		expect(message.errorMessage).toBe('Failed to send SOAP message')
		expect(message.errorMessageTime).toBeGreaterThanOrEqual(sendTime)
		expect(message.lastTry).toBeGreaterThanOrEqual(sendTime)
		expect(message.tryCount).toBe(1)
		expect(message.sent).toBeUndefined()

		// Retry behavior tested for slack messages

		Meteor.call(ExternalMessageQueueAPIMethods.remove, message._id)
		expect(ExternalMessageQueue.findOne()).toBeFalsy()
	})

	test('fatal error when sending a soap-type message', async () => {
		// setLogLevel(LogLevel.DEBUG)
		expect(ExternalMessageQueue.findOne()).toBeFalsy()

		const soapMessage: ExternalMessageQueueObjSOAP = {
			type: IBlueprintExternalMessageQueueType.SOAP,
			receiver: { url: 'http://clean.me/with/soap' },
			message: {
				fcn: 'CallMeMaybe fatal',
				clip_key: {},
				clip: {},
			},
		}
		expect(rundown).toBeTruthy()
		const sendTime = getCurrentTime()
		queueExternalMessages(rundown, [soapMessage])

		expect(ExternalMessageQueue.findOne()).toBeTruthy()
		await runAllTimers()

		expect(sendSOAPMessage).toHaveBeenCalledTimes(3)
		try {
			await (sendSOAPMessage as jest.Mock).mock.results[2].value
			fail('promise should reject')
		} catch (e) {
			expect(e.message).toBe('[401] Fatal error sending SOAP message.')
		}

		let message = ExternalMessageQueue.findOne() as ExternalMessageQueueObj
		expect(message).toBeTruthy()
		expect(message.errorMessage).toBe('Fatal error sending SOAP message.')
		expect(message.errorMessageTime).toBeGreaterThanOrEqual(sendTime)
		expect(message.errorFatal).toBe(true)
		expect(message.lastTry).toBeGreaterThanOrEqual(sendTime)
		expect(message.tryCount).toBe(1)
		expect(message.sent).toBeUndefined()

		// Reset the last try clock
		ExternalMessageQueue.update(message._id, {
			$set: {
				lastTry: message.lastTry ? message.lastTry - 1.2 * 60 * 1000 : 0,
			},
		})
		await runAllTimers()
		// Does not send again - error is fatal
		expect(sendSOAPMessage).toHaveBeenCalledTimes(3)

		Meteor.call(ExternalMessageQueueAPIMethods.remove, message._id)
		expect(ExternalMessageQueue.findOne()).toBeFalsy()
	})

	test('send a rabbit MQ-type message', async () => {
		// setLogLevel(LogLevel.DEBUG)
		expect(ExternalMessageQueue.findOne()).toBeFalsy()

		const rabbitMessage: ExternalMessageQueueObjRabbitMQ = {
			type: IBlueprintExternalMessageQueueType.RABBIT_MQ,
			receiver: {
				host: 'roger',
				topic: 'the rabbit',
			},
			message: {
				routingKey: 'toMyDoor',
				message: "what's up doc?",
				headers: {},
			},
		}
		expect(rundown).toBeTruthy()
		const sendTime = getCurrentTime()
		queueExternalMessages(rundown, [rabbitMessage])

		expect(ExternalMessageQueue.findOne()).toBeTruthy()
		await runAllTimers()

		expect(sendRabbitMQMessage).toHaveBeenCalledTimes(1)
		await (sendRabbitMQMessage as jest.Mock).mock.results[0].value
		let message = ExternalMessageQueue.findOne() as ExternalMessageQueueObj
		expect(message).toBeTruthy()
		expect(message.sent).toBeGreaterThanOrEqual(sendTime)
		expect(message.sent).toBeGreaterThanOrEqual(sendTime)
		expect(message.sentReply).toBeUndefined()
		expect(message.tryCount).toBe(1)

		Meteor.call(ExternalMessageQueueAPIMethods.remove, message._id)

		expect(ExternalMessageQueue.findOne()).toBeFalsy()
	})

	test('fail to send a rabbitMQ-type message', async () => {
		// setLogLevel(LogLevel.DEBUG)
		expect(ExternalMessageQueue.findOne()).toBeFalsy()

		const rabbitMessage: ExternalMessageQueueObjRabbitMQ = {
			type: IBlueprintExternalMessageQueueType.RABBIT_MQ,
			receiver: {
				host: 'roger',
				topic: 'the rabbit',
			},
			message: {
				routingKey: 'toMyDoor',
				message: "what's error doc?",
				headers: {},
			},
		}
		expect(rundown).toBeTruthy()
		const sendTime = getCurrentTime()
		queueExternalMessages(rundown, [rabbitMessage])

		expect(ExternalMessageQueue.findOne()).toBeTruthy()
		await runAllTimers()

		expect(sendRabbitMQMessage).toHaveBeenCalledTimes(2)
		try {
			await (sendRabbitMQMessage as jest.Mock).mock.results[1].value
			fail('promise should reject')
		} catch (e) {
			expect(e.message).toBe('[500] Failed to send slack rabbitMQ message')
		}

		let message = ExternalMessageQueue.findOne() as ExternalMessageQueueObj
		expect(message).toBeTruthy()
		expect(message.errorMessage).toBe('Failed to send slack rabbitMQ message')
		expect(message.errorMessageTime).toBeGreaterThanOrEqual(sendTime)
		expect(message.lastTry).toBeGreaterThanOrEqual(sendTime)
		expect(message.tryCount).toBe(1)
		expect(message.sent).toBeUndefined()

		// Retry behavior tested for slack messages

		Meteor.call(ExternalMessageQueueAPIMethods.remove, message._id)
		expect(ExternalMessageQueue.findOne()).toBeFalsy()
	})

	test('does not send expired messages', async () => {
		// setLogLevel(LogLevel.DEBUG)
		expect(ExternalMessageQueue.findOne()).toBeFalsy()

		const slackMessage: ExternalMessageQueueObjSlack = {
			type: IBlueprintExternalMessageQueueType.SLACK,
			receiver: 'fred',
			message: "what's up doc?",
		}
		expect(rundown).toBeTruthy()
		const sendTime = getCurrentTime()
		queueExternalMessages(rundown, [slackMessage])

		let message = ExternalMessageQueue.findOne() as ExternalMessageQueueObj
		expect(message).toBeTruthy()
		expect(message.expires).toBeGreaterThan(getCurrentTime())

		ExternalMessageQueue.update(message._id, {
			$set: {
				expires: getCurrentTime() - 365 * 24 * 3600 * 1000,
			},
		}) // so last year!
		message = ExternalMessageQueue.findOne() as ExternalMessageQueueObj
		expect(message).toBeTruthy()
		expect(message.expires).toBeLessThan(getCurrentTime())

		await runAllTimers()

		expect(sendSlackMessageToWebhook).toHaveBeenCalledTimes(4) // i.e. not called again

		Meteor.call(ExternalMessageQueueAPIMethods.remove, message._id)
		expect(ExternalMessageQueue.findOne()).toBeFalsy()
	})
	*/
	/* eslint-enable jest/no-commented-out-tests */
})
