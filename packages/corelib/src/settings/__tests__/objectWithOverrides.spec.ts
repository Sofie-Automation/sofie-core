import { literal } from '../../lib.js'
import clone from 'fast-clone'
import {
	applyAndValidateOverrides,
	ObjectWithOverrides,
	SomeObjectOverrideOp,
	updateOverrides,
} from '../objectWithOverrides.js'

interface BasicType {
	valA?: string
	valB: {
		valC: number
		valD?: string
	}
}

describe('applyAndValidateOverrides', () => {
	test('no overrides', () => {
		const inputObj = {
			abc: 'def',
		}

		const res = applyAndValidateOverrides({ defaults: inputObj, overrides: [] })
		expect(res).toBeTruthy()

		expect(res.obj).toStrictEqual(inputObj)
		expect(res.invalid).toHaveLength(0)
		expect(res.preserve).toHaveLength(0)
		expect(res.unused).toHaveLength(0)
	})

	test('invalid overrides', () => {
		const inputObj = {
			abc: 'def',
		}

		const res = applyAndValidateOverrides({
			defaults: inputObj,
			overrides: [
				{
					op: 'unknown',
				},
				{},
			] as any,
		})
		expect(res).toBeTruthy()

		expect(res.obj).toStrictEqual(inputObj)
		expect(res.invalid).toHaveLength(2)
		expect(res.preserve).toHaveLength(0)
		expect(res.unused).toHaveLength(0)
	})

	test('some good overrides', () => {
		const inputObj: BasicType = {
			valA: 'abc',
			valB: {
				valC: 5,
			},
		}
		const inputOps: SomeObjectOverrideOp[] = [
			{ op: 'delete', path: 'valA' },
			{ op: 'set', path: 'valB', value: { valC: 9 } },
			{ op: 'set', path: 'valB.valD', value: 'def' },
		]

		const res = applyAndValidateOverrides({
			defaults: inputObj,
			overrides: inputOps,
		})
		expect(res).toBeTruthy()

		expect(res.obj).toStrictEqual(
			literal<BasicType>({
				valB: {
					valC: 9,
					valD: 'def',
				},
			})
		)
		expect(res.invalid).toHaveLength(0)
		expect(res.preserve).toStrictEqual(inputOps)
		expect(res.unused).toHaveLength(0)
	})

	test('unused overrides', () => {
		const inputObj: BasicType = {
			// valA: 'abc',
			valB: {
				valC: 5,
			},
		}
		const inputOps: SomeObjectOverrideOp[] = [
			{ op: 'delete', path: 'valA' },
			{ op: 'set', path: 'valB', value: { valC: 9, valD: 'def' } },
			{ op: 'set', path: 'valB.valD', value: 'def' },
		]

		const res = applyAndValidateOverrides({
			defaults: inputObj,
			overrides: inputOps,
		})
		expect(res).toBeTruthy()

		expect(res.obj).toStrictEqual(
			literal<BasicType>({
				valB: {
					valC: 9,
					valD: 'def',
				},
			})
		)
		expect(res.invalid).toHaveLength(0)
		expect(res.preserve).toStrictEqual(inputOps)
		expect(res.unused).toStrictEqual([inputOps[0], inputOps[2]])
	})

	test('update overrides - no changes', () => {
		const inputObj: BasicType = {
			valA: 'abc',
			valB: {
				valC: 5,
			},
		}

		const inputObjWithOverrides: ObjectWithOverrides<BasicType> = {
			defaults: inputObj,
			overrides: [],
		}

		const updateObj: BasicType = {
			valA: 'abc',
			valB: {
				valC: 5,
			},
		}

		const res = updateOverrides(inputObjWithOverrides, updateObj)
		expect(res).toBeTruthy()

		expect(res).toStrictEqual(
			literal<ObjectWithOverrides<BasicType>>({
				defaults: {
					valA: 'abc',
					valB: {
						valC: 5,
					},
				},
				overrides: [],
			})
		)
	})

	test('update overrides - update value', () => {
		const inputObj: BasicType = {
			valA: 'abc',
			valB: {
				valC: 5,
				valD: 'xyz',
			},
			valE: [{ valF: 27, valG: 'hij' }],
		}

		const inputObjWithOverrides: ObjectWithOverrides<BasicType> = {
			defaults: inputObj,
			overrides: [{ op: 'set', path: 'valB.valD', value: 'uvw' }],
		}

		const updateObj: BasicType = {
			valA: 'def',
			valB: {
				valC: 6,
				valD: 'uvw',
			},
			valE: [{ valF: 32, valG: 'klm' }],
		}

		const res = updateOverrides(inputObjWithOverrides, updateObj)
		expect(res).toBeTruthy()

		expect(res).toStrictEqual(
			literal<ObjectWithOverrides<BasicType>>({
				defaults: {
					valA: 'abc',
					valB: {
						valC: 5,
						valD: 'xyz',
					},
					valE: [{ valF: 27, valG: 'hij' }],
				},
				overrides: [
					{ op: 'set', path: 'valB.valD', value: 'uvw' },
					{ op: 'set', path: 'valA', value: 'def' },
					{ op: 'set', path: 'valB.valC', value: 6 },
					{ op: 'set', path: 'valE', value: [{ valF: 32, valG: 'klm' }] },
				],
			})
		)
	})

	test('update overrides - update existing override', () => {
		const inputObj: BasicType = {
			valA: 'abc',
			valB: {
				valC: 5,
			},
		}

		const inputObjWithOverrides: ObjectWithOverrides<BasicType> = {
			defaults: inputObj,
			overrides: [
				{ op: 'set', path: 'valA', value: 'def' },
				{ op: 'set', path: 'valB.valC', value: 6 },
			],
		}

		const updateObj: BasicType = {
			valA: 'ghi',
			valB: {
				valC: 7,
			},
		}

		const res = updateOverrides(inputObjWithOverrides, updateObj)
		expect(res).toBeTruthy()

		expect(res).toStrictEqual(
			literal<ObjectWithOverrides<BasicType>>({
				defaults: {
					valA: 'abc',
					valB: {
						valC: 5,
					},
				},
				overrides: [
					{ op: 'set', path: 'valA', value: 'ghi' },
					{ op: 'set', path: 'valB.valC', value: 7 },
				],
			})
		)
	})

	test('update overrides - add to existing overrides', () => {
		const inputObj: BasicType = {
			valA: 'abc',
			valB: {
				valC: 5,
				valD: 'foo',
			},
		}

		const inputObjWithOverrides: ObjectWithOverrides<BasicType> = {
			defaults: inputObj,
			overrides: [
				{ op: 'set', path: 'valA', value: 'def' },
				{ op: 'set', path: 'valB.valC', value: 6 },
			],
		}

		const updateObj: BasicType = {
			valA: 'ghi',
			valB: {
				valC: 7,
				valD: 'bar',
			},
		}

		const res = updateOverrides(inputObjWithOverrides, updateObj)
		expect(res).toBeTruthy()

		expect(res).toStrictEqual(
			literal<ObjectWithOverrides<BasicType>>({
				defaults: {
					valA: 'abc',
					valB: {
						valC: 5,
						valD: 'foo',
					},
				},
				overrides: [
					{ op: 'set', path: 'valA', value: 'ghi' },
					{ op: 'set', path: 'valB.valC', value: 7 },
					{ op: 'set', path: 'valB.valD', value: 'bar' },
				],
			})
		)
	})

	test('update overrides - add to existing overrides #2', () => {
		const inputObj = {
			valA: 'abc',
			valB: {
				'0': { propA: 35, propB: 'Mic 1' },
				'1': { propA: 36, propB: 'Mic 2' },
				'2': { propA: 37, propB: 'Mic 3' },
			},
		}

		const inputObjWithOverrides: ObjectWithOverrides<any> = {
			defaults: inputObj,
			overrides: [
				{
					op: 'set',
					path: 'valB.0.propC',
					value: true,
				},
				{
					op: 'set',
					path: 'valB.0.propD',
					value: true,
				},
				{ op: 'set', path: 'valB.1.propC', value: true },
			],
		}

		const updateObj = {
			valA: 'abc',
			valB: {
				'0': { propA: 35, propB: 'Mic 1', propC: true, propD: true },
				'1': { propA: 36, propB: 'Mic 2', propC: true },
				'2': { propA: 37, propB: 'Mic 3', propC: true },
			},
		}

		const res = updateOverrides(inputObjWithOverrides, updateObj)
		expect(res).toBeTruthy()

		expect(res).toStrictEqual(
			literal<ObjectWithOverrides<any>>({
				defaults: clone(inputObj),
				overrides: [
					{
						op: 'set',
						path: 'valB.0.propC',
						value: true,
					},
					{
						op: 'set',
						path: 'valB.0.propD',
						value: true,
					},
					{ op: 'set', path: 'valB.1.propC', value: true },
					{ op: 'set', path: 'valB.2.propC', value: true },
				],
			})
		)
	})

	test('update overrides - delete key', () => {
		const inputObj = {
			valA: 'abc',
			valB: {
				'0': { propA: 35, propB: 'Mic 1' },
				'1': { propA: 36, propB: 'Mic 2' },
				'2': { propA: 37, propB: 'Mic 3' },
			},
		}

		const inputObjWithOverrides: ObjectWithOverrides<any> = {
			defaults: inputObj,
			overrides: [],
		}

		const updateObj = {
			valA: 'abc',
			valB: {
				'0': { propA: 35, propB: 'Mic 1' },
				'1': { propA: 36, propB: 'Mic 2' },
			},
		}

		const res = updateOverrides(inputObjWithOverrides, updateObj)
		expect(res).toBeTruthy()

		expect(res).toStrictEqual(
			literal<ObjectWithOverrides<any>>({
				defaults: clone(inputObj),
				overrides: [
					{
						op: 'delete',
						path: 'valB.2',
					},
				],
			})
		)
	})

	test('update overrides - delete value', () => {
		const inputObj = {
			valA: 'abc',
			valB: {
				'0': { propA: 35, propB: 'Mic 1' },
				'1': { propA: 36, propB: 'Mic 2' },
				'2': { propA: 37, propB: 'Mic 3' },
			},
		}

		const inputObjWithOverrides: ObjectWithOverrides<any> = {
			defaults: inputObj,
			overrides: [],
		}

		const updateObj = {
			valA: 'abc',
			valB: {
				'0': { propA: 35, propB: 'Mic 1' },
				'1': { propA: 36, propB: 'Mic 2' },
				'2': { propA: 37 },
			},
		}

		const res = updateOverrides(inputObjWithOverrides, updateObj)
		expect(res).toBeTruthy()

		expect(res).toStrictEqual(
			literal<ObjectWithOverrides<any>>({
				defaults: clone(inputObj),
				overrides: [
					{
						op: 'delete',
						path: 'valB.2.propB',
					},
				],
			})
		)
	})
})
