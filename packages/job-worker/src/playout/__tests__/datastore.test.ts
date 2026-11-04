/* eslint-disable @typescript-eslint/unbound-method */
import { DatastorePersistenceMode } from '@sofie-automation/shared-lib/dist/core/model/TimelineDatastore'
import { mock } from 'jest-mock-extended'
import { MockJobContext, setupDefaultJobEnvironment } from '../../__mocks__/context.js'
import { ActionExecutionContext } from '../../blueprints/context/adlibActions.js'
import { RundownActivationContext } from '../../blueprints/context/RundownActivationContext.js'
import { assertValidTimelineDatastoreValue, setTimelineDatastoreValue } from '../datastore.js'
import { PlayoutModel } from '../model/PlayoutModel.js'

/**
 * Values with field names that MongoDB stores, but which the UI can't receive.
 * See `packages/webui/src/meteor/__tests__/hostileFieldNames.test.ts`
 */
const invalidValues: Array<[string, unknown, string]> = [
	['dotted field name', { 'a.b': 1 }, 'a.b'],
	['field name that is only a dot', { '.': 1 }, '.'],
	['nested dotted field name', { x: { 'y.z': 1 } }, 'y.z'],
	['dotted field name inside an array', [{ 'a.b': 1 }], 'a.b'],
	['$-prefixed field name', { $foo: 1 }, '$foo'],
	['field name that is only $', { $: 1 }, '$'],
	['nested $-prefixed field name', { x: { $foo: 1 } }, '$foo'],
	['mongo update operator lookalike', { $set: { a: 1 } }, '$set'],
	['$-prefixed field name inside an array', [{ $foo: 1 }], '$foo'],
	['EJSON $date lookalike', { $date: 0 }, '$date'],
	['field name with a null byte', { 'a\0b': 1 }, 'a\0b'],
]

const validValues: Array<[string, unknown]> = [
	['string containing a dot', 'a.b'],
	['string starting with $', '$foo'],
	['number', 42],
	['boolean', false],
	['null', null],
	['nested object', { a: { b: [1, { c: 'd.e' }] } }],
	['field name with $ in the middle', { a$b: 1 }],
	['array of primitives', ['a.b', '$c', 1]],
]

describe('assertValidTimelineDatastoreValue', () => {
	test.each(invalidValues)('rejects a %s', (_name, value, fieldName) => {
		expect(() => assertValidTimelineDatastoreValue('myKey', value)).toThrow(
			`Timeline datastore value for key "myKey" has an invalid field name "${fieldName}"`
		)
	})

	test.each(validValues)('accepts a %s', (_name, value) => {
		expect(() => assertValidTimelineDatastoreValue('myKey', value)).not.toThrow()
	})
})

describe('setTimelineDatastoreValue', () => {
	let context: MockJobContext
	beforeEach(() => {
		context = setupDefaultJobEnvironment()
	})

	test.each(invalidValues)('does not store a %s', async (_name, value) => {
		await expect(
			setTimelineDatastoreValue(context, 'myKey', value, DatastorePersistenceMode.Temporary)
		).rejects.toThrow('invalid field name')

		expect(await context.mockCollections.TimelineDatastores.findFetch({})).toHaveLength(0)
	})

	test.each(invalidValues)('does not replace an existing value with a %s', async (_name, value) => {
		await setTimelineDatastoreValue(context, 'myKey', 'before', DatastorePersistenceMode.Temporary)

		await expect(
			setTimelineDatastoreValue(context, 'myKey', value, DatastorePersistenceMode.Temporary)
		).rejects.toThrow('invalid field name')

		const docs = await context.mockCollections.TimelineDatastores.findFetch({})
		expect(docs.map((d) => d.value)).toEqual(['before'])
	})

	test.each(validValues)('stores a %s', async (_name, value) => {
		await setTimelineDatastoreValue(context, 'myKey', value, DatastorePersistenceMode.Temporary)

		const docs = await context.mockCollections.TimelineDatastores.findFetch({})
		expect(docs.map((d) => d.value)).toEqual([value])
	})
})

describe('blueprint contexts that defer the write until after save', () => {
	const [, invalidValue] = invalidValues[0]

	test.each([
		['ActionExecutionContext', ActionExecutionContext],
		['RundownActivationContext', RundownActivationContext],
	])('%s rejects an invalid value immediately', async (_name, contextClass) => {
		const playoutModel = mock<PlayoutModel>()
		// Skip the constructor, as it needs a lot of state that isn't relevant here
		const blueprintContext: ActionExecutionContext | RundownActivationContext = Object.create(
			contextClass.prototype
		)
		Object.assign(blueprintContext, { _playoutModel: playoutModel, _context: setupDefaultJobEnvironment() })

		await expect(
			blueprintContext.setTimelineDatastoreValue('myKey', invalidValue, DatastorePersistenceMode.Temporary)
		).rejects.toThrow('invalid field name')
		expect(playoutModel.deferAfterSave).not.toHaveBeenCalled()
	})

	test.each([
		['ActionExecutionContext', ActionExecutionContext],
		['RundownActivationContext', RundownActivationContext],
	])('%s still defers a valid value', async (_name, contextClass) => {
		const playoutModel = mock<PlayoutModel>()
		const blueprintContext: ActionExecutionContext | RundownActivationContext = Object.create(
			contextClass.prototype
		)
		Object.assign(blueprintContext, { _playoutModel: playoutModel, _context: setupDefaultJobEnvironment() })

		await blueprintContext.setTimelineDatastoreValue('myKey', { a: 1 }, DatastorePersistenceMode.Temporary)
		expect(playoutModel.deferAfterSave).toHaveBeenCalledTimes(1)
	})
})
