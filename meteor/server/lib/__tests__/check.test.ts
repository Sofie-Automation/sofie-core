import { z } from 'zod'
import { check, disableChecks, enableChecks, zAnyArray, zPlainObject } from '../check'
import { Meteor } from 'meteor/meteor'

describe('lib/check', () => {
	test('check basic', () => {
		expect(() => check('asdf', z.string())).not.toThrow()
		expect(() => check(123, z.number())).not.toThrow()
		expect(() => check({ a: 1 }, zPlainObject)).not.toThrow()
		expect(() => check({}, zPlainObject)).not.toThrow()
		expect(() => check([1234, 5, 6], zAnyArray)).not.toThrow()
		expect(() => check(true, z.boolean())).not.toThrow()
		expect(() => check(false, z.boolean())).not.toThrow()

		expect(() => check(['asdf', 'asdf2'], z.array(z.string()))).not.toThrow()
		expect(() => check([1, 2, 3], z.array(z.number()))).not.toThrow()

		// Bad values:
		expect(() => check(123, z.string())).toThrow()
		expect(() => check('123', z.number())).toThrow()
		expect(() => check([], zPlainObject)).toThrow()
		expect(() => check(null, zPlainObject)).toThrow()
		expect(() => check({}, zAnyArray)).toThrow()
		expect(() => check(123, zAnyArray)).toThrow()
		expect(() => check(null, z.boolean())).toThrow()
		expect(() => check(undefined, z.boolean())).toThrow()

		expect(() => check(['asdf', 1], z.array(z.string()))).toThrow()
		expect(() => check([1, 2, 3, null], z.array(z.number()))).toThrow()
	})

	test('check optional/nullable', () => {
		// `nullish` is the replacement for Meteor's `Match.Maybe`: undefined | null | T
		expect(() => check(undefined, z.string().nullish())).not.toThrow()
		expect(() => check(null, z.string().nullish())).not.toThrow()
		expect(() => check('asdf', z.string().nullish())).not.toThrow()
		expect(() => check(123, z.string().nullish())).toThrow()

		// `optional` is the replacement for Meteor's `Match.Optional`: undefined | T
		expect(() => check(undefined, z.string().optional())).not.toThrow()
		expect(() => check(null, z.string().optional())).toThrow()

		expect(() => check(null, z.string().nullable())).not.toThrow()
		expect(() => check(undefined, z.string().nullable())).toThrow()
	})

	test('check object', () => {
		// Meteor's object patterns rejected unknown keys, so `strictObject` is the equivalent
		const verify = z.strictObject({
			a: z.number(),
			b: z.strictObject({
				c: z.number(),
				e: z.array(z.number()),
			}),
			e: z.array(z.number()),
		})

		const val = {
			a: 1,
			b: {
				c: 2,
				e: [1, 2, 3],
			},
			e: [1, 2, 3],
		}

		expect(() => check(val, verify)).not.toThrow()
		expect(() => check({ ...val, unknownKey: 1 }, verify)).toThrow()

		const verify2 = z.strictObject({
			...verify.shape,
			b: z.strictObject({ c: z.number(), e: z.array(z.string()) }),
		})
		expect(() => check(val, verify2)).toThrow()
	})

	test('throws a client-safe SofieError', () => {
		let error: any
		try {
			check(undefined, z.string())
		} catch (e) {
			error = e
		}

		expect(error).toBeInstanceOf(Meteor.Error)
		expect(error.error).toBe(400)
		expect(error.reason).toMatch(/^Match error: /)
		// The message must describe the expected/received *types*, never the received value
		expect(error.reason).toContain('expected string')
	})

	test('reports the path of the failing field', () => {
		expect(() => check({ a: { b: 'nope' } }, z.strictObject({ a: z.strictObject({ b: z.number() }) }))).toThrow(
			/in field a\.b/
		)
	})

	test('disableChecks/enableChecks', () => {
		expect(() => check(123, z.string())).toThrow()

		disableChecks()
		try {
			expect(() => check(123, z.string())).not.toThrow()
		} finally {
			enableChecks()
		}

		expect(() => check(123, z.string())).toThrow()
	})
})
