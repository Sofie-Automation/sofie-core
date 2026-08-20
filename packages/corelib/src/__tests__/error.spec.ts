import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'
import EJSON from 'ejson'
import { SofieError, UserError, UserErrorMessage } from '../error.js'

describe('UserError', () => {
	test('stringifyError', () => {
		const rawError = new Error('raw')
		rawError.stack = 'mock stack'
		const userError = UserError.from(rawError, UserErrorMessage.PartNotFound, { key: 'translatable message' })

		expect(stringifyError(userError)).toEqual(
			expect.stringContaining(
				'UserError: ' +
					JSON.stringify({
						rawError: {
							name: 'UserError',
							message: 'raw',
							stack: 'mock stack',
						},
						userMessage: {
							key: 'The selected part does not exist',
							args: {
								key: 'translatable message',
							},
						},
						key: 25,
						errorCode: 500,
					})
			)
		)

		// serialized and restored
		const restored = JSON.parse(userError.toString())
		expect(stringifyError(restored)).toEqual('raw, mock stack')
	})
})

describe('SofieError', () => {
	test('message formatting matches Meteor.Error', () => {
		expect(new SofieError(404, 'File not found').message).toBe('File not found [404]')
		expect(new SofieError(500).message).toBe('[500]')
	})

	test('is a real Error subclass', () => {
		const e = new SofieError(404, 'File not found')
		expect(e).toBeInstanceOf(SofieError)
		expect(e).toBeInstanceOf(Error)
		expect(e.name).toBe('SofieError')
		expect(typeof e.stack).toBe('string')
		// The constructor frame is hidden, so the first stack frame is the caller
		expect(e.stack).not.toContain('new SofieError')
	})

	test('fields', () => {
		const e = new SofieError(409, 'Conflict', 'extra-context')
		expect(e.error).toBe(409)
		expect(e.reason).toBe('Conflict')
		expect(e.details).toBe('extra-context')

		const noDetails = new SofieError(409, 'Conflict')
		expect(noDetails.details).toBeUndefined()
	})

	test('toString does not duplicate the class name', () => {
		expect(new SofieError(404, 'File not found').toString()).toBe('File not found [404]')
	})

	test('stringifyError', () => {
		const e = new SofieError(404, 'File not found')
		e.stack = 'mock stack'
		expect(stringifyError(e)).toBe('SofieError: File not found [404], mock stack')
	})

	test('clone', () => {
		const e = new SofieError(409, 'Conflict', 'extra-context')
		const cloned = e.clone()

		expect(cloned).not.toBe(e)
		expect(cloned).toBeInstanceOf(SofieError)
		expect(cloned.error).toBe(e.error)
		expect(cloned.reason).toBe(e.reason)
		expect(cloned.details).toBe(e.details)
		expect(cloned.message).toBe(e.message)
	})

	test('EJSON.clone dispatches to clone()', () => {
		// EJSON.stringify -> toJSONValue -> EJSON.clone, so an instance reaching the DDP codec must
		// not silently lose its fields
		const cloned = EJSON.clone(new SofieError(409, 'Conflict', 'extra-context'))
		expect(cloned).toBeInstanceOf(SofieError)
		expect(cloned.error).toBe(409)
		expect(cloned.reason).toBe('Conflict')
		expect(cloned.details).toBe('extra-context')
	})
})
