import { TSR } from '@sofie-automation/blueprints-integration'
import { TimelineObjGeneric, TimelineObjType } from '../dataModel/Timeline.js'
import {
	formatDateAsTimecode,
	formatDurationAsTimecode,
	getHash,
	getRank,
	literal,
	objectPathGet,
	objectPathSet,
	removeNullyProperties,
	stringifyObjects,
} from '../lib.js'
import { UserError, UserErrorMessage } from '../error.js'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'

describe('Lib', () => {
	test('getHash', () => {
		const h0 = getHash('abc')
		const h1 = getHash('abcd')
		const h2 = getHash('abc')

		expect(h0).toEqual(h2)
		expect(h0).not.toEqual(h1)
	})
	test('literal', () => {
		const obj = literal<TimelineObjGeneric>({
			id: 'abc',
			enable: {
				start: 0,
			},
			layer: 'L1',
			content: { deviceType: TSR.DeviceType.ABSTRACT },
			objectType: TimelineObjType.RUNDOWN,
			priority: 0,
		})
		expect(obj).toEqual({
			id: 'abc',
			enable: {
				start: 0,
			},
			layer: 'L1',
			content: { deviceType: TSR.DeviceType.ABSTRACT },
			objectType: TimelineObjType.RUNDOWN,
			priority: 0,
		})
		const layer: string | number = obj.layer // just to check typings
		expect(layer).toBeTruthy()
	})
	test('formatDateAsTimecode', () => {
		const d = new Date('2019-01-01 13:04:15.145')
		expect(d.getMilliseconds()).toEqual(145)
		expect(formatDateAsTimecode({ frameRate: 25 }, d)).toEqual('13:04:15:03')
	})
	test('formatDurationAsTimecode', () => {
		expect(formatDurationAsTimecode({ frameRate: 25 }, (2 * 3600 + 5 * 60 + 7) * 1000 + 500)).toEqual('02:05:07:12')
	})
	test('removeNullyProperties', () => {
		expect(
			removeNullyProperties({
				a: 1,
				b: 2,
				c: null,
				e: undefined,
				f: {
					a: 1,
					b: 2,
					c: null,
					e: undefined,
				},
			})
		).toEqual({
			a: 1,
			b: 2,
			e: undefined,
			f: {
				a: 1,
				b: 2,
				e: undefined,
			},
		})
	})
	test('objectPathGet', () => {
		expect(
			objectPathGet(
				{
					a: 1,
					b: {
						c: 1,
						d: {
							e: 2,
						},
					},
				},
				'b.d.e'
			)
		).toEqual(2)
	})
	test('objectPathSet', () => {
		const o: any = {
			a: 1,
			b: {
				c: 1,
				d: {
					e: 2,
				},
			},
		}
		objectPathSet(o, 'b.d.f', 42)
		expect(o.b.d.f).toEqual(42)
	})
	test('stringifyError', () => {
		// string:
		expect(stringifyError('abc')).toBe('abc')

		// Error:
		const error = new Error('Hello')
		expect(stringifyError(error)).toMatch(/Error: Hello/)
		expect(stringifyError(error)).toMatch(/lib\.spec/)

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

		// UserError:
		const userError = UserError.from(error, UserErrorMessage.ValidationFailed, {}, 42)
		// The stringification should trigger .toString() -> .toJSON() in UserError:
		const str = stringifyError(userError)
		expect(str).toMatch(/^UserError: /)

		// This trim is not nice, but necessary to strip off some of the error wrapping. This shouldn't be done anywhere else, but we need to for this test
		let strTrimmed = str.slice('UserError: '.length)
		strTrimmed = strTrimmed.slice(0, strTrimmed.indexOf('}, Error:') + 1)
		expect(JSON.parse(strTrimmed)).toMatchObject({
			errorCode: 42,
			key: UserErrorMessage.ValidationFailed,
			userMessage: {
				key: 'Validation failed!',
				args: {},
			},
			rawError: {
				name: expect.stringContaining('Error'),
				message: 'Hello',
				stack: expect.stringContaining('Error: Hello'),
			},
		})

		// Array of stuff:
		const arr = ['qwerty', error, event, obj]
		expect(stringifyError(arr)).toMatch(/qwerty/)
		expect(stringifyError(arr)).toMatch(/Error: Hello/)
		expect(stringifyError(event)).toMatch(/MyTestEvent.*abc/)
		expect(stringifyError(obj)).toMatch(/anotherProp.*abc/)
	})
	test('getRank', () => {
		const objs: { _rank: number }[] = [
			{ _rank: 0 },
			{ _rank: 10 },
			{ _rank: 20 },
			{ _rank: 21 },
			{ _rank: 22 },
			{ _rank: 23 },
		]

		// First:
		expect(getRank(null, objs[0])).toEqual(-0.5)
		// Insert two:
		expect(getRank(null, objs[0], 0, 2)).toEqual(-0.6666666666666667)
		expect(getRank(null, objs[0], 1, 2)).toEqual(-0.33333333333333337)

		// Center:
		expect(getRank(objs[1], objs[2])).toEqual(15)
		// Insert three:
		expect(getRank(objs[1], objs[2], 0, 3)).toEqual(12.5)
		expect(getRank(objs[1], objs[2], 1, 3)).toEqual(15)
		expect(getRank(objs[1], objs[2], 2, 3)).toEqual(17.5)

		// Last:
		expect(getRank(objs[5], undefined)).toEqual(23.5)
		// Insert three:
		expect(getRank(objs[5], undefined, 0, 3)).toEqual(23.25)
		expect(getRank(objs[5], undefined, 1, 3)).toEqual(23.5)
		expect(getRank(objs[5], undefined, 2, 3)).toEqual(23.75)

		// Insert in empty list
		expect(getRank(undefined, undefined)).toEqual(0.5)

		// Insert three:
		expect(getRank(undefined, undefined, 0, 2)).toEqual(0.3333333333333333)
		expect(getRank(undefined, undefined, 1, 2)).toEqual(0.6666666666666666)
	})
	test('stringifyObjects', () => {
		const o: any = {
			a: 1,
			b: {
				c: '1',
				d: {
					e: 2,
				},
			},
		}
		expect(stringifyObjects(o)).toEqual(stringifyObjects(o))
	})
})
