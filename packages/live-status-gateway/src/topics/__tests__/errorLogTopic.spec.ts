import { protectString } from '@sofie-automation/server-core-integration'
import { UserErrorMessage } from '@sofie-automation/corelib/dist/error'
import { DBErrorLogItem } from '@sofie-automation/corelib/dist/dataModel/ErrorLog'
import { ErrorLogEvent } from '@sofie-automation/live-status-gateway-api'
import { makeMockHandlers, makeMockLogger, makeMockSubscriber } from './utils.js'
import { ErrorLogTopic } from '../errorLogTopic.js'

describe('ErrorLogTopic', () => {
	it('sends the errors to a new subscriber, newest first', () => {
		const handlers = makeMockHandlers()
		const topic = new ErrorLogTopic(makeMockLogger(), handlers)
		const mockSubscriber = makeMockSubscriber()

		handlers.errorLogHandler.notify(makeTestErrors())

		topic.addSubscriber(mockSubscriber)

		const expectedStatus: ErrorLogEvent = {
			event: 'errorLog',
			errors: [
				{
					id: 'ERROR_1',
					timestamp: 2000,
					studioId: 'STUDIO_1',
					operation: 'ingest.updateRundown',
					errorCode: 500,
					errorKey: UserErrorMessage.InternalError,
					message: 'Internal Error',
				},
				{
					id: 'ERROR_0',
					timestamp: 1000,
					studioId: 'STUDIO_1',
					playlistId: 'PLAYLIST_1',
					operation: 'worker.takeNextPart',
					context: 'click: button#take',
					errorCode: 429,
					errorKey: UserErrorMessage.TakeRateLimit,
					message: 'Ignoring TAKES that are too quick after eachother (1000 ms)',
				},
			],
		}

		// eslint-disable-next-line @typescript-eslint/unbound-method
		expect(mockSubscriber.send).toHaveBeenCalledTimes(1)
		expect(JSON.parse(mockSubscriber.send.mock.calls[0][0] as string)).toEqual(expectedStatus)
	})

	it('sends an empty list when there are no errors', () => {
		const handlers = makeMockHandlers()
		const topic = new ErrorLogTopic(makeMockLogger(), handlers)
		const mockSubscriber = makeMockSubscriber()

		handlers.errorLogHandler.notify(undefined)

		topic.addSubscriber(mockSubscriber)

		// eslint-disable-next-line @typescript-eslint/unbound-method
		expect(mockSubscriber.send).toHaveBeenCalledTimes(1)
		expect(JSON.parse(mockSubscriber.send.mock.calls[0][0] as string)).toEqual({ event: 'errorLog', errors: [] })
	})
})

function makeTestErrors(): DBErrorLogItem[] {
	return [
		{
			_id: protectString('ERROR_0'),
			timestamp: 1000,
			studioId: protectString('STUDIO_1'),
			playlistId: protectString('PLAYLIST_1'),
			operation: 'worker.takeNextPart',
			context: 'click: button#take',
			userId: null,
			userActionsLogId: protectString('USER_ACTION_0'),
			errorCode: 429,
			error: {
				key: UserErrorMessage.TakeRateLimit,
				message: {
					key: 'Ignoring TAKES that are too quick after eachother ({{duration}} ms)',
					args: { duration: 1000 },
				},
			},
		},
		{
			_id: protectString('ERROR_1'),
			timestamp: 2000,
			studioId: protectString('STUDIO_1'),
			operation: 'ingest.updateRundown',
			userId: null,
			errorCode: 500,
			error: {
				key: UserErrorMessage.InternalError,
				message: { key: 'Internal Error' },
			},
		},
	]
}
