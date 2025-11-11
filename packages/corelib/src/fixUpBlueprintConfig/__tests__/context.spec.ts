import {
	ObjectOverrideDeleteOp,
	ObjectOverrideSetOp,
	ObjectWithOverrides,
	wrapDefaultObject,
} from '../../settings/objectWithOverrides.js'
import { literal } from '../../lib.js'
import { FixUpBlueprintConfigContext } from '../context.js'
import { ICommonContext, JSONSchema } from '@sofie-automation/blueprints-integration'

function createSimpleConfigBlob() {
	return literal<ObjectWithOverrides<any>>({
		defaults: {
			a: 1,
			b: 2,
			c: 3,
		},
		overrides: [
			{ op: 'delete', path: 'b' },
			{ op: 'set', path: 'c', value: 5 },
		],
	})
}

function createComplexConfigBlob() {
	return literal<ObjectWithOverrides<any>>({
		defaults: {
			a: 1,
			b: 2,
			c: 3,
			obj: {
				a: 1,
				b: 2,
			},
			arr: [3, 4, 5],
			table: {
				abc: {
					number: 1,
				},
				def: {
					number: 5,
				},
			},
		},
		overrides: [
			{ op: 'delete', path: 'b' },
			{ op: 'set', path: 'c', value: 5 },
			{ op: 'set', path: 'obj.b', value: 5 },
			{ op: 'set', path: 'arr', value: [6, 7] },
			{ op: 'set', path: 'table.c', value: { number: 99 } },
		],
	})
}

function createComplexBlobSchema(): JSONSchema {
	return {
		$schema: 'https://json-schema.org/draft/2020-12/schema',
		type: 'object',
		properties: {
			a: {
				type: 'string',
			},
			b: {
				type: 'integer',
			},
			c: {
				type: 'integer',
			},
			obj: {
				type: 'object',
				properties: {
					a: {
						type: 'integer',
					},
					b: {
						type: 'integer',
					},
					c: {
						type: 'integer',
					},
				},
			},
			arr: {
				type: 'array',
				items: {
					type: 'integer',
				},
			},
			table: {
				type: 'object',
				patternProperties: {
					'': {
						type: 'object',
						properties: {
							number: {
								type: 'integer',
							},
						},
					},
				},
			},
		},
	}
}

describe('getConfig', () => {
	const fakeCommonContext: ICommonContext = null as any

	test('Initial', () => {
		const context = new FixUpBlueprintConfigContext(fakeCommonContext, {}, createSimpleConfigBlob())

		expect(context.getConfig()).toEqual({
			a: 1,
			c: 5,
		})
	})

	test('Mutate (externally) is reactive', () => {
		const context = new FixUpBlueprintConfigContext(fakeCommonContext, {}, createSimpleConfigBlob())
		context.configObject.overrides.push({ op: 'set', path: 'c', value: 10 })

		expect(context.getConfig()).toEqual({
			a: 1,
			c: 10,
		})
	})
})

describe('listPaths', () => {
	const fakeCommonContext: ICommonContext = null as any

	test('Initial', () => {
		const context = new FixUpBlueprintConfigContext(fakeCommonContext, {}, createSimpleConfigBlob())

		expect(context.listPaths()).toEqual(['b', 'c'])
	})

	test('Mutate (externally) is reactive', () => {
		const context = new FixUpBlueprintConfigContext(fakeCommonContext, {}, createSimpleConfigBlob())
		context.configObject.overrides.push({ op: 'set', path: 'c', value: 10 })

		expect(context.listPaths()).toEqual(['b', 'c', 'c'])
	})
})

describe('listInvalidPaths', () => {
	const fakeCommonContext: ICommonContext = null as any

	test('Initial', () => {
		const context = new FixUpBlueprintConfigContext(fakeCommonContext, {}, createSimpleConfigBlob())

		expect(context.listInvalidPaths()).toEqual([])
	})

	test('Mutate (externally) is reactive', () => {
		const context = new FixUpBlueprintConfigContext(fakeCommonContext, {}, createSimpleConfigBlob())
		context.configObject.overrides.push({ op: 'set', path: 'c', value: 10 })
		context.configObject.overrides.push({ op: 'set', path: 'b.1', value: 10 })

		expect(context.listInvalidPaths()).toEqual(['b.1'])
	})
})

