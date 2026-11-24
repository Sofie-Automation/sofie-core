import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { UserError, UserErrorMessage } from '@sofie-automation/corelib/dist/error'
import { ClientAPI } from '@sofie-automation/meteor-lib/dist/api/client'
import type { ErrorLogItemId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { errorLogNotificationId, getErrorLogNotificationId } from '../clientUserAction.js'

describe('errorLogNotificationId', () => {
	test('derives the notification id from the ErrorLog id', () => {
		// The local and the shared notification for an error must use the same id, so that they replace each other
		expect(errorLogNotificationId(protectString<ErrorLogItemId>('abc123'))).toBe('errorLog_abc123')
	})
})

describe('getErrorLogNotificationId', () => {
	function makeErrorResponse(errorLogId?: string): ClientAPI.ClientResponseError {
		const response = ClientAPI.responseError(UserError.create(UserErrorMessage.TakeRateLimit, { duration: 1000 }))
		if (errorLogId) response.errorLogId = protectString(errorLogId)
		return response
	}

	test('returns the same id as errorLogNotificationId for an error with an errorLogId', () => {
		const errorLogId = protectString<ErrorLogItemId>('abc123')
		expect(getErrorLogNotificationId(makeErrorResponse('abc123'))).toBe(errorLogNotificationId(errorLogId))
	})

	test('returns undefined for an error that was not recorded', () => {
		expect(getErrorLogNotificationId(makeErrorResponse())).toBeUndefined()
	})

	test('returns undefined for anything that is not an error response', () => {
		expect(getErrorLogNotificationId(ClientAPI.responseSuccess(undefined))).toBeUndefined()
		expect(getErrorLogNotificationId({ errorLogId: 'abc123' })).toBeUndefined()
		expect(getErrorLogNotificationId(undefined)).toBeUndefined()
		expect(getErrorLogNotificationId(new Error('abc123'))).toBeUndefined()
	})
})
