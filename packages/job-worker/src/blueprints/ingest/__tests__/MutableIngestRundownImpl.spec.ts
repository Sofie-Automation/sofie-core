import { clone } from '@sofie-automation/corelib/dist/lib'
import { MutableIngestRundownChanges, MutableIngestRundownImpl } from '../MutableIngestRundownImpl.js'
import { SofieIngestRundownDataCacheGenerator } from '../../../ingest/sofieIngestCache.js'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { getSegmentId } from '../../../ingest/lib.js'
import { SofieIngestDataCacheObjId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { MutableIngestSegmentImpl } from '../MutableIngestSegmentImpl.js'
import { IngestRundown, IngestSegment, SofieIngestSegment } from '@sofie-automation/blueprints-integration'
import { SofieIngestRundownWithSource } from '@sofie-automation/corelib/dist/dataModel/SofieIngestDataCache'

describe('MutableIngestRundownImpl', () => {
	function getBasicIngestRundown(): SofieIngestRundownWithSource<any> {
		return {
			externalId: 'rundown0',
			type: 'mock',
			name: 'rundown-name',
			payload: {
				val: 'some-val',
				second: 5,
			},
			userEditStates: {
				one: true,
				two: false,
			},
			rundownSource: { type: 'http' },
			segments: [
				{
					externalId: 'seg0',
					name: 'name',
					rank: 0,
					isHidden: false,
					timing: {
						expectedStart: 0,
						expectedEnd: 0,
					},
					payload: {
						val: 'first-val',
						second: 5,
					},
					userEditStates: {},
					parts: [
						{
							externalId: 'part0',
							name: 'my first part',
							rank: 0,
							float: false,
							autoNext: false,
							payload: {
								val: 'some-val',
							},
							userEditStates: {},
						},
					],
				},
				{
					externalId: 'seg1',
					name: 'name 2',
					rank: 1,
					isHidden: false,
					timing: {
						expectedStart: 0,
						expectedEnd: 0,
					},
					payload: {
						val: 'next-val',
					},
					userEditStates: {},
					parts: [
						{
							externalId: 'part1',
							name: 'my second part',
							rank: 0,
							float: false,
							autoNext: false,
							payload: {
								val: 'some-val',
							},
							userEditStates: {},
						},
					],
				},
				{
					externalId: 'seg2',
					name: 'name 3',
					rank: 2,
					isHidden: false,
					timing: {
						expectedStart: 0,
						expectedEnd: 0,
					},
					payload: {
						val: 'last-val',
					},
					userEditStates: {},
					parts: [
						{
							externalId: 'part2',
							name: 'my third part',
							rank: 0,
							float: false,
							autoNext: false,
							payload: {
								val: 'some-val',
							},
							userEditStates: {},
						},
					],
				},
			],
		}
	}

	const ingestObjectGenerator = new SofieIngestRundownDataCacheGenerator(protectString('rundownId'))

	function createNoChangesObject(ingestRundown: SofieIngestRundownWithSource): MutableIngestRundownChanges {
		const allCacheObjectIds: SofieIngestDataCacheObjId[] = []
		for (const segment of ingestRundown.segments) {
			allCacheObjectIds.push(ingestObjectGenerator.getSegmentObjectId(segment.externalId))
			for (const part of segment.parts) {
				allCacheObjectIds.push(ingestObjectGenerator.getPartObjectId(part.externalId))
			}
		}
		allCacheObjectIds.push(ingestObjectGenerator.getRundownObjectId())

		return {
			computedChanges: {
				ingestRundown,

				segmentsToRemove: [],
				segmentsUpdatedRanks: {},
				segmentsToRegenerate: [],
				regenerateRundown: false,

				segmentExternalIdChanges: {},
			},
			changedCacheObjects: [],
			allCacheObjectIds: allCacheObjectIds,
		}
	}

	function addChangedSegments(
		changes: MutableIngestRundownChanges,
		_ingestRundown: IngestRundown,
		...ingestSegments: SofieIngestSegment[]
	): void {
		for (const ingestSegment of ingestSegments) {
			const segmentId = getSegmentId(ingestObjectGenerator.rundownId, ingestSegment.externalId)

			changes.computedChanges.segmentsToRegenerate.push(ingestSegment)

			for (const part of ingestSegment.parts) {
				changes.changedCacheObjects.push(ingestObjectGenerator.generatePartObject(segmentId, part))
			}

			changes.changedCacheObjects.push(ingestObjectGenerator.generateSegmentObject(ingestSegment))
		}
	}
	function addChangedRankSegments(
		changes: MutableIngestRundownChanges,
		_ingestRundown: IngestRundown,
		...ingestSegments: SofieIngestSegment[]
	): void {
		for (const ingestSegment of ingestSegments) {
			changes.changedCacheObjects.push(ingestObjectGenerator.generateSegmentObject(ingestSegment))
		}
	}
	function addChangedRundown(changes: MutableIngestRundownChanges): void {
		changes.computedChanges.regenerateRundown = true
		changes.changedCacheObjects.push(
			ingestObjectGenerator.generateRundownObject(changes.computedChanges.ingestRundown)
		)
	}
	function removeSegmentFromIngestRundown(ingestRundown: IngestRundown, segmentId: string): void {
		const ingestSegment = ingestRundown.segments.find((p) => p.externalId === segmentId)
		ingestRundown.segments = ingestRundown.segments.filter((p) => p.externalId !== segmentId)
		if (ingestSegment) {
			for (const part of ingestRundown.segments) {
				if (part.rank > ingestSegment.rank) part.rank--
			}
		}
	}
	function getSegmentIdOrder(mutableRundown: MutableIngestRundownImpl): string[] {
		return mutableRundown.segments.map((p) => p.externalId)
	}
	function getSegmentOriginalIdOrder(mutableRundown: MutableIngestRundownImpl): Array<string | undefined> {
		return mutableRundown.segments.map((p) => p.originalExternalId)
	}

	test('create basic', () => {
		const ingestRundown = getBasicIngestRundown()
		const mutableRundown = new MutableIngestRundownImpl(clone(ingestRundown), true)

		// compare properties
		expect(mutableRundown.externalId).toBe(ingestRundown.externalId)
		expect(mutableRundown.name).toBe(ingestRundown.name)
		expect(mutableRundown.payload).toEqual(ingestRundown.payload)
		expect(mutableRundown.segments.length).toBe(ingestRundown.segments.length)

		// check it has no changes
		expect(mutableRundown.intoIngestRundown(ingestObjectGenerator)).toEqual(createNoChangesObject(ingestRundown))
	})

	test('create basic with changes', () => {
		const ingestRundown = getBasicIngestRundown()
		const mutableRundown = new MutableIngestRundownImpl(clone(ingestRundown), false)

		// compare properties
		expect(mutableRundown.externalId).toBe(ingestRundown.externalId)
		expect(mutableRundown.name).toBe(ingestRundown.name)
		expect(mutableRundown.payload).toEqual(ingestRundown.payload)
		expect(mutableRundown.segments.length).toBe(ingestRundown.segments.length)

		// check it has changes
		const expectedChanges = createNoChangesObject(ingestRundown)
		addChangedSegments(expectedChanges, ingestRundown, ...ingestRundown.segments)
		addChangedRundown(expectedChanges)
		expect(mutableRundown.intoIngestRundown(ingestObjectGenerator)).toEqual(expectedChanges)

		// check changes have been cleared
		expect(mutableRundown.intoIngestRundown(ingestObjectGenerator)).toEqual(createNoChangesObject(ingestRundown))
	})

	test('set name', () => {
		const ingestRundown = getBasicIngestRundown()
		const mutableRundown = new MutableIngestRundownImpl(clone(ingestRundown), true)

		// compare properties
		expect(mutableRundown.name).toBe(ingestRundown.name)
		expect(mutableRundown.intoIngestRundown(ingestObjectGenerator)).toEqual(createNoChangesObject(ingestRundown))

		mutableRundown.setName('new-name')
		expect(mutableRundown.name).toBe('new-name')

		// check it has changes
		const expectedChanges = createNoChangesObject(clone(ingestRundown))
		expectedChanges.computedChanges.ingestRundown.name = 'new-name'
		addChangedRundown(expectedChanges)
		expect(mutableRundown.intoIngestRundown(ingestObjectGenerator)).toEqual(expectedChanges)
	})

	test('replace payload with change', () => {
		const ingestRundown = getBasicIngestRundown()
		const mutableRundown = new MutableIngestRundownImpl(clone(ingestRundown), true)

		// compare properties
		expect(mutableRundown.payload).toEqual(ingestRundown.payload)
		expect(mutableRundown.intoIngestRundown(ingestObjectGenerator)).toEqual(createNoChangesObject(ingestRundown))

		const newPayload = { val: 'new-val' }
		mutableRundown.replacePayload(newPayload)
		expect(mutableRundown.payload).toEqual(newPayload)

		// check it has changes
		const expectedChanges = createNoChangesObject(clone(ingestRundown))
		expectedChanges.computedChanges.ingestRundown.payload = newPayload
		addChangedRundown(expectedChanges)
		expect(mutableRundown.intoIngestRundown(ingestObjectGenerator)).toEqual(expectedChanges)
	})

	test('replace payload with no change', () => {
		const ingestRundown = getBasicIngestRundown()
		const mutableRundown = new MutableIngestRundownImpl(clone(ingestRundown), true)

		// compare properties
		expect(mutableRundown.payload).toEqual(ingestRundown.payload)
		expect(mutableRundown.intoIngestRundown(ingestObjectGenerator)).toEqual(createNoChangesObject(ingestRundown))

		mutableRundown.replacePayload(ingestRundown.payload)
		expect(mutableRundown.payload).toEqual(ingestRundown.payload)

		// check it has no changes
		expect(mutableRundown.intoIngestRundown(ingestObjectGenerator)).toEqual(createNoChangesObject(ingestRundown))
	})

	test('set payload property change', () => {
		const ingestRundown = getBasicIngestRundown()
		const mutableRundown = new MutableIngestRundownImpl<any>(clone(ingestRundown), true)

		// compare properties
		expect(mutableRundown.payload).toEqual(ingestRundown.payload)
		expect(mutableRundown.intoIngestRundown(ingestObjectGenerator)).toEqual(createNoChangesObject(ingestRundown))

		const newPayload = { ...ingestRundown.payload, test: 123, second: undefined }
		mutableRundown.setPayloadProperty('test', 123)
		mutableRundown.setPayloadProperty('second', undefined)
		expect(mutableRundown.payload).toEqual(newPayload)

		// check it has changes
		const expectedChanges = createNoChangesObject(clone(ingestRundown))
		expectedChanges.computedChanges.ingestRundown.payload = newPayload
		addChangedRundown(expectedChanges)
		expect(mutableRundown.intoIngestRundown(ingestObjectGenerator)).toEqual(expectedChanges)
	})

	test('set payload property unchanged', () => {
		const ingestRundown = getBasicIngestRundown()
		const mutableRundown = new MutableIngestRundownImpl<any>(clone(ingestRundown), true)

		// compare properties
		expect(mutableRundown.payload).toEqual(ingestRundown.payload)
		expect(mutableRundown.intoIngestRundown(ingestObjectGenerator)).toEqual(createNoChangesObject(ingestRundown))

		mutableRundown.setPayloadProperty('val', ingestRundown.payload.val)
		mutableRundown.setPayloadProperty('another', undefined)
		expect(mutableRundown.payload).toEqual(ingestRundown.payload)

		// check it has no changes
		expect(mutableRundown.intoIngestRundown(ingestObjectGenerator)).toEqual(createNoChangesObject(ingestRundown))
	})

	test('set user edit state change', () => {
		const ingestRundown = getBasicIngestRundown()
		const mutableRundown = new MutableIngestRundownImpl<any>(clone(ingestRundown), true)

		// compare properties
		expect(mutableRundown.userEditStates).toEqual(ingestRundown.userEditStates)
		expect(mutableRundown.intoIngestRundown(ingestObjectGenerator)).toEqual(createNoChangesObject(ingestRundown))

		const newUserEditStates = { ...ingestRundown.userEditStates, two: true, another: false }
		mutableRundown.setUserEditState('two', true)
		mutableRundown.setUserEditState('another', false)
		expect(mutableRundown.userEditStates).toEqual(newUserEditStates)

		// check it has changes
		const expectedChanges = createNoChangesObject(ingestRundown)
		ingestRundown.userEditStates = newUserEditStates
		addChangedRundown(expectedChanges)
		expect(mutableRundown.intoIngestRundown(ingestObjectGenerator)).toEqual(expectedChanges)
	})

	test('set user edit state unchanged', () => {
		const ingestRundown = getBasicIngestRundown()
		const mutableRundown = new MutableIngestRundownImpl<any>(clone(ingestRundown), true)

		// compare properties
		expect(mutableRundown.userEditStates).toEqual(ingestRundown.userEditStates)
		expect(mutableRundown.intoIngestRundown(ingestObjectGenerator)).toEqual(createNoChangesObject(ingestRundown))

		mutableRundown.setUserEditState('one', true)
		mutableRundown.setUserEditState('two', false)
		expect(mutableRundown.userEditStates).toEqual(ingestRundown.userEditStates)

		// check it has changes
		expect(mutableRundown.intoIngestRundown(ingestObjectGenerator)).toEqual(createNoChangesObject(ingestRundown))
	})

	test('get segments', () => {
		const ingestRundown = getBasicIngestRundown()
		const mutableRundown = new MutableIngestRundownImpl(clone(ingestRundown), true)

		// compare properties
		expect(mutableRundown.segments.length).toBe(ingestRundown.segments.length)
		expect(mutableRundown.getSegment('seg0')).toStrictEqual(mutableRundown.segments[0])
		expect(mutableRundown.getSegment('seg0') instanceof MutableIngestSegmentImpl).toBe(true)
		expect(mutableRundown.getSegment('seg1')).toStrictEqual(mutableRundown.segments[1])
		expect(mutableRundown.getSegment('seg1') instanceof MutableIngestSegmentImpl).toBe(true)
		expect(mutableRundown.getSegment('seg2')).toStrictEqual(mutableRundown.segments[2])
		expect(mutableRundown.getSegment('seg2') instanceof MutableIngestSegmentImpl).toBe(true)
		expect(mutableRundown.getSegment('seg3')).toBeUndefined()

		expect(mutableRundown.intoIngestRundown(ingestObjectGenerator)).toEqual(createNoChangesObject(ingestRundown))
	})

	test('findPart & findPartAndSegment', () => {
		const ingestRundown = getBasicIngestRundown()
		const mutableRundown = new MutableIngestRundownImpl(clone(ingestRundown), true)

		// compare properties
		expect(mutableRundown.segments.length).toBe(ingestRundown.segments.length)
		expect(mutableRundown.findPart('part1')).toStrictEqual(mutableRundown.segments[1].parts[0])
		expect(mutableRundown.findPart('part1')).toStrictEqual(mutableRundown.findPartAndSegment('part1')?.part)
		expect(mutableRundown.getSegment('seg1')).toStrictEqual(mutableRundown.findPartAndSegment('part1')?.segment)

		expect(mutableRundown.intoIngestRundown(ingestObjectGenerator)).toEqual(createNoChangesObject(ingestRundown))
	})

	describe('removeSegment', () => {
		test('good', () => {
			const ingestRundown = getBasicIngestRundown()
			const mutableRundown = new MutableIngestRundownImpl(clone(ingestRundown), true)

			expect(mutableRundown.removeSegment('seg1')).toBeTruthy()

			// compare properties
			expect(mutableRundown.segments.length).toBe(2)
			expect(mutableRundown.getSegment('seg1')).toBeUndefined()

			// check it has changes
			const expectedIngestRundown = clone(ingestRundown)
			removeSegmentFromIngestRundown(expectedIngestRundown, 'seg1')
			const expectedChanges = createNoChangesObject(expectedIngestRundown)
			expectedChanges.computedChanges.segmentsToRemove.push('seg1')
			expectedChanges.computedChanges.segmentsUpdatedRanks = { seg2: 1 }
			addChangedRankSegments(expectedChanges, ingestRundown, expectedIngestRundown.segments[1])
			expect(mutableRundown.intoIngestRundown(ingestObjectGenerator)).toEqual(expectedChanges)

			// try removing a second time
			expect(mutableRundown.removeSegment('seg1')).toBeFalsy()
			expect(mutableRundown.intoIngestRundown(ingestObjectGenerator)).toEqual(
				createNoChangesObject(expectedIngestRundown)
			)
		})

		test('unknown id', () => {
			const ingestRundown = getBasicIngestRundown()
			const mutableRundown = new MutableIngestRundownImpl(clone(ingestRundown), true)

			expect(mutableRundown.removeSegment('segX')).toBeFalsy()

			// compare properties
			expect(mutableRundown.segments.length).toBe(ingestRundown.segments.length)

			// ensure no changes
			expect(mutableRundown.intoIngestRundown(ingestObjectGenerator)).toEqual(
				createNoChangesObject(ingestRundown)
			)
		})
	})

	test('removeAllSegments', () => {
		const ingestRundown = getBasicIngestRundown()
		const mutableRundown = new MutableIngestRundownImpl(clone(ingestRundown), true)

		mutableRundown.removeAllSegments()

		// compare properties
		expect(mutableRundown.segments.length).toBe(0)

		// ensure no changes
		const expectedIngestRundown = clone(ingestRundown)
		expectedIngestRundown.segments = []
		const expectedChanges = createNoChangesObject(expectedIngestRundown)
		for (const segment of ingestRundown.segments) {
			expectedChanges.computedChanges.segmentsToRemove.push(segment.externalId)
		}
		expect(mutableRundown.intoIngestRundown(ingestObjectGenerator)).toEqual(expectedChanges)
	})

	test('forceFullRegenerate', () => {
		const ingestRundown = getBasicIngestRundown()
		const mutableRundown = new MutableIngestRundownImpl(clone(ingestRundown), true)

		// ensure no changes
		expect(mutableRundown.intoIngestRundown(ingestObjectGenerator)).toEqual(createNoChangesObject(ingestRundown))

		mutableRundown.forceFullRegenerate()

		// check it has changes
		const expectedChanges = createNoChangesObject(ingestRundown)
		addChangedRundown(expectedChanges)
		expect(mutableRundown.intoIngestRundown(ingestObjectGenerator)).toEqual(expectedChanges)
	})

	describe('replaceSegment', () => {
		test('replace existing with a move', () => {
			const ingestRundown = getBasicIngestRundown()
			const mutableRundown = new MutableIngestRundownImpl(clone(ingestRundown), true)

			const segmentBefore = mutableRundown.getSegment('seg1')
			expect(segmentBefore).toBeDefined()
			for (const part of segmentBefore?.parts || []) {
				expect(mutableRundown.findPart(part.externalId)).toStrictEqual(part)
			}
			expect(getSegmentIdOrder(mutableRundown)).toEqual(['seg0', 'seg1', 'seg2'])

			const newSegment: Omit<SofieIngestSegment, 'rank'> = {
				externalId: 'seg1',
				name: 'new name',
				isHidden: false,
				timing: {
					expectedStart: 0,
					expectedEnd: 0,
				},
				payload: {
					val: 'new-val',
				},
				userEditStates: {},
				parts: [
					{
						externalId: 'part1',
						name: 'new part name',
						rank: 0,
						float: false,
						autoNext: false,
						payload: {
							val: 'new-part-val',
						},
						userEditStates: {},
					},
				],
			}
			const replacedPart = mutableRundown.replaceSegment(newSegment, null)
			expect(replacedPart).toBeDefined()
			// ensure the inserted part looks correct
			expect(replacedPart?.externalId).toBe(newSegment.externalId)
			expect(replacedPart?.name).toBe(newSegment.name)
			expect(replacedPart?.payload).toEqual(newSegment.payload)

			// check it has changes
			expect(getSegmentIdOrder(mutableRundown)).toEqual(['seg0', 'seg2', 'seg1'])
			const expectedIngestRundown = clone(ingestRundown)
			removeSegmentFromIngestRundown(expectedIngestRundown, 'seg1')
			expectedIngestRundown.segments.push({ ...newSegment, rank: 2 })

			const expectedChanges = createNoChangesObject(expectedIngestRundown)
			addChangedRankSegments(expectedChanges, ingestRundown, expectedIngestRundown.segments[1])
			addChangedSegments(expectedChanges, ingestRundown, expectedIngestRundown.segments[2])
			expectedChanges.computedChanges.segmentsUpdatedRanks = { seg2: 1, seg1: 2 }

			expect(mutableRundown.intoIngestRundown(ingestObjectGenerator)).toEqual(expectedChanges)

			// ensure the MutableSegment is a new object
			expect(mutableRundown.getSegment('seg1')).not.toBe(segmentBefore)
			for (const part of segmentBefore?.parts || []) {
				expect(mutableRundown.findPart(part.externalId)).not.toBe(part)
			}
		})

		test('insert new', () => {
			const ingestRundown = getBasicIngestRundown()
			const mutableRundown = new MutableIngestRundownImpl(clone(ingestRundown), true)

			expect(mutableRundown.getSegment('partX')).toBeUndefined()
			expect(getSegmentIdOrder(mutableRundown)).toEqual(['seg0', 'seg1', 'seg2'])

			const newSegment: Omit<SofieIngestSegment, 'rank'> = {
				externalId: 'segX',
				name: 'new name',
				isHidden: false,
				timing: {
					expectedStart: 0,
					expectedEnd: 0,
				},
				payload: {
					val: 'new-val',
				},
				userEditStates: {},
				parts: [
					{
						externalId: 'partX',
						name: 'new part name',
						rank: 0,
						float: false,
						autoNext: false,
						payload: {
							val: 'new-part-val',
						},
						userEditStates: {},
					},
				],
			}
			const replacedPart = mutableRundown.replaceSegment(newSegment, null)
			expect(replacedPart).toBeDefined()
			// ensure the inserted part looks correct
			expect(replacedPart?.externalId).toBe(newSegment.externalId)
			expect(replacedPart?.name).toBe(newSegment.name)
			expect(replacedPart?.payload).toEqual(newSegment.payload)

			// check it has changes
			expect(getSegmentIdOrder(mutableRundown)).toEqual(['seg0', 'seg1', 'seg2', 'segX'])
			const expectedIngestRundown = clone(ingestRundown)
			expectedIngestRundown.segments.push({ ...newSegment, rank: 3 })

			const expectedChanges = createNoChangesObject(expectedIngestRundown)
			addChangedSegments(expectedChanges, ingestRundown, expectedIngestRundown.segments[3])
			expectedChanges.computedChanges.segmentsUpdatedRanks = { segX: 3 }

			expect(mutableRundown.intoIngestRundown(ingestObjectGenerator)).toEqual(expectedChanges)
		})

		test('insert at position', () => {
			const ingestRundown = getBasicIngestRundown()
			const mutableRundown = new MutableIngestRundownImpl(clone(ingestRundown), true)

			expect(mutableRundown.getSegment('partX')).toBeUndefined()
			expect(getSegmentIdOrder(mutableRundown)).toEqual(['seg0', 'seg1', 'seg2'])

			const newSegment: Omit<IngestSegment, 'rank'> = {
				externalId: 'segX',
				name: 'new name',
				isHidden: false,
				timing: {
					expectedStart: 0,
					expectedEnd: 0,
				},
				payload: {
					val: 'new-val',
				},
				parts: [
					{
						externalId: 'partX',
						name: 'new part name',
						rank: 0,
						float: false,
						autoNext: false,
						payload: {
							val: 'new-part-val',
						},
					},
				],
			}

			// insert at the end
			expect(mutableRundown.replaceSegment(newSegment, null)).toBeDefined()
			expect(getSegmentIdOrder(mutableRundown)).toEqual(['seg0', 'seg1', 'seg2', 'segX'])

			// insert at the beginning
			expect(mutableRundown.replaceSegment(newSegment, 'seg0')).toBeDefined()
			expect(getSegmentIdOrder(mutableRundown)).toEqual(['segX', 'seg0', 'seg1', 'seg2'])

			// insert in the middle
			expect(mutableRundown.replaceSegment(newSegment, 'seg2')).toBeDefined()
			expect(getSegmentIdOrder(mutableRundown)).toEqual(['seg0', 'seg1', 'segX', 'seg2'])

			// Only the one should have changes
			expect(
				mutableRundown
					.intoIngestRundown(ingestObjectGenerator)
					.computedChanges.segmentsToRegenerate.map((s) => s.externalId)
			).toEqual(['segX'])

			// Try inserting before itself
			expect(() => mutableRundown.replaceSegment(newSegment, newSegment.externalId)).toThrow(
				/Cannot insert Segment before itself/
			)

			// Try inserting before an unknown part
			expect(() => mutableRundown.replaceSegment(newSegment, 'segY')).toThrow(/Segment(.*)not found/)
		})
	})

	describe('moveSegmentBefore', () => {
		test('move unknown', () => {
			const ingestRundown = getBasicIngestRundown()
			const mutableRundown = new MutableIngestRundownImpl(clone(ingestRundown), true)

			expect(mutableRundown.getSegment('segX')).toBeUndefined()
			expect(getSegmentIdOrder(mutableRundown)).toEqual(['seg0', 'seg1', 'seg2'])

			expect(() => mutableRundown.moveSegmentBefore('segX', null)).toThrow(/Segment(.*)not found/)
			expect(getSegmentIdOrder(mutableRundown)).toEqual(['seg0', 'seg1', 'seg2'])
		})

		test('move to position', () => {
			const ingestRundown = getBasicIngestRundown()
			const mutableRundown = new MutableIngestRundownImpl(clone(ingestRundown), true)

			expect(getSegmentIdOrder(mutableRundown)).toEqual(['seg0', 'seg1', 'seg2'])

			// insert at the end
			mutableRundown.moveSegmentBefore('seg1', null)
			expect(getSegmentIdOrder(mutableRundown)).toEqual(['seg0', 'seg2', 'seg1'])

			// insert in the middle
			mutableRundown.moveSegmentBefore('seg1', 'seg2')
			expect(getSegmentIdOrder(mutableRundown)).toEqual(['seg0', 'seg1', 'seg2'])

			// insert at the beginning
			mutableRundown.moveSegmentBefore('seg1', 'seg0')
			expect(getSegmentIdOrder(mutableRundown)).toEqual(['seg1', 'seg0', 'seg2'])

			// Check the reported changes
			const expectedIngestRundown = clone(ingestRundown)
			expectedIngestRundown.segments.splice(0, 0, expectedIngestRundown.segments.splice(1, 1)[0])
			expectedIngestRundown.segments[0].rank = 0
			expectedIngestRundown.segments[1].rank = 1
			const expectedChanges = createNoChangesObject(expectedIngestRundown)
			addChangedRankSegments(expectedChanges, ingestRundown, expectedIngestRundown.segments[0])
			addChangedRankSegments(expectedChanges, ingestRundown, expectedIngestRundown.segments[1])
			expectedChanges.computedChanges.segmentsUpdatedRanks = { seg1: 0, seg0: 1 }
			expect(mutableRundown.intoIngestRundown(ingestObjectGenerator)).toEqual(expectedChanges)

			// Try inserting before itself
			expect(() => mutableRundown.moveSegmentBefore('seg1', 'seg1')).toThrow(/Cannot move Segment before itself/)

			// Try inserting before an unknown part
			expect(() => mutableRundown.moveSegmentBefore('seg1', 'segY')).toThrow(/Segment(.*)not found/)
		})
	})

	describe('moveSegmentAfter', () => {
		test('move unknown', () => {
			const ingestRundown = getBasicIngestRundown()
			const mutableRundown = new MutableIngestRundownImpl(clone(ingestRundown), true)

			expect(mutableRundown.getSegment('segX')).toBeUndefined()
			expect(getSegmentIdOrder(mutableRundown)).toEqual(['seg0', 'seg1', 'seg2'])

			expect(() => mutableRundown.moveSegmentAfter('segX', null)).toThrow(/Segment(.*)not found/)
			expect(getSegmentIdOrder(mutableRundown)).toEqual(['seg0', 'seg1', 'seg2'])
		})

		test('move to position', () => {
			const ingestRundown = getBasicIngestRundown()
			const mutableRundown = new MutableIngestRundownImpl(clone(ingestRundown), true)

			expect(getSegmentIdOrder(mutableRundown)).toEqual(['seg0', 'seg1', 'seg2'])

			// insert at the beginning
			mutableRundown.moveSegmentAfter('seg1', null)
			expect(getSegmentIdOrder(mutableRundown)).toEqual(['seg1', 'seg0', 'seg2'])

			// insert in the middle
			mutableRundown.moveSegmentAfter('seg1', 'seg0')
			expect(getSegmentIdOrder(mutableRundown)).toEqual(['seg0', 'seg1', 'seg2'])

			// insert at the end
			mutableRundown.moveSegmentAfter('seg1', 'seg2')
			expect(getSegmentIdOrder(mutableRundown)).toEqual(['seg0', 'seg2', 'seg1'])

			// Check the reported changes
			const expectedIngestRundown = clone(ingestRundown)
			expectedIngestRundown.segments.splice(1, 0, expectedIngestRundown.segments.splice(2, 1)[0])
			expectedIngestRundown.segments[1].rank = 1
			expectedIngestRundown.segments[2].rank = 2
			const expectedChanges = createNoChangesObject(expectedIngestRundown)
			addChangedRankSegments(expectedChanges, ingestRundown, expectedIngestRundown.segments[1])
			addChangedRankSegments(expectedChanges, ingestRundown, expectedIngestRundown.segments[2])
			expectedChanges.computedChanges.segmentsUpdatedRanks = { seg2: 1, seg1: 2 }
			expect(mutableRundown.intoIngestRundown(ingestObjectGenerator)).toEqual(expectedChanges)

			// Try inserting before itself
			expect(() => mutableRundown.moveSegmentAfter('seg1', 'seg1')).toThrow(/Cannot move Segment after itself/)

			// Try inserting before an unknown part
			expect(() => mutableRundown.moveSegmentAfter('seg1', 'segY')).toThrow(/Segment(.*)not found/)
		})
	})

	describe('changeSegmentExternalId', () => {
		test('rename unknown', () => {
			const ingestRundown = getBasicIngestRundown()
			const mutableRundown = new MutableIngestRundownImpl(clone(ingestRundown), true)

			expect(mutableRundown.getSegment('segX')).toBeUndefined()
			expect(getSegmentIdOrder(mutableRundown)).toEqual(['seg0', 'seg1', 'seg2'])
			expect(getSegmentOriginalIdOrder(mutableRundown)).toEqual([undefined, undefined, undefined])

			expect(() => mutableRundown.changeSegmentExternalId('segX', 'segY')).toThrow(/Segment(.*)not found/)
			expect(getSegmentIdOrder(mutableRundown)).toEqual(['seg0', 'seg1', 'seg2'])
			expect(getSegmentOriginalIdOrder(mutableRundown)).toEqual([undefined, undefined, undefined])
		})

		test('rename to duplicate', () => {
			const ingestRundown = getBasicIngestRundown()
			const mutableRundown = new MutableIngestRundownImpl(clone(ingestRundown), true)

			expect(mutableRundown.getSegment('seg1')).toBeDefined()
			expect(getSegmentIdOrder(mutableRundown)).toEqual(['seg0', 'seg1', 'seg2'])
			expect(getSegmentOriginalIdOrder(mutableRundown)).toEqual([undefined, undefined, undefined])

			expect(() => mutableRundown.changeSegmentExternalId('seg1', 'seg2')).toThrow(/Segment(.*)already exists/)
			expect(getSegmentIdOrder(mutableRundown)).toEqual(['seg0', 'seg1', 'seg2'])
			expect(getSegmentOriginalIdOrder(mutableRundown)).toEqual([undefined, undefined, undefined])
		})

		test('good', () => {
			const ingestRundown = getBasicIngestRundown()
			const mutableRundown = new MutableIngestRundownImpl(clone(ingestRundown), true)

			const beforeSegment = mutableRundown.getSegment('seg1') as MutableIngestSegmentImpl
			expect(beforeSegment).toBeDefined()
			expect(getSegmentIdOrder(mutableRundown)).toEqual(['seg0', 'seg1', 'seg2'])
			expect(getSegmentOriginalIdOrder(mutableRundown)).toEqual([undefined, undefined, undefined])

			// rename and check
			expect(mutableRundown.changeSegmentExternalId('seg1', 'segX')).toStrictEqual(beforeSegment)
			expect(getSegmentIdOrder(mutableRundown)).toEqual(['seg0', 'segX', 'seg2'])
			expect(getSegmentOriginalIdOrder(mutableRundown)).toEqual([undefined, 'seg1', undefined])
			expect(beforeSegment.originalExternalId).toBe('seg1')
			expect(beforeSegment.externalId).toBe('segX')

			// Check the reported changes
			const expectedIngestRundown = clone(ingestRundown)
			expectedIngestRundown.segments[1].externalId = 'segX'
			const expectedChanges = createNoChangesObject(expectedIngestRundown)
			addChangedRankSegments(expectedChanges, ingestRundown, expectedIngestRundown.segments[1])
			expectedChanges.computedChanges.segmentsUpdatedRanks = { segX: 1 }
			expectedChanges.computedChanges.segmentExternalIdChanges = { seg1: 'segX' }
			expect(mutableRundown.intoIngestRundown(ingestObjectGenerator)).toEqual(expectedChanges)
		})

		test('rename twice', () => {
			const ingestRundown = getBasicIngestRundown()
			const mutableRundown = new MutableIngestRundownImpl(clone(ingestRundown), true)

			const beforeSegment = mutableRundown.getSegment('seg1') as MutableIngestSegmentImpl
			expect(beforeSegment).toBeDefined()
			expect(getSegmentIdOrder(mutableRundown)).toEqual(['seg0', 'seg1', 'seg2'])
			expect(getSegmentOriginalIdOrder(mutableRundown)).toEqual([undefined, undefined, undefined])

			// rename and check
			expect(mutableRundown.changeSegmentExternalId('seg1', 'segX')).toStrictEqual(beforeSegment)
			expect(getSegmentIdOrder(mutableRundown)).toEqual(['seg0', 'segX', 'seg2'])
			expect(getSegmentOriginalIdOrder(mutableRundown)).toEqual([undefined, 'seg1', undefined])
			expect(beforeSegment.originalExternalId).toBe('seg1')
			expect(beforeSegment.externalId).toBe('segX')

			// rename again
			expect(mutableRundown.changeSegmentExternalId('segX', 'segY')).toStrictEqual(beforeSegment)
			expect(getSegmentIdOrder(mutableRundown)).toEqual(['seg0', 'segY', 'seg2'])
			expect(getSegmentOriginalIdOrder(mutableRundown)).toEqual([undefined, 'seg1', undefined])
			expect(beforeSegment.originalExternalId).toBe('seg1')
			expect(beforeSegment.externalId).toBe('segY')

			// Check the reported changes
			const expectedIngestRundown = clone(ingestRundown)
			expectedIngestRundown.segments[1].externalId = 'segY'
			const expectedChanges = createNoChangesObject(expectedIngestRundown)
			addChangedRankSegments(expectedChanges, ingestRundown, expectedIngestRundown.segments[1])
			expectedChanges.computedChanges.segmentsUpdatedRanks = { segY: 1 }
			expectedChanges.computedChanges.segmentExternalIdChanges = { seg1: 'segY' }
			expect(mutableRundown.intoIngestRundown(ingestObjectGenerator)).toEqual(expectedChanges)
		})

		test('rename circle', () => {
			const ingestRundown = getBasicIngestRundown()
			const mutableRundown = new MutableIngestRundownImpl(clone(ingestRundown), true)

			const beforeSegment1 = mutableRundown.getSegment('seg1') as MutableIngestSegmentImpl
			expect(beforeSegment1).toBeDefined()
			const beforeSegment2 = mutableRundown.getSegment('seg2') as MutableIngestSegmentImpl
			expect(beforeSegment2).toBeDefined()
			expect(getSegmentIdOrder(mutableRundown)).toEqual(['seg0', 'seg1', 'seg2'])
			expect(getSegmentOriginalIdOrder(mutableRundown)).toEqual([undefined, undefined, undefined])

			// rename seg1 to segX
			expect(mutableRundown.changeSegmentExternalId('seg1', 'segX')).toStrictEqual(beforeSegment1)
			expect(getSegmentIdOrder(mutableRundown)).toEqual(['seg0', 'segX', 'seg2'])
			expect(getSegmentOriginalIdOrder(mutableRundown)).toEqual([undefined, 'seg1', undefined])
			expect(beforeSegment1.originalExternalId).toBe('seg1')
			expect(beforeSegment1.externalId).toBe('segX')

			// rename seg2 to seg1
			expect(mutableRundown.changeSegmentExternalId('seg2', 'seg1')).toStrictEqual(beforeSegment2)
			expect(getSegmentIdOrder(mutableRundown)).toEqual(['seg0', 'segX', 'seg1'])
			expect(getSegmentOriginalIdOrder(mutableRundown)).toEqual([undefined, 'seg1', 'seg2'])
			expect(beforeSegment2.originalExternalId).toBe('seg2')
			expect(beforeSegment2.externalId).toBe('seg1')

			// rename segX to seg2
			expect(mutableRundown.changeSegmentExternalId('segX', 'seg2')).toStrictEqual(beforeSegment1)
			expect(getSegmentIdOrder(mutableRundown)).toEqual(['seg0', 'seg2', 'seg1'])
			expect(getSegmentOriginalIdOrder(mutableRundown)).toEqual([undefined, 'seg1', 'seg2'])
			expect(beforeSegment1.originalExternalId).toBe('seg1')
			expect(beforeSegment1.externalId).toBe('seg2')

			// Check the reported changes
			const expectedIngestRundown = clone(ingestRundown)
			expectedIngestRundown.segments[1].externalId = 'seg2'
			expectedIngestRundown.segments[2].externalId = 'seg1'
			const expectedChanges = createNoChangesObject(expectedIngestRundown)
			addChangedRankSegments(expectedChanges, ingestRundown, expectedIngestRundown.segments[1])
			addChangedRankSegments(expectedChanges, ingestRundown, expectedIngestRundown.segments[2])
			expectedChanges.computedChanges.segmentsUpdatedRanks = { seg2: 1, seg1: 2 }
			expectedChanges.computedChanges.segmentExternalIdChanges = { seg1: 'seg2', seg2: 'seg1' }
			expect(mutableRundown.intoIngestRundown(ingestObjectGenerator)).toEqual(expectedChanges)
		})
	})

	describe('changeSegmentOriginalExternalId', () => {
		test('rename unknown', () => {
			const ingestRundown = getBasicIngestRundown()
			const mutableRundown = new MutableIngestRundownImpl(clone(ingestRundown), true)

			expect(mutableRundown.getSegment('segX')).toBeUndefined()
			expect(getSegmentIdOrder(mutableRundown)).toEqual(['seg0', 'seg1', 'seg2'])
			expect(getSegmentOriginalIdOrder(mutableRundown)).toEqual([undefined, undefined, undefined])

			expect(() => mutableRundown.changeSegmentOriginalExternalId('segX', 'segY')).toThrow(/Segment(.*)not found/)
			expect(getSegmentIdOrder(mutableRundown)).toEqual(['seg0', 'seg1', 'seg2'])
			expect(getSegmentOriginalIdOrder(mutableRundown)).toEqual([undefined, undefined, undefined])
		})

		test('rename to duplicate', () => {
			const ingestRundown = getBasicIngestRundown()
			const mutableRundown = new MutableIngestRundownImpl(clone(ingestRundown), true)

			expect(mutableRundown.getSegment('seg1')).toBeDefined()
			expect(getSegmentIdOrder(mutableRundown)).toEqual(['seg0', 'seg1', 'seg2'])
			expect(getSegmentOriginalIdOrder(mutableRundown)).toEqual([undefined, undefined, undefined])

			expect(() => mutableRundown.changeSegmentOriginalExternalId('seg1', 'seg2')).toThrow(/Segment(.*)exists/)
			expect(getSegmentIdOrder(mutableRundown)).toEqual(['seg0', 'seg1', 'seg2'])
			expect(getSegmentOriginalIdOrder(mutableRundown)).toEqual([undefined, undefined, undefined])
		})

		test('good', () => {
			const ingestRundown = getBasicIngestRundown()
			const mutableRundown = new MutableIngestRundownImpl(clone(ingestRundown), true)

			const beforeSegment = mutableRundown.getSegment('seg1') as MutableIngestSegmentImpl
			expect(beforeSegment).toBeDefined()
			expect(getSegmentIdOrder(mutableRundown)).toEqual(['seg0', 'seg1', 'seg2'])
			expect(getSegmentOriginalIdOrder(mutableRundown)).toEqual([undefined, undefined, undefined])

			// rename and check
			expect(mutableRundown.changeSegmentOriginalExternalId('seg1', 'segX')).toStrictEqual(beforeSegment)
			expect(getSegmentIdOrder(mutableRundown)).toEqual(['seg0', 'seg1', 'seg2'])
			expect(getSegmentOriginalIdOrder(mutableRundown)).toEqual([undefined, 'segX', undefined])
			expect(beforeSegment.originalExternalId).toBe('segX')
			expect(beforeSegment.externalId).toBe('seg1')

			// Check the reported changes
			const expectedIngestRundown = clone(ingestRundown)
			const expectedChanges = createNoChangesObject(expectedIngestRundown)
			addChangedRankSegments(expectedChanges, ingestRundown, expectedIngestRundown.segments[1])
			expectedChanges.computedChanges.segmentExternalIdChanges = { segX: 'seg1' }
			expect(mutableRundown.intoIngestRundown(ingestObjectGenerator)).toEqual(expectedChanges)
		})

		test('rename twice', () => {
			const ingestRundown = getBasicIngestRundown()
			const mutableRundown = new MutableIngestRundownImpl(clone(ingestRundown), true)

			const beforeSegment = mutableRundown.getSegment('seg1') as MutableIngestSegmentImpl
			expect(beforeSegment).toBeDefined()
			expect(getSegmentIdOrder(mutableRundown)).toEqual(['seg0', 'seg1', 'seg2'])
			expect(getSegmentOriginalIdOrder(mutableRundown)).toEqual([undefined, undefined, undefined])

			// rename and check
			expect(mutableRundown.changeSegmentOriginalExternalId('seg1', 'segX')).toStrictEqual(beforeSegment)
			expect(getSegmentIdOrder(mutableRundown)).toEqual(['seg0', 'seg1', 'seg2'])
			expect(getSegmentOriginalIdOrder(mutableRundown)).toEqual([undefined, 'segX', undefined])
			expect(beforeSegment.originalExternalId).toBe('segX')
			expect(beforeSegment.externalId).toBe('seg1')

			// rename again
			expect(mutableRundown.changeSegmentOriginalExternalId('seg1', 'segY')).toStrictEqual(beforeSegment)
			expect(getSegmentIdOrder(mutableRundown)).toEqual(['seg0', 'seg1', 'seg2'])
			expect(getSegmentOriginalIdOrder(mutableRundown)).toEqual([undefined, 'segY', undefined])
			expect(beforeSegment.originalExternalId).toBe('segY')
			expect(beforeSegment.externalId).toBe('seg1')

			// Check the reported changes
			const expectedIngestRundown = clone(ingestRundown)
			const expectedChanges = createNoChangesObject(expectedIngestRundown)
			addChangedRankSegments(expectedChanges, ingestRundown, expectedIngestRundown.segments[1])
			expectedChanges.computedChanges.segmentExternalIdChanges = { segY: 'seg1' }
			expect(mutableRundown.intoIngestRundown(ingestObjectGenerator)).toEqual(expectedChanges)
		})
	})
})