describe('hasOperations', () => {
	const fakeCommonContext: ICommonContext = null as any

	test('hasOperations', () => {
		const context = new FixUpBlueprintConfigContext(fakeCommonContext, {}, createSimpleConfigBlob())

		expect(context.hasOperations('a')).toBeFalsy()
		expect(context.hasOperations('d')).toBeFalsy()
		expect(context.hasOperations('c.1')).toBeFalsy()
		expect(context.hasOperations('')).toBeFalsy()

		expect(context.hasOperations('b')).toBeTruthy()
		expect(context.hasOperations('c')).toBeTruthy()

		context.configObject.overrides.push({ op: 'set', path: 'a.1', value: 10 })
		expect(context.hasOperations('a')).toBeTruthy()
	})
})

describe('addSetOperation', () => {
	const fakeCommonContext: ICommonContext = null as any
	const configSchema = createComplexBlobSchema()

	test('set invalid path', () => {
		const initialConfig = createComplexConfigBlob()
		const context = new FixUpBlueprintConfigContext(fakeCommonContext, configSchema, initialConfig)

		expect(() => context.addSetOperation('zz', true)).toThrow(/does not exist/)
	})

	test('set new path', () => {
		const initialConfig = createComplexConfigBlob()
		const context = new FixUpBlueprintConfigContext(fakeCommonContext, configSchema, initialConfig)

		context.addSetOperation('a', true)
		expect(context.configObject.overrides).toEqual([
			...initialConfig.overrides,
			{ op: 'set', path: 'a', value: true } satisfies ObjectOverrideSetOp,
		])
	})

	test('override existing path', () => {
		const initialConfig = createComplexConfigBlob()
		const context = new FixUpBlueprintConfigContext(fakeCommonContext, configSchema, initialConfig)

		context.addSetOperation('b', true)
		expect(context.configObject.overrides).toEqual([
			...initialConfig.overrides.filter((op) => op.path !== 'b'),
			{ op: 'set', path: 'b', value: true } satisfies ObjectOverrideSetOp,
		])
	})

	test('set child property path', () => {
		const initialConfig = createComplexConfigBlob()
		const context = new FixUpBlueprintConfigContext(fakeCommonContext, configSchema, initialConfig)

		context.addSetOperation('obj.c', true)
		expect(context.configObject.overrides).toEqual([
			...initialConfig.overrides,
			{ op: 'set', path: 'obj.c', value: true } satisfies ObjectOverrideSetOp,
		])
	})

	test('override child property path', () => {
		const initialConfig = createComplexConfigBlob()
		const context = new FixUpBlueprintConfigContext(fakeCommonContext, configSchema, initialConfig)

		context.addSetOperation('obj.b', true)
		expect(context.configObject.overrides).toEqual([
			...initialConfig.overrides.filter((op) => op.path !== 'obj.b'),
			{ op: 'set', path: 'obj.b', value: true } satisfies ObjectOverrideSetOp,
		])
	})

	test('set non-table object with child values', () => {
		const initialConfig = createComplexConfigBlob()
		const context = new FixUpBlueprintConfigContext(fakeCommonContext, configSchema, initialConfig)

		// Not allowed, as 'obj.a' is where the value should be set
		expect(() => context.addSetOperation('obj', true)).toThrow('does not exist')
	})

	test('set table array', () => {
		const initialConfig = createComplexConfigBlob()
		const context = new FixUpBlueprintConfigContext(fakeCommonContext, configSchema, initialConfig)

		const newValue = [9, 9, 9]
		context.addSetOperation('arr', newValue)
		expect(context.configObject.overrides).toEqual([
			...initialConfig.overrides.filter((op) => op.path !== 'arr'),
			{ op: 'set', path: 'arr', value: newValue } satisfies ObjectOverrideSetOp,
		])
	})

	test('set table array row', () => {
		const initialConfig = createComplexConfigBlob()
		const context = new FixUpBlueprintConfigContext(fakeCommonContext, configSchema, initialConfig)

		context.addSetOperation('arr.1', 5)
		expect(context.configObject.overrides).toEqual([
			...initialConfig.overrides.filter((op) => op.path !== 'arr'),
			{ op: 'set', path: 'arr', value: [6, 5] } satisfies ObjectOverrideSetOp,
		])
	})

	test('set whole table object', () => {
		const initialConfig = createComplexConfigBlob()
		const context = new FixUpBlueprintConfigContext(fakeCommonContext, configSchema, initialConfig)

		const newValue = { a: { number: 56 } }
		expect(() => context.addSetOperation('table', newValue)).toThrow('Cannot set')
	})

	test('set table object row', () => {
		const initialConfig = createComplexConfigBlob()
		const context = new FixUpBlueprintConfigContext(fakeCommonContext, configSchema, initialConfig)

		context.addSetOperation('table.abc', { number: 8 })
		expect(context.configObject.overrides).toEqual([
			...initialConfig.overrides,
			{ op: 'set', path: 'table.abc', value: { number: 8 } } satisfies ObjectOverrideSetOp,
		])
	})

	test('override table object row value', () => {
		const initialConfig = createComplexConfigBlob()
		const context = new FixUpBlueprintConfigContext(fakeCommonContext, configSchema, initialConfig)

		context.addSetOperation('table.abc.number', 8)
		expect(context.configObject.overrides).toEqual([
			...initialConfig.overrides,
			{ op: 'set', path: 'table.abc.number', value: 8 } satisfies ObjectOverrideSetOp,
		])
	})

	test('override table object row', () => {
		const initialConfig = createComplexConfigBlob()
		const context = new FixUpBlueprintConfigContext(fakeCommonContext, configSchema, initialConfig)

		context.addSetOperation('table.c', { number: 8 })
		expect(context.configObject.overrides).toEqual([
			...initialConfig.overrides.filter((op) => op.path !== 'table.c'),
			{ op: 'set', path: 'table.c', value: { number: 8 } } satisfies ObjectOverrideSetOp,
		])
	})
})

