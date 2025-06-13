import deepExtend from 'deep-extend'
import { check, Match } from '../check'

describe('lib/check', () => {
	test('check basic', () => {
		expect(() => check('asdf', String)).not.toThrow()
		expect(() => check(123, Number)).not.toThrow()
		expect(() => check({ a: 1 }, Object)).not.toThrow()
		expect(() => check({}, Object)).not.toThrow()
		expect(() => check([1234, 5, 6], Array)).not.toThrow()
		expect(() => check(true, Boolean)).not.toThrow()
		expect(() => check(false, Boolean)).not.toThrow()
		expect(() => check(() => console.log('hello'), Function)).not.toThrow()

		expect(() => check(['asdf', 'asdf2'], [String])).not.toThrow()
		expect(() => check([1, 2, 3], [Number])).not.toThrow()

		// Bad values:
		expect(() => check(123, String)).toThrow()
		expect(() => check('123', Number)).toThrow()
		expect(() => check([], Object)).toThrow()
		expect(() => check({}, Array)).toThrow()
		expect(() => check(123, Array)).toThrow()
		expect(() => check(null, Boolean)).toThrow()
		expect(() => check(undefined, Boolean)).toThrow()

		expect(() => check(['asdf', 1], [String])).toThrow()
		expect(() => check([1, 2, 3, null], [Number])).toThrow()
	})
	test('check object', () => {
		const val = {
			a: 1,
			b: {
				c: 2,
				e: [1, 2, 3],
			},
			e: [1, 2, 3],
		}
		const verify: Match.Pattern = {
			a: Number,
			b: {
				c: Number,
				e: [Number],
			},
			e: [Number],
		}

		expect(() => check(val, verify)).not.toThrow()

		{
			const verify2 = deepExtend({}, verify) as any
			verify2.b.e = [String]
			expect(() => check(val, verify2)).toThrow()
		}
	})
})
