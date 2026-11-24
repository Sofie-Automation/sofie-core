import { render, act } from '@testing-library/react'
import { Tracker } from 'meteor/tracker'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { UserErrorMessage } from '@sofie-automation/corelib/dist/error'
import type { DBErrorLogItem } from '@sofie-automation/corelib/dist/dataModel/ErrorLog'
import type { ErrorLogItemId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ErrorLogToaster } from '../ErrorLogToaster.js'
import { useSubscription } from '../ReactMeteorData/ReactMeteorData.js'
import { NotificationCenter } from '../notifications/notifications.js'

// State shared with the mocks below (jest.mock factories may only reference variables prefixed with `mock`)
const mockErrorLog: { docs: DBErrorLogItem[]; dependency: Tracker.Dependency | undefined } = {
	docs: [],
	dependency: undefined,
}
const mockShownNotificationIds: string[] = []

// The mock Mongo collections are not reactive, so use a minimal reactive ErrorLog collection instead
jest.mock('../../collections/index.js', () => ({
	ErrorLog: {
		find: () => ({
			fetch: () => {
				mockErrorLog.dependency?.depend()
				return [...mockErrorLog.docs]
			},
		}),
	},
}))

// Control when the subscription is ready
jest.mock('../ReactMeteorData/ReactMeteorData.js', () => ({
	useSubscription: jest.fn(),
}))

// Record notifications instead of showing them
jest.mock('../notifications/notifications.js', () => ({
	NoticeLevel: { CRITICAL: 1 },
	Notification: class {
		constructor(
			public id: string,
			public status: number,
			public message: unknown,
			public source: string
		) {}
	},
	NotificationCenter: {
		push: jest.fn((notification: { id: string }) => mockShownNotificationIds.push(notification.id)),
		getNotificationIDs: () => [...mockShownNotificationIds],
	},
}))

jest.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}))

function makeError(id: string, timestamp: number): DBErrorLogItem {
	return {
		_id: protectString<ErrorLogItemId>(id),
		timestamp,
		studioId: null,
		operation: 'worker.takeNextPart',
		userId: null,
		errorCode: 429,
		error: {
			key: UserErrorMessage.TakeRateLimit,
			message: { key: 'Ignoring TAKES that are too quick after eachother ({{duration}} ms)', args: { duration: 1000 } },
		},
	}
}

function setErrorLog(docs: DBErrorLogItem[]) {
	act(() => {
		mockErrorLog.docs = docs
		mockErrorLog.dependency?.changed()
	})
}

describe('ErrorLogToaster', () => {
	const push = NotificationCenter.push as jest.Mock
	const mockedUseSubscription = useSubscription as jest.Mock

	beforeEach(() => {
		push.mockClear()
		mockShownNotificationIds.length = 0
		mockErrorLog.docs = []
		mockErrorLog.dependency = new Tracker.Dependency()
		mockedUseSubscription.mockReturnValue(true)
	})

	test('does not notify about errors that existed before the subscription was ready', () => {
		setErrorLog([makeError('old1', 1), makeError('old2', 2)])

		render(<ErrorLogToaster />)

		expect(push).not.toHaveBeenCalled()
	})

	test('does not notify while the subscription is not ready', () => {
		mockedUseSubscription.mockReturnValue(false)
		render(<ErrorLogToaster />)

		setErrorLog([makeError('new1', 1)])

		expect(push).not.toHaveBeenCalled()
	})

	test('notifies once for each error added after the subscription was ready', () => {
		setErrorLog([makeError('old1', 1)])
		render(<ErrorLogToaster />)

		setErrorLog([makeError('old1', 1), makeError('new1', 2)])
		expect(push).toHaveBeenCalledTimes(1)
		expect(push.mock.calls[0][0].id).toBe('errorLog_new1')

		// A later change must not notify about the same error again
		setErrorLog([makeError('old1', 1), makeError('new1', 2), makeError('new2', 3)])
		expect(push).toHaveBeenCalledTimes(2)
		expect(push.mock.calls[1][0].id).toBe('errorLog_new2')
	})

	test('does not notify about an error that this client is already showing', () => {
		render(<ErrorLogToaster />)

		// The client which caused the error has already shown its own notification for it
		mockShownNotificationIds.push('errorLog_new1')

		setErrorLog([makeError('new1', 1)])

		expect(push).not.toHaveBeenCalled()
	})

	test('stops notifying after unmounting', () => {
		const { unmount } = render(<ErrorLogToaster />)
		unmount()

		setErrorLog([makeError('new1', 1)])

		expect(push).not.toHaveBeenCalled()
	})
})