describe('addDeleteOperation', () => {
	const fakeCommonContext: ICommonContext = null as any
	const configSchema = createComplexBlobSchema()

	test('Invalid path', () => {
		const initialConfig = createComplexConfigBlob()
		const context = new FixUpBlueprintConfigContext(fakeCommonContext, configSchema, initialConfig)

		expect(() => context.addDeleteOperation('zz')).toThrow(/does not exist/)
	})

	test('Valid path', () => {
		const initialConfig = createComplexConfigBlob()
		const context = new FixUpBlueprintConfigContext(fakeCommonContext, configSchema, initialConfig)

		context.addDeleteOperation('a')
		expect(context.configObject.overrides).toEqual([
			...initialConfig.overrides,
			{ op: 'delete', path: 'a' } satisfies ObjectOverrideDeleteOp,
		])
	})

	test('Path with existing set operation', () => {
		const initialConfig = createComplexConfigBlob()
		const context = new FixUpBlueprintConfigContext(fakeCommonContext, configSchema, initialConfig)

		context.addDeleteOperation('b')
		expect(context.configObject.overrides).toEqual([
			...initialConfig.overrides.filter((op) => op.path !== 'b'),
			{ op: 'delete', path: 'b' } satisfies ObjectOverrideDeleteOp,
		])
	})

	test('Child property path', () => {
		const initialConfig = createComplexConfigBlob()
		const context = new FixUpBlueprintConfigContext(fakeCommonContext, configSchema, initialConfig)

		context.addDeleteOperation('obj.c')
		expect(context.configObject.overrides).toEqual([
			...initialConfig.overrides,
			{ op: 'delete', path: 'obj.c' } satisfies ObjectOverrideDeleteOp,
		])
	})

	test('Child property path with existing set operation', () => {
		const initialConfig = createComplexConfigBlob()
		const context = new FixUpBlueprintConfigContext(fakeCommonContext, configSchema, initialConfig)

		context.addDeleteOperation('obj.b')
		expect(context.configObject.overrides).toEqual([
			...initialConfig.overrides.filter((op) => op.path !== 'obj.b'),
			{ op: 'delete', path: 'obj.b' } satisfies ObjectOverrideDeleteOp,
		])
	})

	test('Fail to delete root of table', () => {
		const initialConfig = createComplexConfigBlob()
		const context = new FixUpBlueprintConfigContext(fakeCommonContext, configSchema, initialConfig)

		// Not allowed, as 'obj.a' is where the value should be set
		expect(() => context.addDeleteOperation('obj')).toThrow('does not exist')
	})

	test('Root of table array', () => {
		const initialConfig = createComplexConfigBlob()
		const context = new FixUpBlueprintConfigContext(fakeCommonContext, configSchema, initialConfig)

		context.addDeleteOperation('arr')
		expect(context.configObject.overrides).toEqual([
			...initialConfig.overrides.filter((op) => op.path !== 'arr'),
			{ op: 'delete', path: 'arr' } satisfies ObjectOverrideDeleteOp,
		])
	})

	test('Row inside of table array', () => {
		const initialConfig = createComplexConfigBlob()
		const context = new FixUpBlueprintConfigContext(fakeCommonContext, configSchema, initialConfig)

		context.addDeleteOperation('arr.1')
		expect(context.configObject.overrides).toEqual([
			...initialConfig.overrides.filter((op) => op.path !== 'arr'),
			{ op: 'set', path: 'arr', value: [6] } satisfies ObjectOverrideSetOp,
		])
	})

	test('Fail on root of table object', () => {
		const initialConfig = createComplexConfigBlob()
		const context = new FixUpBlueprintConfigContext(fakeCommonContext, configSchema, initialConfig)

		expect(() => context.addDeleteOperation('table')).toThrow('Cannot set')
	})

	test('Row of table object', () => {
		const initialConfig = createComplexConfigBlob()
		const context = new FixUpBlueprintConfigContext(fakeCommonContext, configSchema, initialConfig)

		context.addDeleteOperation('table.abc')
		expect(context.configObject.overrides).toEqual([
			...initialConfig.overrides,
			{ op: 'delete', path: 'table.abc' } satisfies ObjectOverrideDeleteOp,
		])
	})

	test('Value inside row of table object', () => {
		const initialConfig = createComplexConfigBlob()
		const context = new FixUpBlueprintConfigContext(fakeCommonContext, configSchema, initialConfig)

		context.addDeleteOperation('table.abc.number')
		expect(context.configObject.overrides).toEqual([
			...initialConfig.overrides,
			{ op: 'delete', path: 'table.abc.number' } satisfies ObjectOverrideDeleteOp,
		])
	})

	test('Replace row of table object', () => {
		const initialConfig = createComplexConfigBlob()
		const context = new FixUpBlueprintConfigContext(fakeCommonContext, configSchema, initialConfig)

		context.addDeleteOperation('table.c')
		expect(context.configObject.overrides).toEqual([
			...initialConfig.overrides.filter((op) => op.path !== 'table.c'),
			{ op: 'delete', path: 'table.c' } satisfies ObjectOverrideDeleteOp,
		])
	})
})

