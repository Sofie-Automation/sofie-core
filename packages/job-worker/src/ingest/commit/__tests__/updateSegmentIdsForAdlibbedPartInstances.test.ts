/* eslint-disable @typescript-eslint/unbound-method */
import { updateSegmentIdsForAdlibbedPartInstances } from '../updateSegmentIdsForAdlibbedPartInstances.js'
import { BeforePartMapItem } from '../../commit.js'
import { PartId, RundownId, SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { mock } from 'jest-mock-extended'
import { ICollection } from '../../../db/index.js'
import { JobContext } from '../../../jobs/index.js'
import { clone, literal } from '@sofie-automation/corelib/dist/lib'
import { PartialDeep } from 'type-fest'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { IngestModel } from '../../model/IngestModel.js'
import { IngestPartModel } from '../../model/IngestPartModel.js'
import _ from 'underscore'
import { AnyBulkWriteOperation } from 'mongodb'

const mockOptions = {
	fallbackMockImplementation: () => {
		throw new Error('not mocked')
	},
}

describe('updateSegmentsForAdlibbedPartInstances', () => {
	const rundownId = protectString<RundownId>('rundown0')

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
			rundownId: rundownId,
			orphaned: { $exists: true },
			reset: { $ne: true },
		}

		fakeCollection.bulkWrite.mockImplementation(async () => null)
		fakeCollection.findFetch.mockImplementation(async (q) => {
			if (!_.isEqual(expectedQuery, q)) {
				console.log('bad query', q)
				throw new Error('Mismatch in query')
			} else {
				return clone(partInstances)
			}
		})

		return { context, fakeCollection }
	}

	function createFakeIngestModel(parts: DBPart[]) {
		const partModels = parts.map((part) =>
			mock<IngestPartModel>(
				{
					part: part as any,
				},
				mockOptions
			)
		)
		const ingestModel = mock<IngestModel>(
			{
				findPart: (id: PartId) => partModels.find((p) => p.part._id === id),
			},
			mockOptions
		)
		;(ingestModel as any).rundownId = rundownId

		return ingestModel
	}

	function createDefaultPartsAndSegments() {
		const segments: DBSegment[] = [
			{
				_id: protectString('segment0'),
				_rank: 0,
				rundownId,
			} as any,
			{
				_id: protectString('segment1'),
				_rank: 1,
				rundownId,
			} as any,
		]

		const parts: DBPart[] = [
			{
				_id: protectString('part0'),
				_rank: 0,
				segmentId: protectString('segment0'),
			} as any,
			{
				_id: protectString('part1'),
				_rank: 1,
				segmentId: protectString('segment0'),
			} as any,
			{
				_id: protectString('part2'),
				_rank: 0,
				segmentId: protectString('segment1'),
			} as any,
			{
				_id: protectString('part3'),
				_rank: 1,
				segmentId: protectString('segment1'),
			} as any,
		]

		return { segments, parts }
	}

	function createBasicPartMapFromCache(segments: DBSegment[], parts: DBPart[]) {
		const beforePartMap = new Map<SegmentId, Array<BeforePartMapItem>>()

		for (const segment of segments) {
			const segmentParts = parts.filter((p) => p.segmentId === segment._id, { sort: { _rank: 1 } })

			beforePartMap.set(
				segment._id,
				segmentParts.map((part) => ({
					id: part._id,
					rank: part._rank,
				}))
			)
		}

		return beforePartMap
	}

	function createPartInstance(
		segmentId: SegmentId,
		partId: string,
		rank: number,
		orphaned: DBPartInstance['orphaned']
	): DBPartInstance {
		return literal<PartialDeep<DBPartInstance>>({
			_id: protectString(`instance_${partId}`),
			rundownId,
			segmentId,
			orphaned,
			part: {
				_id: partId,
				_rank: rank,
			},
		}) as any
	}

	test('no changes', async () => {
		const partInstances = [createPartInstance(protectString('segment0'), 'part0b', 0.5, 'adlib-part')]

		const { context, fakeCollection } = createFakeContext(partInstances)

		const { segments, parts } = createDefaultPartsAndSegments()
		const beforePartMap = createBasicPartMapFromCache(segments, parts)
		const ingestModel = createFakeIngestModel(parts)

		// Setup the partInstances
		await updateSegmentIdsForAdlibbedPartInstances(context, ingestModel, beforePartMap)

		expect(fakeCollection.findFetch).toHaveBeenCalledTimes(1)
		expect(fakeCollection.bulkWrite).toHaveBeenCalledTimes(0)
	})

	test('segment rename', async () => {
		const newSegmentId = protectString('new-id')

		const partInstances = [
			createPartInstance(newSegmentId, 'part0', 0, undefined),
			createPartInstance(protectString('segment0'), 'part0b', 0.5, 'adlib-part'),
		]
		const { context, fakeCollection } = createFakeContext(partInstances)

		const { segments, parts } = createDefaultPartsAndSegments()
		const beforePartMap = createBasicPartMapFromCache(segments, parts)

		// Rename the segment
		for (const segment of segments) {
			if (segment._id === protectString('segment0')) {
				segment._id = newSegmentId
			}
		}
		for (const part of parts) {
			if (part.segmentId === protectString('segment0')) {
				part.segmentId = newSegmentId
			}
		}

		const ingestModel = createFakeIngestModel(parts)

		await updateSegmentIdsForAdlibbedPartInstances(context, ingestModel, beforePartMap)

		const expectedResult: AnyBulkWriteOperation<DBPartInstance>[] = [
			{
				updateOne: {
					filter: {
						_id: protectString('instance_part0b'),
					},
					update: {
						$set: {
							'part.segmentId': 'new-id',
							segmentId: protectString('new-id'),
						},
					},
				},
			},
		]

		expect(fakeCollection.findFetch).toHaveBeenCalledTimes(1)
		expect(fakeCollection.bulkWrite).toHaveBeenCalledTimes(1)
		expect(fakeCollection.bulkWrite).toHaveBeenCalledWith(expectedResult)
	})
})
