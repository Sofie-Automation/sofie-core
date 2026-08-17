import { Meteor } from 'meteor/meteor'
import { wrapError } from '../methodDispatch'
import { logger } from '../../logging'

describe('wrapError', () => {
	test('maps a Meteor.Error to the DDP error shape', () => {
		const err = wrapError(new Meteor.Error(418, 'teapot'))
		expect(err).toMatchObject({ error: 418, reason: 'teapot', errorType: 'Meteor.Error' })
	})

	test('carries the `details` of a Meteor.Error through to the client', () => {
		const err = wrapError(new Meteor.Error(401, 'unauthorized', 'extra-context'))
		expect(err.details).toBe('extra-context')
		expect(err).toMatchObject({ error: 401, reason: 'unauthorized', errorType: 'Meteor.Error' })
	})

	test('sanitizes an unexpected (non-Meteor) error to a 500 without leaking internals', () => {
		const spy = jest.spyOn(logger, 'error').mockImplementation(() => logger)
		try {
			const err = wrapError(new Error('secret stack / internal detail'))
			expect(err).toEqual({
				error: 500,
				reason: 'Internal server error',
				message: 'Internal server error [500]',
				errorType: 'Meteor.Error',
			})
			expect(JSON.stringify(err)).not.toContain('secret')
			// the real error is logged server-side
			expect(spy).toHaveBeenCalled()
		} finally {
			spy.mockRestore()
		}
	})
})
