import { SofieError } from '@sofie-automation/corelib/dist/error'
import { wrapError } from '../methodDispatch'
import { encodeMessage } from '../wireCodec'
import { logger } from '../../logging'

describe('wrapError', () => {
	test('maps a SofieError to the DDP error shape', () => {
		const err = wrapError(new SofieError(418, 'teapot'))
		expect(err).toMatchObject({ error: 418, reason: 'teapot', errorType: 'Meteor.Error' })
	})

	test('carries the `details` of a SofieError through to the client', () => {
		const err = wrapError(new SofieError(401, 'unauthorized', 'extra-context'))
		expect(err.details).toBe('extra-context')
		expect(err).toMatchObject({ error: 401, reason: 'unauthorized', errorType: 'Meteor.Error' })
	})

	test('emits exactly the fields Meteor.Error did', () => {
		// This is the wire contract with the web UI's DDP client and the gateways - it must not drift
		expect(wrapError(new SofieError(401, 'unauthorized', 'extra-context'))).toEqual({
			isClientSafe: true,
			error: 401,
			reason: 'unauthorized',
			details: 'extra-context',
			message: 'unauthorized [401]',
			errorType: 'Meteor.Error',
		})
	})

	test('serializes onto the wire unchanged', () => {
		// Guards against an error instance (rather than the plain DDPError) reaching the codec, where
		// EJSON would serialize it differently
		const json = encodeMessage({
			msg: 'result',
			id: '1',
			error: wrapError(new SofieError(401, 'unauthorized', 'extra-context')),
		})
		expect(JSON.parse(json)).toEqual({
			msg: 'result',
			id: '1',
			error: {
				isClientSafe: true,
				error: 401,
				reason: 'unauthorized',
				details: 'extra-context',
				message: 'unauthorized [401]',
				errorType: 'Meteor.Error',
			},
		})
	})

	test('sanitizes an unexpected (non-Sofie) error to a 500 without leaking internals', () => {
		const spy = jest.spyOn(logger, 'error').mockImplementation(() => logger)
		try {
			const err = wrapError(new Error('secret stack / internal detail'))
			expect(err).toEqual({
				isClientSafe: true,
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
