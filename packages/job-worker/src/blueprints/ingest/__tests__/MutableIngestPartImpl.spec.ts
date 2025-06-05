import { SofieIngestPart } from '@sofie-automation/blueprints-integration'
import { MutableIngestPartImpl } from '../MutableIngestPartImpl.js'
import { clone } from '@sofie-automation/corelib/dist/lib'

describe('MutableIngestPartImpl', () => {
	function getBasicIngestPart(): SofieIngestPart<any> {
		return {
			externalId: 'externalId',
			name: 'name',
			rank: 0,
			payload: {
				val: 'some-val',
				second: 5,
			},
			userEditStates: {
				one: true,
				two: false,
			},
		}
	}

	test('create basic', () => {
		const ingestPart = getBasicIngestPart()
		const mutablePart = new MutableIngestPartImpl(clone(ingestPart))

		// compare properties
		expect(mutablePart.externalId).toBe(ingestPart.externalId)
		expect(mutablePart.name).toBe(ingestPart.name)
		expect(mutablePart.payload).toEqual(ingestPart.payload)

		// check it has no changes
		expect(mutablePart.checkAndClearChangesFlags()).toBe(false)
	})

	test('create basic with changes', () => {
		const ingestPart = getBasicIngestPart()
		const mutablePart = new MutableIngestPartImpl(clone(ingestPart), true)

		// compare properties
		expect(mutablePart.externalId).toBe(ingestPart.externalId)
		expect(mutablePart.name).toBe(ingestPart.name)
		expect(mutablePart.payload).toEqual(ingestPart.payload)

		// check it has changes
		expect(mutablePart.checkAndClearChangesFlags()).toBe(true)

		// check flag has been cleared
		expect(mutablePart.checkAndClearChangesFlags()).toBe(false)
	})

	test('set name', () => {
		const ingestPart = getBasicIngestPart()
		const mutablePart = new MutableIngestPartImpl(clone(ingestPart))

		// compare properties
		expect(mutablePart.name).toBe(ingestPart.name)
		expect(mutablePart.checkAndClearChangesFlags()).toBe(false)

		mutablePart.setName('new-name')
		expect(mutablePart.name).toBe('new-name')

		// check it has changes
		expect(mutablePart.checkAndClearChangesFlags()).toBe(true)
	})

	test('replace payload with change', () => {
		const ingestPart = getBasicIngestPart()
		const mutablePart = new MutableIngestPartImpl(clone(ingestPart))

		// compare properties
		expect(mutablePart.payload).toEqual(ingestPart.payload)
		expect(mutablePart.checkAndClearChangesFlags()).toBe(false)

		const newPayload = { val: 'new-val' }
		mutablePart.replacePayload(newPayload)
		expect(mutablePart.payload).toEqual(newPayload)

		// check it has changes
		expect(mutablePart.checkAndClearChangesFlags()).toBe(true)
	})

	test('replace payload with no change', () => {
		const ingestPart = getBasicIngestPart()
		const mutablePart = new MutableIngestPartImpl(clone(ingestPart))

		// compare properties
		expect(mutablePart.payload).toEqual(ingestPart.payload)
		expect(mutablePart.checkAndClearChangesFlags()).toBe(false)

		mutablePart.replacePayload(ingestPart.payload)
		expect(mutablePart.payload).toEqual(ingestPart.payload)

		// check it has no changes
		expect(mutablePart.checkAndClearChangesFlags()).toBe(false)
	})

	test('set payload property change', () => {
		const ingestPart = getBasicIngestPart()
		const mutablePart = new MutableIngestPartImpl<any>(clone(ingestPart))

		// compare properties
		expect(mutablePart.payload).toEqual(ingestPart.payload)
		expect(mutablePart.checkAndClearChangesFlags()).toBe(false)

		const newPayload = { ...ingestPart.payload, test: 123, second: undefined }
		mutablePart.setPayloadProperty('test', 123)
		mutablePart.setPayloadProperty('second', undefined)
		expect(mutablePart.payload).toEqual(newPayload)

		// check it has changes
		expect(mutablePart.checkAndClearChangesFlags()).toBe(true)
	})

	test('set payload property unchanged', () => {
		const ingestPart = getBasicIngestPart()
		const mutablePart = new MutableIngestPartImpl<any>(clone(ingestPart))

		// compare properties
		expect(mutablePart.payload).toEqual(ingestPart.payload)
		expect(mutablePart.checkAndClearChangesFlags()).toBe(false)

		mutablePart.setPayloadProperty('val', ingestPart.payload.val)
		mutablePart.setPayloadProperty('another', undefined)
		expect(mutablePart.payload).toEqual(ingestPart.payload)

		// check it has changes
		expect(mutablePart.checkAndClearChangesFlags()).toBe(false)
	})

	test('set user edit state change', () => {
		const ingestPart = getBasicIngestPart()
		const mutablePart = new MutableIngestPartImpl<any>(clone(ingestPart))

		// compare properties
		expect(mutablePart.userEditStates).toEqual(ingestPart.userEditStates)
		expect(mutablePart.checkAndClearChangesFlags()).toBe(false)

		const newUserEditStates = { ...ingestPart.userEditStates, two: true, another: false }
		mutablePart.setUserEditState('two', true)
		mutablePart.setUserEditState('another', false)
		expect(mutablePart.userEditStates).toEqual(newUserEditStates)

		// check it has changes
		expect(mutablePart.checkAndClearChangesFlags()).toBe(true)
	})

	test('set user edit state unchanged', () => {
		const ingestPart = getBasicIngestPart()
		const mutablePart = new MutableIngestPartImpl<any>(clone(ingestPart))

		// compare properties
		expect(mutablePart.userEditStates).toEqual(ingestPart.userEditStates)
		expect(mutablePart.checkAndClearChangesFlags()).toBe(false)

		mutablePart.setUserEditState('one', true)
		mutablePart.setUserEditState('two', false)
		expect(mutablePart.userEditStates).toEqual(ingestPart.userEditStates)

		// check it has changes
		expect(mutablePart.checkAndClearChangesFlags()).toBe(false)
	})
})
