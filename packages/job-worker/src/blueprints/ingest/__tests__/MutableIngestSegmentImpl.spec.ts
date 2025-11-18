import { clone } from '@sofie-automation/corelib/dist/lib'
import { MutableIngestSegmentChanges, MutableIngestSegmentImpl } from '../MutableIngestSegmentImpl.js'
import { SofieIngestRundownDataCacheGenerator } from '../../../ingest/sofieIngestCache.js'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { getSegmentId } from '../../../ingest/lib.js'
import { MutableIngestPartImpl } from '../MutableIngestPartImpl.js'
import { IngestPart, IngestSegment, SofieIngestSegment } from '@sofie-automation/blueprints-integration'
import {
	SofieIngestCacheType,
	SofieIngestDataCacheObjPart,
} from '@sofie-automation/corelib/dist/dataModel/SofieIngestDataCache'

describe('MutableIngestSegmentImpl', () => {
	function getBasicIngestSegment(): SofieIngestSegment<any> {
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
			parts: [
				{
					externalId: 'part0',
					name: 'my first part',
					rank: 0,
					payload: {
						val: 'some-val',
					},
					userEditStates: {},
				},
				{
					externalId: 'part1',
					name: 'another part',
					rank: 1,
					payload: {
						val: 'second-val',
					},
					userEditStates: {},
				},
				{
					externalId: 'part2',
					name: 'third part',
					rank: 2,
					payload: {
						val: 'third-val',
					},
					userEditStates: {},
				},
				{
					externalId: 'part3',
					name: 'last part',
					rank: 3,
					payload: {
						val: 'last-val',
					},
					userEditStates: {},
				},
			],
		}
	}

	const ingestObjectGenerator = new SofieIngestRundownDataCacheGenerator(protectString('rundownId'))

	function createNoChangesObject(ingestSegment: SofieIngestSegment): MutableIngestSegmentChanges {
		return {
			ingestParts: ingestSegment.parts,
			changedCacheObjects: [],
			allCacheObjectIds: ingestSegment.parts.map((p) => ingestObjectGenerator.getPartObjectId(p.externalId)),
			segmentHasChanges: false,
			partIdsWithChanges: [],
			originalExternalId: ingestSegment.externalId,
		}
	}
	function removePartFromIngestSegment(ingestSegment: IngestSegment, partId: string): void {
		const ingestPart = ingestSegment.parts.find((p) => p.externalId === partId)
		ingestSegment.parts = ingestSegment.parts.filter((p) => p.externalId !== partId)
		if (ingestPart) {
			for (const part of ingestSegment.parts) {
				if (part.rank > ingestPart.rank) part.rank--
			}
		}
	}
	function getPartIdOrder(mutableSegment: MutableIngestSegmentImpl): string[] {
		return mutableSegment.parts.map((p) => p.externalId)
	}

	function pushAllPartsToChanges(
		expectedChanges: MutableIngestSegmentChanges,
		ingestSegment: SofieIngestSegment
	): void {
		const segmentId = getSegmentId(ingestObjectGenerator.rundownId, ingestSegment.externalId)
		for (const ingestPart of ingestSegment.parts) {
			expectedChanges.partIdsWithChanges.push(ingestPart.externalId)
			expectedChanges.changedCacheObjects.push(ingestObjectGenerator.generatePartObject(segmentId, ingestPart))
		}
	}

	test('create basic', () => {
		const ingestSegment = getBasicIngestSegment()
		const mutableSegment = new MutableIngestSegmentImpl(clone(ingestSegment))

		// compare properties
		expect(mutableSegment.externalId).toBe(ingestSegment.externalId)
		expect(mutableSegment.name).toBe(ingestSegment.name)
		expect(mutableSegment.payload).toEqual(ingestSegment.payload)
		expect(mutableSegment.parts.length).toBe(ingestSegment.parts.length)

		// check it has no changes
		expect(mutableSegment.intoChangesInfo(ingestObjectGenerator)).toEqual(createNoChangesObject(ingestSegment))
	})

	test('create basic with changes', () => {
		const ingestSegment = getBasicIngestSegment()
		const mutableSegment = new MutableIngestSegmentImpl(clone(ingestSegment), true)

		// compare properties
		expect(mutableSegment.externalId).toBe(ingestSegment.externalId)
		expect(mutableSegment.name).toBe(ingestSegment.name)
		expect(mutableSegment.payload).toEqual(ingestSegment.payload)
		expect(mutableSegment.parts.length).toBe(ingestSegment.parts.length)

		// check it has no changes
		const expectedChanges = createNoChangesObject(ingestSegment)
		expectedChanges.segmentHasChanges = true
		pushAllPartsToChanges(expectedChanges, ingestSegment)
		expect(mutableSegment.intoChangesInfo(ingestObjectGenerator)).toEqual(expectedChanges)

		// check changes have been cleared
		expect(mutableSegment.intoChangesInfo(ingestObjectGenerator)).toEqual(createNoChangesObject(ingestSegment))
	})

	test('set name', () => {
		const ingestSegment = getBasicIngestSegment()
		const mutableSegment = new MutableIngestSegmentImpl(clone(ingestSegment))

		// compare properties
		expect(mutableSegment.name).toBe(ingestSegment.name)
		expect(mutableSegment.intoChangesInfo(ingestObjectGenerator)).toEqual(createNoChangesObject(ingestSegment))

		mutableSegment.setName('new-name')
		expect(mutableSegment.name).toBe('new-name')

		// check it has changes
		const expectedChanges = createNoChangesObject(ingestSegment)
		expectedChanges.segmentHasChanges = true
		expect(mutableSegment.intoChangesInfo(ingestObjectGenerator)).toEqual(expectedChanges)
	})

	test('replace payload with change', () => {
		const ingestSegment = getBasicIngestSegment()
		const mutableSegment = new MutableIngestSegmentImpl(clone(ingestSegment))

		// compare properties
		expect(mutableSegment.payload).toEqual(ingestSegment.payload)
		expect(mutableSegment.intoChangesInfo(ingestObjectGenerator)).toEqual(createNoChangesObject(ingestSegment))

		const newPayload = { val: 'new-val' }
		mutableSegment.replacePayload(newPayload)
		expect(mutableSegment.payload).toEqual(newPayload)

		// check it has changes
		const expectedChanges = createNoChangesObject(ingestSegment)
		expectedChanges.segmentHasChanges = true
		expect(mutableSegment.intoChangesInfo(ingestObjectGenerator)).toEqual(expectedChanges)
	})

	test('replace payload with no change', () => {
		const ingestSegment = getBasicIngestSegment()
		const mutableSegment = new MutableIngestSegmentImpl(clone(ingestSegment))

		// compare properties
		expect(mutableSegment.payload).toEqual(ingestSegment.payload)
		expect(mutableSegment.intoChangesInfo(ingestObjectGenerator)).toEqual(createNoChangesObject(ingestSegment))

		mutableSegment.replacePayload(ingestSegment.payload)
		expect(mutableSegment.payload).toEqual(ingestSegment.payload)

		// check it has no changes
		expect(mutableSegment.intoChangesInfo(ingestObjectGenerator)).toEqual(createNoChangesObject(ingestSegment))
	})

	test('set payload property change', () => {
		const ingestSegment = getBasicIngestSegment()
		const mutableSegment = new MutableIngestSegmentImpl<any>(clone(ingestSegment))

		// compare properties
		expect(mutableSegment.payload).toEqual(ingestSegment.payload)
		expect(mutableSegment.intoChangesInfo(ingestObjectGenerator)).toEqual(createNoChangesObject(ingestSegment))

		const newPayload = { ...ingestSegment.payload, test: 123, second: undefined }
		mutableSegment.setPayloadProperty('test', 123)
		mutableSegment.setPayloadProperty('second', undefined)
		expect(mutableSegment.payload).toEqual(newPayload)

		// check it has changes
		const expectedChanges = createNoChangesObject(ingestSegment)
		expectedChanges.segmentHasChanges = true
		expect(mutableSegment.intoChangesInfo(ingestObjectGenerator)).toEqual(expectedChanges)
	})

	test('set payload property unchanged', () => {
		const ingestSegment = getBasicIngestSegment()
		const mutableSegment = new MutableIngestSegmentImpl<any>(clone(ingestSegment))

		// compare properties
		expect(mutableSegment.payload).toEqual(ingestSegment.payload)
		expect(mutableSegment.intoChangesInfo(ingestObjectGenerator)).toEqual(createNoChangesObject(ingestSegment))

		mutableSegment.setPayloadProperty('val', ingestSegment.payload.val)
		mutableSegment.setPayloadProperty('another', undefined)
		expect(mutableSegment.payload).toEqual(ingestSegment.payload)

		// check it has no changes
		expect(mutableSegment.intoChangesInfo(ingestObjectGenerator)).toEqual(createNoChangesObject(ingestSegment))
	})

	test('set user edit state change', () => {
		const ingestSegment = getBasicIngestSegment()
		const mutableSegment = new MutableIngestSegmentImpl<any>(clone(ingestSegment))

		// compare properties
		expect(mutableSegment.userEditStates).toEqual(ingestSegment.userEditStates)
		expect(mutableSegment.intoChangesInfo(ingestObjectGenerator)).toEqual(createNoChangesObject(ingestSegment))

		const newUserEditStates = { ...ingestSegment.userEditStates, two: true, another: false }
		mutableSegment.setUserEditState('two', true)
		mutableSegment.setUserEditState('another', false)
		expect(mutableSegment.userEditStates).toEqual(newUserEditStates)

		// check it has changes
		const expectedChanges = createNoChangesObject(ingestSegment)
		expectedChanges.segmentHasChanges = true
		expect(mutableSegment.intoChangesInfo(ingestObjectGenerator)).toEqual(expectedChanges)
	})

	test('set user edit state unchanged', () => {
		const ingestSegment = getBasicIngestSegment()
		const mutableSegment = new MutableIngestSegmentImpl<any>(clone(ingestSegment))

		// compare properties
		expect(mutableSegment.userEditStates).toEqual(ingestSegment.userEditStates)
		expect(mutableSegment.intoChangesInfo(ingestObjectGenerator)).toEqual(createNoChangesObject(ingestSegment))

		mutableSegment.setUserEditState('one', true)
		mutableSegment.setUserEditState('two', false)
		expect(mutableSegment.userEditStates).toEqual(ingestSegment.userEditStates)

		// check it has changes
		expect(mutableSegment.intoChangesInfo(ingestObjectGenerator)).toEqual(createNoChangesObject(ingestSegment))
	})

	test('get parts', () => {
		const ingestSegment = getBasicIngestSegment()
		const mutableSegment = new MutableIngestSegmentImpl(clone(ingestSegment))

		// compare properties
		expect(mutableSegment.parts.length).toBe(ingestSegment.parts.length)
		expect(mutableSegment.getPart('part0')).toStrictEqual(mutableSegment.parts[0])
		expect(mutableSegment.getPart('part0') instanceof MutableIngestPartImpl).toBe(true)
		expect(mutableSegment.getPart('part1')).toStrictEqual(mutableSegment.parts[1])
		expect(mutableSegment.getPart('part1') instanceof MutableIngestPartImpl).toBe(true)
		expect(mutableSegment.getPart('part2')).toStrictEqual(mutableSegment.parts[2])
		expect(mutableSegment.getPart('part2') instanceof MutableIngestPartImpl).toBe(true)
		expect(mutableSegment.getPart('part3')).toStrictEqual(mutableSegment.parts[3])
		expect(mutableSegment.getPart('part3') instanceof MutableIngestPartImpl).toBe(true)
		expect(mutableSegment.getPart('part4')).toBeUndefined()

		expect(mutableSegment.intoChangesInfo(ingestObjectGenerator)).toEqual(createNoChangesObject(ingestSegment))
	})

	describe('removePart', () => {
		test('good', () => {
			const ingestSegment = getBasicIngestSegment()
			const mutableSegment = new MutableIngestSegmentImpl(clone(ingestSegment))

			expect(mutableSegment.removePart('part1')).toBeTruthy()

			// compare properties
			expect(mutableSegment.parts.length).toBe(3)
			expect(mutableSegment.getPart('part1')).toBeUndefined()

			// check it has changes
			const expectedIngestSegment = clone(ingestSegment)
			removePartFromIngestSegment(expectedIngestSegment, 'part1')
			const expectedChanges = createNoChangesObject(expectedIngestSegment)
			pushAllPartsToChanges(expectedChanges, expectedIngestSegment)
			expect(mutableSegment.intoChangesInfo(ingestObjectGenerator)).toEqual(expectedChanges)

			// try removing a second time
			expect(mutableSegment.removePart('part1')).toBeFalsy()
			expect(mutableSegment.intoChangesInfo(ingestObjectGenerator)).toEqual(
				createNoChangesObject(expectedIngestSegment)
			)
		})

		test('unknown id', () => {
			const ingestSegment = getBasicIngestSegment()
			const mutableSegment = new MutableIngestSegmentImpl(clone(ingestSegment))

			expect(mutableSegment.removePart('partX')).toBeFalsy()

			// compare properties
			expect(mutableSegment.parts.length).toBe(ingestSegment.parts.length)

			// ensure no changes
			expect(mutableSegment.intoChangesInfo(ingestObjectGenerator)).toEqual(createNoChangesObject(ingestSegment))
		})
	})

	test('forceRegenerate', () => {
		const ingestSegment = getBasicIngestSegment()
		const mutableSegment = new MutableIngestSegmentImpl(clone(ingestSegment))

		// ensure no changes
		expect(mutableSegment.intoChangesInfo(ingestObjectGenerator)).toEqual(createNoChangesObject(ingestSegment))

		mutableSegment.forceRegenerate()

		// check it has changes
		const expectedChanges = createNoChangesObject(ingestSegment)
		expectedChanges.segmentHasChanges = true
		expect(mutableSegment.intoChangesInfo(ingestObjectGenerator)).toEqual(expectedChanges)
	})

	describe('replacePart', () => {
		test('replace existing with a move', () => {
			const ingestSegment = getBasicIngestSegment()
			const mutableSegment = new MutableIngestSegmentImpl(clone(ingestSegment))

			expect(mutableSegment.getPart('part1')).toBeDefined()
			expect(getPartIdOrder(mutableSegment)).toEqual(['part0', 'part1', 'part2', 'part3'])

			const newPart: Omit<IngestPart, 'rank'> = {
				externalId: 'part1',
				name: 'new name',
				payload: {
					val: 'new-val',
				},
			}
			const replacedPart = mutableSegment.replacePart(newPart, null)
			expect(replacedPart).toBeDefined()
			// ensure the inserted part looks correct
			expect(replacedPart?.externalId).toBe(newPart.externalId)
			expect(replacedPart?.name).toBe(newPart.name)
			expect(replacedPart?.payload).toEqual(newPart.payload)

			// check it has changes
			expect(getPartIdOrder(mutableSegment)).toEqual(['part0', 'part2', 'part3', 'part1'])
			const expectedIngestSegment = clone(ingestSegment)
			removePartFromIngestSegment(expectedIngestSegment, 'part1')
			expectedIngestSegment.parts.push({ ...newPart, rank: 3, userEditStates: {} })

			const expectedChanges = createNoChangesObject(expectedIngestSegment)
			pushAllPartsToChanges(expectedChanges, expectedIngestSegment)
			const generatedCacheObject = expectedChanges.changedCacheObjects.find(
				(o): o is SofieIngestDataCacheObjPart =>
					o.type === SofieIngestCacheType.PART && o.data.externalId === 'part1'
			)
			expect(generatedCacheObject).toBeDefined()
			expect(generatedCacheObject?.data.rank).toBe(3)

			expect(mutableSegment.intoChangesInfo(ingestObjectGenerator)).toEqual(expectedChanges)
		})

		test('insert new', () => {
			const ingestSegment = getBasicIngestSegment()
			const mutableSegment = new MutableIngestSegmentImpl(clone(ingestSegment))

			expect(mutableSegment.getPart('partX')).toBeUndefined()
			expect(getPartIdOrder(mutableSegment)).toEqual(['part0', 'part1', 'part2', 'part3'])

			const newPart: Omit<IngestPart, 'rank'> = {
				externalId: 'partX',
				name: 'new name',
				payload: {
					val: 'new-val',
				},
			}
			const replacedPart = mutableSegment.replacePart(newPart, null)
			expect(replacedPart).toBeDefined()
			// ensure the inserted part looks correct
			expect(replacedPart?.externalId).toBe(newPart.externalId)
			expect(replacedPart?.name).toBe(newPart.name)
			expect(replacedPart?.payload).toEqual(newPart.payload)

			// check it has changes
			expect(getPartIdOrder(mutableSegment)).toEqual(['part0', 'part1', 'part2', 'part3', 'partX'])
			const expectedIngestSegment = clone(ingestSegment)
			expectedIngestSegment.parts.push({ ...newPart, rank: 4, userEditStates: {} })

			const expectedChanges = createNoChangesObject(expectedIngestSegment)
			expectedChanges.partIdsWithChanges.push('partX')
			expectedChanges.changedCacheObjects.push(
				ingestObjectGenerator.generatePartObject(
					getSegmentId(ingestObjectGenerator.rundownId, ingestSegment.externalId),
					{ ...newPart, rank: 4, userEditStates: {} }
				)
			)

			expect(mutableSegment.intoChangesInfo(ingestObjectGenerator)).toEqual(expectedChanges)
		})

		test('insert at position', () => {
			const ingestSegment = getBasicIngestSegment()
			const mutableSegment = new MutableIngestSegmentImpl(clone(ingestSegment))

			expect(mutableSegment.getPart('partX')).toBeUndefined()
			expect(getPartIdOrder(mutableSegment)).toEqual(['part0', 'part1', 'part2', 'part3'])

			const newPart: Omit<IngestPart, 'rank'> = {
				externalId: 'partX',
				name: 'new name',
				payload: {
					val: 'new-val',
				},
			}

			// insert at the end
			expect(mutableSegment.replacePart(newPart, null)).toBeDefined()
			expect(getPartIdOrder(mutableSegment)).toEqual(['part0', 'part1', 'part2', 'part3', 'partX'])

			// insert at the beginning
			expect(mutableSegment.replacePart(newPart, 'part0')).toBeDefined()
			expect(getPartIdOrder(mutableSegment)).toEqual(['partX', 'part0', 'part1', 'part2', 'part3'])

			// insert in the middle
			expect(mutableSegment.replacePart(newPart, 'part2')).toBeDefined()
			expect(getPartIdOrder(mutableSegment)).toEqual(['part0', 'part1', 'partX', 'part2', 'part3'])

			// All should report changes because of their rank property
			expect(mutableSegment.intoChangesInfo(ingestObjectGenerator).partIdsWithChanges).toEqual([
				'part0',
				'part1',
				'partX',
				'part2',
				'part3',
			])

			// Try inserting before itself
			expect(() => mutableSegment.replacePart(newPart, newPart.externalId)).toThrow(
				/Cannot insert Part before itself/
			)

			// Try inserting before an unknown part
			expect(() => mutableSegment.replacePart(newPart, 'partY')).toThrow(/Part(.*)not found/)
		})
	})

	describe('movePartBefore', () => {
		test('move unknown', () => {
			const ingestSegment = getBasicIngestSegment()
			const mutableSegment = new MutableIngestSegmentImpl(clone(ingestSegment))

			expect(mutableSegment.getPart('partX')).toBeUndefined()
			expect(getPartIdOrder(mutableSegment)).toEqual(['part0', 'part1', 'part2', 'part3'])

			expect(() => mutableSegment.movePartBefore('partX', null)).toThrow(/Part(.*)not found/)
			expect(getPartIdOrder(mutableSegment)).toEqual(['part0', 'part1', 'part2', 'part3'])
		})

		test('move to position', () => {
			const ingestSegment = getBasicIngestSegment()
			const mutableSegment = new MutableIngestSegmentImpl(clone(ingestSegment))

			expect(getPartIdOrder(mutableSegment)).toEqual(['part0', 'part1', 'part2', 'part3'])

			// insert at the end
			mutableSegment.movePartBefore('part1', null)
			expect(getPartIdOrder(mutableSegment)).toEqual(['part0', 'part2', 'part3', 'part1'])

			// insert at the beginning
			mutableSegment.movePartBefore('part1', 'part0')
			expect(getPartIdOrder(mutableSegment)).toEqual(['part1', 'part0', 'part2', 'part3'])

			// insert in the middle
			mutableSegment.movePartBefore('part1', 'part2')
			expect(getPartIdOrder(mutableSegment)).toEqual(['part0', 'part1', 'part2', 'part3'])

			// Only the one should have changes
			const expectedChanges = createNoChangesObject(ingestSegment)
			pushAllPartsToChanges(expectedChanges, ingestSegment)
			expect(mutableSegment.intoChangesInfo(ingestObjectGenerator)).toEqual(expectedChanges)

			// Try inserting before itself
			expect(() => mutableSegment.movePartBefore('part1', 'part1')).toThrow(/Cannot move Part before itself/)

			// Try inserting before an unknown part
			expect(() => mutableSegment.movePartBefore('part1', 'partY')).toThrow(/Part(.*)not found/)
		})
	})

	describe('movePartAfter', () => {
		test('move unknown', () => {
			const ingestSegment = getBasicIngestSegment()
			const mutableSegment = new MutableIngestSegmentImpl(clone(ingestSegment))

			expect(mutableSegment.getPart('partX')).toBeUndefined()
			expect(getPartIdOrder(mutableSegment)).toEqual(['part0', 'part1', 'part2', 'part3'])

			expect(() => mutableSegment.movePartAfter('partX', null)).toThrow(/Part(.*)not found/)
			expect(getPartIdOrder(mutableSegment)).toEqual(['part0', 'part1', 'part2', 'part3'])
		})

		test('move to position', () => {
			const ingestSegment = getBasicIngestSegment()
			const mutableSegment = new MutableIngestSegmentImpl(clone(ingestSegment))

			expect(getPartIdOrder(mutableSegment)).toEqual(['part0', 'part1', 'part2', 'part3'])

			// insert at the beginning
			mutableSegment.movePartAfter('part1', null)
			expect(getPartIdOrder(mutableSegment)).toEqual(['part1', 'part0', 'part2', 'part3'])

			// insert at the end
			mutableSegment.movePartAfter('part1', 'part3')
			expect(getPartIdOrder(mutableSegment)).toEqual(['part0', 'part2', 'part3', 'part1'])

			// insert in the middle
			mutableSegment.movePartAfter('part1', 'part0')
			expect(getPartIdOrder(mutableSegment)).toEqual(['part0', 'part1', 'part2', 'part3'])

			// All the parts should be reported as having changed
			const expectedChanges = createNoChangesObject(ingestSegment)
			pushAllPartsToChanges(expectedChanges, ingestSegment)
			expect(mutableSegment.intoChangesInfo(ingestObjectGenerator)).toEqual(expectedChanges)

			// Try inserting before itself
			expect(() => mutableSegment.movePartAfter('part1', 'part1')).toThrow(/Cannot move Part after itself/)

			// Try inserting before an unknown part
			expect(() => mutableSegment.movePartAfter('part1', 'partY')).toThrow(/Part(.*)not found/)
		})
	})
})