describe('removeOperations', () => {
	const fakeCommonContext: ICommonContext = null as any

	function getOverridePaths(config: ObjectWithOverrides<any>): string[] {
		return config.overrides.map((op) => op.path)
	}

	test('empty path', () => {
		const context = new FixUpBlueprintConfigContext(fakeCommonContext, {}, createComplexConfigBlob())

		const currentPaths = getOverridePaths(context.configObject)
		context.removeOperations('')
		expect(getOverridePaths(context.configObject)).toEqual(currentPaths)
	})

	test('path with no ops', () => {
		const context = new FixUpBlueprintConfigContext(fakeCommonContext, {}, createComplexConfigBlob())

		{
			const currentPaths = getOverridePaths(context.configObject)
			context.removeOperations('a')
			expect(getOverridePaths(context.configObject)).toEqual(currentPaths)
		}

		{
			const currentPaths = getOverridePaths(context.configObject)
			context.removeOperations('obj.a')
			expect(getOverridePaths(context.configObject)).toEqual(currentPaths)
		}
	})

	test('unmatched path', () => {
		const context = new FixUpBlueprintConfigContext(fakeCommonContext, {}, createComplexConfigBlob())

		const currentPaths = getOverridePaths(context.configObject)
		context.removeOperations('notreal')
		expect(getOverridePaths(context.configObject)).toEqual(currentPaths)
	})

	test('root level path', () => {
		const context = new FixUpBlueprintConfigContext(fakeCommonContext, {}, createComplexConfigBlob())

		const pathsToRemove = ['b']

		const currentPaths = getOverridePaths(context.configObject).filter((p) => !pathsToRemove.includes(p))
		context.removeOperations('b')
		expect(getOverridePaths(context.configObject)).toEqual(currentPaths)
	})

	test('root level path affects children', () => {
		const context = new FixUpBlueprintConfigContext(fakeCommonContext, {}, createComplexConfigBlob())

		const pathsToRemove = ['obj.b']

		const currentPaths = getOverridePaths(context.configObject).filter((p) => !pathsToRemove.includes(p))
		context.removeOperations('obj')
		expect(getOverridePaths(context.configObject)).toEqual(currentPaths)
	})

	test('nested path', () => {
		const context = new FixUpBlueprintConfigContext(fakeCommonContext, {}, createComplexConfigBlob())

		const pathsToRemove = ['obj.b']

		const currentPaths = getOverridePaths(context.configObject).filter((p) => !pathsToRemove.includes(p))
		context.removeOperations('obj.b')
		expect(getOverridePaths(context.configObject)).toEqual(currentPaths)
	})
})

