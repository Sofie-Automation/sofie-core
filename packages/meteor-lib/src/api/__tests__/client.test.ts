import { ClientAPI } from '../client.js'
import { UserError, UserErrorMessage } from '@sofie-automation/corelib/dist/error'

describe('ClientAPI', () => {
	it('Creates a responseSuccess object', () => {
		const mockSuccessValue = {
			someData: 'someValue',
		}
		const response = ClientAPI.responseSuccess(mockSuccessValue)
		expect(response).toMatchObject({
			success: 200,
			result: mockSuccessValue,
		})
	})
	it('Creates a responseError object', () => {
		const mockErrorMessage = 'Some error'

		const mockArgs = { a: 'test' }

		{
			const error = ClientAPI.responseError(UserError.create(UserErrorMessage.InactiveRundown, mockArgs))
			expect(error).toMatchObject({
				error: {
					key: UserErrorMessage.InactiveRundown,
					userMessage: {
						args: mockArgs,
						key: 'Rundown must be active!',
					},
					rawError: expect.anything(),
				},
			})
		}

		{
			const rawErr = new Error(mockErrorMessage)
			const error = ClientAPI.responseError(UserError.from(rawErr, UserErrorMessage.InternalError, mockArgs))

			expect(error).toMatchObject({
				error: {
					key: UserErrorMessage.InternalError,
					userMessage: {
						args: mockArgs,
						key: 'An internal error occured!',
					},
					rawError: expect.objectContaining({
						message: mockErrorMessage,
						name: 'UserError',
					}),
				},
			})
		}
	})
	describe('isClientResponseSuccess', () => {
		it('Correctly recognizes a responseSuccess object', () => {
			const response = ClientAPI.responseSuccess(undefined)
			expect(ClientAPI.isClientResponseSuccess(response)).toBe(true)
		})
		it('Correctly recognizes a not-success object', () => {
			const response = ClientAPI.responseError(UserError.create(UserErrorMessage.InactiveRundown))
			expect(ClientAPI.isClientResponseSuccess(response)).toBe(false)
		})
		it('Correctly recognizes that a Meteor.Error is not a success object', () => {
			expect(ClientAPI.isClientResponseSuccess(new Error('404'))).toBe(false)
		})
	})
	describe('isClientResponseError', () => {
		it('Correctly recognizes a responseError object', () => {
			const response = ClientAPI.responseError(UserError.create(UserErrorMessage.InactiveRundown))
			expect(ClientAPI.isClientResponseError(response)).toBe(true)
		})
		it('Correctly regognizes a not-error object', () => {
			const response = ClientAPI.responseSuccess(undefined)
			expect(ClientAPI.isClientResponseError(response)).toBe(false)
		})
		it('Correctly recognizes that a Meteor.Error is not an error object', () => {
			expect(ClientAPI.isClientResponseError(new Error('404'))).toBe(false)
		})
	})
})
