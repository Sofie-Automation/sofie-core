import { stringifyError } from '../stringifyError.js'

test('stringifyError', () => {
	// string:
	expect(stringifyError('abc')).toBe('abc')

	// Error:
	const error = new Error('Hello')
	expect(stringifyError(error)).toMatch(/Error: Hello/)
	expect(stringifyError(error)).toMatch(/stringifyError\.spec/)

	// Instance of classes (similar to for example KeyboardEvents):
	class MyTestEvent {
		public prop = 'abc'
	}
	const event = new MyTestEvent()
	expect(stringifyError(event)).toMatch(/MyTestEvent.*abc/)

	// Some object:
	const obj = {
		prop: {
			anotherProp: 'abc',
		},
	}
	expect(stringifyError(obj)).toMatch(/anotherProp.*abc/)

	// Array of stuff:
	const arr = ['qwerty', error, event, obj]
	expect(stringifyError(arr)).toMatch(/qwerty/)
	expect(stringifyError(arr)).toMatch(/Error: Hello/)
	expect(stringifyError(event)).toMatch(/MyTestEvent.*abc/)
	expect(stringifyError(obj)).toMatch(/anotherProp.*abc/)
})