describe('renameOperations', () => {
	const fakeCommonContext: ICommonContext = null as any

	function getOverridePaths(config: ObjectWithOverrides<any>): string[] {
		return config.overrides.map((op) => op.path)
	}

	test('empty path', () => {
		const context = new FixUpBlueprintConfigContext(fakeCommonContext, {}, createComplexConfigBlob())

		const currentPaths = getOverridePaths(context.configObject)
		context.renameOperations('', 'ab')
		expect(getOverridePaths(context.configObject)).toEqual(currentPaths)
	})

	test('path with no ops', () => {
		const context = new FixUpBlueprintConfigContext(fakeCommonContext, {}, createComplexConfigBlob())

		{
			const currentPaths = getOverridePaths(context.configObject)
			context.renameOperations('a', 'z')
			expect(getOverridePaths(context.configObject)).toEqual(currentPaths)
		}

		{
			const currentPaths = getOverridePaths(context.configObject)
			context.renameOperations('obj.a', 'z.z')
			expect(getOverridePaths(context.configObject)).toEqual(currentPaths)
		}
	})

	test('unmatched path', () => {
		const context = new FixUpBlueprintConfigContext(fakeCommonContext, {}, createComplexConfigBlob())

		const currentPaths = getOverridePaths(context.configObject)
		context.renameOperations('notreal', 'z')
		expect(getOverridePaths(context.configObject)).toEqual(currentPaths)
	})

	test('root level path', () => {
		const context = new FixUpBlueprintConfigContext(fakeCommonContext, {}, createComplexConfigBlob())

		const pathsToRemove = ['b']

		const currentPaths = getOverridePaths(context.configObject)
			.filter((p) => !pathsToRemove.includes(p))
			.concat('z')
		context.renameOperations('b', 'z')
		expect(getOverridePaths(context.configObject)).toEqual(currentPaths)
	})

	test('root level path affects children', () => {
		const context = new FixUpBlueprintConfigContext(fakeCommonContext, {}, createComplexConfigBlob())

		const pathsToRemove = ['obj.b']

		const currentPaths = getOverridePaths(context.configObject)
			.filter((p) => !pathsToRemove.includes(p))
			.concat('z.b')
		context.renameOperations('obj', 'z')
		expect(getOverridePaths(context.configObject)).toEqual(currentPaths)
	})

	test('nested path', () => {
		const context = new FixUpBlueprintConfigContext(fakeCommonContext, {}, createComplexConfigBlob())

		const pathsToRemove = ['obj.b']

		const currentPaths = getOverridePaths(context.configObject)
			.filter((p) => !pathsToRemove.includes(p))
			.concat('z')
		context.renameOperations('obj.b', 'z')
		expect(getOverridePaths(context.configObject)).toEqual(currentPaths)
	})
})

describe('warnUnfixable', () => {
	const fakeCommonContext: ICommonContext = null as any
	test('warnUnfixable', () => {
		const context = new FixUpBlueprintConfigContext(fakeCommonContext, {}, wrapDefaultObject({}))

		expect(context.messages).toHaveLength(0)

		context.warnUnfixable('MyPath', { key: 'Test message' })
		context.warnUnfixable('MyPath2', { key: 'Another message', args: { a: 1 } })

		expect(context.messages).toEqual([
			{
				message: {
					key: 'Test message',
				},
				path: 'MyPath',
			},
			{
				message: {
					key: 'Another message',
					args: { a: 1 },
				},
				path: 'MyPath2',
			},
		])
	})
})
