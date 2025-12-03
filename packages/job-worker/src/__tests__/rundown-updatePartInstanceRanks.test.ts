/* eslint-disable @typescript-eslint/unbound-method */
import { RundownId, SegmentId, PartId, PartInstanceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { updatePartInstanceRanksAndOrphanedState } from '../updatePartInstanceRanksAndOrphanedState.js'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { JobContext } from '../jobs/index.js'
import { BeforePartMapItem } from '../ingest/commit.js'
import { mock } from 'jest-mock-extended'
import { ICollection } from '../db/index.js'
import { IngestModel } from '../ingest/model/IngestModel.js'
import { IngestSegmentModel } from '../ingest/model/IngestSegmentModel.js'
import { clone } from '@sofie-automation/corelib/dist/lib'
import { IngestPartModel } from '../ingest/model/IngestPartModel.js'
import { AnyBulkWriteOperation } from 'mongodb'
import _ from 'underscore'

const mockOptions = {
	fallbackMockImplementation: () => {
		throw new Error('not mocked')
	},
}

describe('updatePartInstanceRanks', () => {
	const rundownId: RundownId = protectString('rundown0')
	const segmentId: SegmentId = protectString('segment0')

	function getPartRanks(parts: DBPart[]): Array<{ id: PartId; rank: number }> {
		return parts.map((p) => ({ id: p._id, rank: p._rank }))
	}

	function addPartInstance(
		partInstances: DBPartInstance[],
		part: DBPart,
		orphaned?: DBPartInstance['orphaned']
	): PartInstanceId {
		const id: PartInstanceId = protectString(`${part._id}_instance`)
		partInstances.push({
			_id: id,
			rehearsal: false,
			takeCount: 0,
			rundownId,
			segmentId: part.segmentId,
			playlistActivationId: protectString('active'),
			segmentPlayoutId: protectString(''),
			part,
			orphaned: orphaned,
		})
		return id
	}

	function createFakeIngestModel(parts: DBPart[], expectedSegmentId: SegmentId | null) {
		const partModels = parts.map((part) =>
			mock<IngestPartModel>(
				{
					part: part as any,
				},
				mockOptions
			)
		)
		return mock<IngestModel>(
			{
				getSegment: (segmentId) => {
					if (expectedSegmentId && segmentId !== expectedSegmentId) throw new Error('Wrong SegmentId')
					return mock<IngestSegmentModel>(
						{
							parts: partModels.filter((p) => p.part.segmentId === segmentId) as any,
						},
						mockOptions
					)
				},
				getAllOrderedParts: () => partModels,
			},
			mockOptions
		)
	}

	async function updateRanksForSegment(
		context: JobContext,
		expectedSegmentId: SegmentId,
		parts: DBPart[],
		initialRanks: BeforePartMapItem[]
	): Promise<void> {
		const ingestModel = createFakeIngestModel(parts, expectedSegmentId)

		const changeMap = new Map<SegmentId, Array<{ id: PartId; rank: number }>>()
		changeMap.set(expectedSegmentId, initialRanks)
		await updatePartInstanceRanksAndOrphanedState(context, ingestModel, [expectedSegmentId], changeMap)
	}

	function createFakeContext(partInstances: DBPartInstance[]) {
		const fakeCollection = mock<ICollection<DBPartInstance>>({}, mockOptions)
		const context = mock<JobContext>(
			{
				directCollections: mock(
					{
						PartInstances: fakeCollection,
					},
					mockOptions
				),
			},
			mockOptions
		)

		const expectedQuery = {
			reset: {
				$ne: true,
			},
			segmentId: { $in: [segmentId] },
		}

		fakeCollection.bulkWrite.mockImplementation(async () => null)
		fakeCollection.findFetch.mockImplementation(async (q) => {
			if (!_.isEqual(expectedQuery, q)) {
				throw new Error('Mismatch in query')
			} else {
				return clone(partInstances)
			}
		})

		return { context, fakeCollection }
	}

	function createMinimalPart(id: string, rank: number, customSegmentId?: SegmentId): DBPart {
		return {
			_id: protectString(id),
			_rank: rank,
			rundownId,
			segmentId: customSegmentId ?? segmentId,
			externalId: id,
			title: id,
			expectedDurationWithTransition: undefined,
		}
	}

	function createFakeData() {
		const parts: DBPart[] = []
		const partInstances: DBPartInstance[] = []

		const addPart = (id: string, rank: number) => {
			parts.push(createMinimalPart(id, rank))

			partInstances.push({
				_id: protectString(`${id}_instance`),
				rehearsal: false,
				takeCount: 0,
				rundownId,
				segmentId,
				playlistActivationId: protectString('active'),
				segmentPlayoutId: protectString(''),
				part: createMinimalPart(id, rank),
				// orphaned: orphaned,
			})
		}

		addPart('part01', 1)
		addPart('part02', 2)
		addPart('part03', 3)
		addPart('part04', 4)
		addPart('part05', 5)

		return { parts, partInstances }
	}

	function updatePartRank(
		parts: DBPart[],
		expectedOps: AnyBulkWriteOperation<DBPartInstance>[],
		id: string,
		newRank: number
	): void {
		const partId = protectString(id)

		// let updated = false
		for (const part of parts) {
			if (part._id === partId) {
				part._rank = newRank
				// updated = true
			}
		}

		const partInstanceId = protectString(`${partId}_instance`)

		addExpectedOp(expectedOps, partInstanceId, newRank, /*!updated ? 'deleted' :*/ null) // TODO - check this
	}

	function removePart(parts: DBPart[], expectedOps: AnyBulkWriteOperation<DBPartInstance>[], id: string) {
		const partIndex = parts.findIndex((p) => p._id === protectString(id))
		expect(partIndex).not.toBe(-1)
		parts.splice(partIndex, 1)

		addExpectedOp(expectedOps, `${id}_instance`, null, 'deleted')
	}

	function addExpectedOp(
		expectedOps: AnyBulkWriteOperation<DBPartInstance>[],
		partInstanceId: PartInstanceId | string,
		newRank: number | null,
		orphaned: DBPartInstance['orphaned'] | null
	) {
		expectedOps.push({
			updateOne: {
				filter: {
					_id: partInstanceId as PartInstanceId,
				},
				update: {
					$set: {
						...(newRank !== null
							? {
									'part._rank': newRank,
								}
							: ''),
						...(orphaned
							? {
									orphaned: orphaned,
								}
							: ''),
					},
					...(orphaned === undefined
						? {
								$unset: {
									orphaned: 1,
								},
							}
						: ''),
				},
			},
		})
	}

	const partInstanceFetchOptions = {
		projection: { _id: 1, orphaned: 1, 'part._id': 1, 'part._rank': 1, segmentId: 1 },
		sort: { takeCount: 1 },
	}

	test('sync from parts: no change', async () => {
		const { parts, partInstances } = createFakeData()
		const { context, fakeCollection } = createFakeContext(partInstances)

		const initialRanks = getPartRanks(parts)
		expect(initialRanks).toHaveLength(5)

		fakeCollection.findFetch.mockImplementationOnce(async () => clone(partInstances))
		fakeCollection.bulkWrite.mockImplementationOnce(async () => null)

		await updateRanksForSegment(context, segmentId, parts, initialRanks)

		expect(fakeCollection.findFetch).toHaveBeenCalledTimes(1)
		expect(fakeCollection.findFetch).toHaveBeenCalledWith(
			{
				reset: {
					$ne: true,
				},
				segmentId: { $in: [segmentId] },
			},
			partInstanceFetchOptions
		)
		expect(fakeCollection.bulkWrite).toHaveBeenCalledTimes(0)
	})

	test('sync from parts: swap part order', async () => {
		const { parts, partInstances } = createFakeData()
		const { context, fakeCollection } = createFakeContext(partInstances)

		const initialRanks = getPartRanks(parts)
		expect(initialRanks).toHaveLength(5)

		// swap the middle ones
		const expectedResult: AnyBulkWriteOperation<DBPartInstance>[] = []
		updatePartRank(parts, expectedResult, 'part02', 3)
		updatePartRank(parts, expectedResult, 'part03', 4)
		updatePartRank(parts, expectedResult, 'part04', 2)

		await updateRanksForSegment(context, segmentId, parts, initialRanks)

		expect(fakeCollection.findFetch).toHaveBeenCalledTimes(1)
		expect(fakeCollection.bulkWrite).toHaveBeenCalledTimes(1)
		expect(fakeCollection.bulkWrite).toHaveBeenCalledWith(expectedResult)
	})

	test('sync from parts: swap part order2', async () => {
		const { parts, partInstances } = createFakeData()
		const { context, fakeCollection } = createFakeContext(partInstances)

		const initialRanks = getPartRanks(parts)
		expect(initialRanks).toHaveLength(5)

		// try swapping the first and last
		const expectedResult: AnyBulkWriteOperation<DBPartInstance>[] = []
		updatePartRank(parts, expectedResult, 'part01', 5)
		updatePartRank(parts, expectedResult, 'part05', 1)

		await updateRanksForSegment(context, segmentId, parts, initialRanks)

		expect(fakeCollection.findFetch).toHaveBeenCalledTimes(1)
		expect(fakeCollection.bulkWrite).toHaveBeenCalledTimes(1)
		expect(fakeCollection.bulkWrite).toHaveBeenCalledWith(expectedResult)
	})

	test('sync from parts: missing part', async () => {
		const { parts, partInstances } = createFakeData()
		const { context, fakeCollection } = createFakeContext(partInstances)

		const initialRanks = getPartRanks(parts)
		expect(initialRanks).toHaveLength(5)

		// remove one and offset the others
		const expectedResult: AnyBulkWriteOperation<DBPartInstance>[] = []
		removePart(parts, expectedResult, 'part03')
		updatePartRank(parts, expectedResult, 'part04', 3)
		updatePartRank(parts, expectedResult, 'part05', 4)
		updatePartRank(parts, expectedResult, 'part03', 2.5)

		await updateRanksForSegment(context, segmentId, parts, initialRanks)

		expect(fakeCollection.findFetch).toHaveBeenCalledTimes(1)
		expect(fakeCollection.bulkWrite).toHaveBeenCalledTimes(1)
		expect(fakeCollection.bulkWrite).toHaveBeenCalledWith(expectedResult)
	})

	test('sync from parts: missing first part', async () => {
		const { parts, partInstances } = createFakeData()
		const { context, fakeCollection } = createFakeContext(partInstances)

		const initialRanks = getPartRanks(parts)
		expect(initialRanks).toHaveLength(5)

		// remove one and offset the others
		const expectedResult: AnyBulkWriteOperation<DBPartInstance>[] = []
		removePart(parts, expectedResult, 'part01')
		updatePartRank(parts, expectedResult, 'part02', 1)
		updatePartRank(parts, expectedResult, 'part03', 2)
		updatePartRank(parts, expectedResult, 'part04', 3)
		updatePartRank(parts, expectedResult, 'part05', 4)
		updatePartRank(parts, expectedResult, 'part01', -1)

		await updateRanksForSegment(context, segmentId, parts, initialRanks)

		expect(fakeCollection.findFetch).toHaveBeenCalledTimes(1)
		expect(fakeCollection.bulkWrite).toHaveBeenCalledTimes(1)
		expect(fakeCollection.bulkWrite).toHaveBeenCalledWith(expectedResult)
	})

	test('sync from parts: adlib part after missing part', async () => {
		const { parts, partInstances } = createFakeData()
		const { context, fakeCollection } = createFakeContext(partInstances)

		const initialRanks = getPartRanks(parts)
		expect(initialRanks).toHaveLength(5)

		// insert an adlib part
		const adlibId = 'adlib0'
		addPartInstance(
			partInstances,
			createMinimalPart(adlibId, 3.5), // after part03
			'adlib-part'
		)

		// remove one and offset the others
		const expectedResult: AnyBulkWriteOperation<DBPartInstance>[] = []
		removePart(parts, expectedResult, 'part03')
		updatePartRank(parts, expectedResult, 'part04', 3)
		updatePartRank(parts, expectedResult, 'part05', 4)
		updatePartRank(parts, expectedResult, 'part03', 2.3333333333333335)
		addExpectedOp(expectedResult, protectString(`${adlibId}_instance`), 2.6666666666666665, null)

		await updateRanksForSegment(context, segmentId, parts, initialRanks)

		expect(fakeCollection.findFetch).toHaveBeenCalledTimes(1)
		expect(fakeCollection.bulkWrite).toHaveBeenCalledTimes(1)
		expect(fakeCollection.bulkWrite).toHaveBeenCalledWith(expectedResult)
	})

	test('sync from parts: delete and insert segment', async () => {
		const { parts, partInstances } = createFakeData()
		const { context, fakeCollection } = createFakeContext(partInstances)

		const initialRanks = getPartRanks(parts)
		expect(initialRanks).toHaveLength(5)

		// Delete the segment
		const deletedParts = parts.splice(0, parts.length)
		expect(parts).toHaveLength(0)

		// Every PartInstance should be marked as deleted with a different rank
		const partDeletedExpectedResult: AnyBulkWriteOperation<DBPartInstance>[] = []
		for (const deletedPart of deletedParts) {
			addExpectedOp(partDeletedExpectedResult, `${deletedPart._id}_instance`, null, 'deleted')
		}

		const expectedResult: AnyBulkWriteOperation<DBPartInstance>[] = [...partDeletedExpectedResult]
		for (const partInstance of partInstances) {
			addExpectedOp(expectedResult, partInstance._id, partInstance.part._rank - 6, null)
		}

		await updateRanksForSegment(context, segmentId, parts, initialRanks)

		expect(fakeCollection.findFetch).toHaveBeenCalledTimes(1)
		expect(fakeCollection.bulkWrite).toHaveBeenCalledTimes(1)
		expect(fakeCollection.bulkWrite).toHaveBeenCalledWith(expectedResult)

		// Insert new segment
		const newParts: DBPart[] = [
			createMinimalPart('part10', 0),
			createMinimalPart('part11', 1),
			createMinimalPart('part12', 2),
		]

		// const expectedResult2: AnyBulkWriteOperation<DBPartInstance>[] = [...partDeletedExpectedResult]
		// addExpectedOp(expectedResult2, 'part01_instance', -5, null)
		// addExpectedOp(expectedResult2, 'part02_instance', -4, null)
		// addExpectedOp(expectedResult2, 'part03_instance', -3, null)
		// addExpectedOp(expectedResult2, 'part04_instance', -2, null)
		// addExpectedOp(expectedResult2, 'part05_instance', -1, null)

		fakeCollection.findFetch.mockClear()
		fakeCollection.bulkWrite.mockClear()

		await updateRanksForSegment(context, segmentId, newParts, [])

		expect(fakeCollection.findFetch).toHaveBeenCalledTimes(1)
		expect(fakeCollection.bulkWrite).toHaveBeenCalledTimes(1)
		expect(fakeCollection.bulkWrite).toHaveBeenCalledWith(expectedResult)
	})

	test('sync from parts: replace segment', async () => {
		const { parts, partInstances } = createFakeData()
		const { context, fakeCollection } = createFakeContext(partInstances)

		const initialRanks = getPartRanks(parts)
		expect(initialRanks).toHaveLength(5)

		// Delete the segment
		const deletedParts = parts.splice(0, parts.length)
		expect(parts).toHaveLength(0)

		// Every PartInstance should remain as orphaned
		const partDeletedExpectedResult: AnyBulkWriteOperation<DBPartInstance>[] = []
		for (const deletedPart of deletedParts) {
			addExpectedOp(partDeletedExpectedResult, `${deletedPart._id}_instance`, null, 'deleted')
		}

		const expectedResult: AnyBulkWriteOperation<DBPartInstance>[] = [...partDeletedExpectedResult]
		for (const partInstance of partInstances) {
			addExpectedOp(expectedResult, partInstance._id, partInstance.part._rank - 6, null)
		}

		// Insert new segment
		parts.push(createMinimalPart('part10', 0.5))
		parts.push(createMinimalPart('part11', 1))
		parts.push(createMinimalPart('part12', 2))

		await updateRanksForSegment(context, segmentId, parts, initialRanks)

		expect(fakeCollection.findFetch).toHaveBeenCalledTimes(1)
		expect(fakeCollection.bulkWrite).toHaveBeenCalledTimes(1)
		expect(fakeCollection.bulkWrite).toHaveBeenCalledWith(expectedResult)
	})

	test('rename segment: with orphaned part', async () => {
		const { parts, partInstances } = createFakeData()
		const { context, fakeCollection } = createFakeContext(partInstances)

		const initialRanks = getPartRanks(parts)
		expect(initialRanks).toHaveLength(5)

		// insert the adlib parts
		const adlibId0 = 'adlib0'
		addPartInstance(
			partInstances,
			createMinimalPart(adlibId0, 2.5), // after part02
			'deleted'
		)

		const adlibId1 = 'adlib1'
		addPartInstance(
			partInstances,
			createMinimalPart(adlibId1, 2.75), // after adlib0
			'adlib-part'
		)

		// Ensure the segment is correct before the operation
		await updateRanksForSegment(context, segmentId, parts, initialRanks)

		fakeCollection.findFetch.mockClear()
		fakeCollection.bulkWrite.mockClear()

		// Pretend the segment was renamed
		const oldSegmentId = protectString(segmentId + '_2')

		{
			// Perform the operation with a different ingest model and for two segments
			const ingestModel = createFakeIngestModel(parts, null)

			const expectedQuery = {
				reset: {
					$ne: true,
				},
				segmentId: { $in: [segmentId, oldSegmentId] },
			}

			fakeCollection.bulkWrite.mockImplementation(async () => null)
			fakeCollection.findFetch.mockImplementationOnce(async (q) => {
				if (!_.isEqual(expectedQuery, q)) {
					throw new Error('Mismatch in query')
				} else {
					return clone(partInstances)
				}
			})

			const changeMap = new Map<SegmentId, Array<{ id: PartId; rank: number }>>()
			changeMap.set(oldSegmentId, initialRanks)
			await updatePartInstanceRanksAndOrphanedState(context, ingestModel, [segmentId, oldSegmentId], changeMap)
		}

		// ranks should be unchanged
		expect(fakeCollection.findFetch).toHaveBeenCalledTimes(1)
		expect(fakeCollection.bulkWrite).toHaveBeenCalledTimes(0)
	})
})
