import { RundownId, RundownPlaylistId, SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ProtectedString, protectString } from '@sofie-automation/corelib/dist/protectedString'
import { UISegmentPartNote } from '@sofie-automation/meteor-lib/dist/api/rundownNotifications'
import { CustomPublishCollection } from '../../../lib/customPublication'
import { ReactiveCacheCollection } from '../../lib/ReactiveCacheCollection'
import { manipulateUISegmentPartNotesPublicationData, UISegmentPartNotesState } from '../publication'
import { ContentCache } from '../reactiveContentCache'
import * as generateNotesForSegment from '../generateNotesForSegment'
import { literal } from '@sofie-automation/corelib/dist/lib'

jest.spyOn(generateNotesForSegment, 'generateNotesForSegment').mockImplementation((playlistId, segment) => {
	return literal<UISegmentPartNote[]>([
		{
			_id: protectString(`note-${segment._id}`),
			playlistId: playlistId,
			rundownId: segment.rundownId,
			segmentId: segment._id,

			note: 'fake note' as any,
		},
	])
})

class CustomPublishCollectionExt<TDoc extends { _id: ProtectedString<any> }> extends CustomPublishCollection<TDoc> {
	// getAllCalls(): Array<any>{
	// }

	clearAllMocks(): void {
		// Implemented below
	}
}

function createSpyPublishCollection(): CustomPublishCollectionExt<UISegmentPartNote> {
	const collection = new CustomPublishCollectionExt<UISegmentPartNote>('UISegmentPartNote')

	const findAllSpy = jest.spyOn(collection, 'findAll')
	const findOneSpy = jest.spyOn(collection, 'findOne')
	const insertSpy = jest.spyOn(collection, 'insert')
	const removeSpy = jest.spyOn(collection, 'remove')
	const updateOneSpy = jest.spyOn(collection, 'updateOne')
	const updateAllSpy = jest.spyOn(collection, 'updateAll')
	const replaceSpy = jest.spyOn(collection, 'replace')

	collection.clearAllMocks = () => {
		findAllSpy.mockClear()
		findOneSpy.mockClear()
		insertSpy.mockClear()
		removeSpy.mockClear()
		updateOneSpy.mockClear()
		updateAllSpy.mockClear()
		replaceSpy.mockClear()
	}

	return collection
}

describe('manipulateUISegmentPartNotesPublicationData', () => {
	beforeEach(() => {
		jest.clearAllMocks()
	})

	const playlistId = protectString<RundownPlaylistId>('playlist0')
	const rundownId = protectString<RundownId>('rundown0')
	const segmentId0 = protectString<SegmentId>('segment0')
	const segmentId1 = protectString<SegmentId>('segment1')

	function createAndPopulateMockCache(): ContentCache {
		const newCache: ContentCache = {
			Rundowns: new ReactiveCacheCollection('Rundowns'),
			Segments: new ReactiveCacheCollection('Segments'),
			Parts: new ReactiveCacheCollection('Parts'),
			PartInstances: new ReactiveCacheCollection('PartInstances'),
		}

		newCache.Rundowns.insert({
			_id: rundownId,
			playlistId: playlistId,
			source: {
				type: 'nrcs',
				peripheralDeviceId: protectString('device0'),
				nrcsName: 'NRCS+ 2000',
			},
		})

		newCache.Segments.insert({
			_id: segmentId0,
			_rank: 1,
			rundownId: rundownId,
			name: 'Segment 0',
			notes: [],
			orphaned: undefined,
		})
		newCache.Segments.insert({
			_id: segmentId1,
			_rank: 1,
			rundownId: rundownId,
			name: 'Segment 1',
			notes: [],
			orphaned: undefined,
		})

		return newCache
	}

	const defaultNotes = [
		{
			_id: 'note-segment0',
			note: 'fake note',
			playlistId: 'playlist0',
			rundownId: 'rundown0',
			segmentId: 'segment0',
		},
		{
			_id: 'note-segment1',
			note: 'fake note',
			playlistId: 'playlist0',
			rundownId: 'rundown0',
			segmentId: 'segment1',
		},
	]

	test('basic call', async () => {
		const state: Partial<UISegmentPartNotesState> = {}
		const collection = createSpyPublishCollection()

		await manipulateUISegmentPartNotesPublicationData(
			{
				playlistId,
			},
			state,
			collection,
			undefined
		)

		// Nothing should have changed
		expect(collection.commitChanges()).toEqual([[], { added: [], changed: [], removed: [] }])
		expect(generateNotesForSegment.generateNotesForSegment).toHaveBeenCalledTimes(0)

		// check that everything was removed
		expect(collection.remove).toHaveBeenCalledTimes(1)
		expect(collection.remove).toHaveBeenLastCalledWith(null)
	})

	test('first cache', async () => {
		const playlistId = protectString<RundownPlaylistId>('playlist0')
		const state: Partial<UISegmentPartNotesState> = {}
		const collection = createSpyPublishCollection()
		const newCache = createAndPopulateMockCache()

		await manipulateUISegmentPartNotesPublicationData(
			{
				playlistId,
			},
			state,
			collection,
			{ newCache }
		)

		// Some notes should have been added
		expect(collection.commitChanges()).toEqual([defaultNotes, { added: defaultNotes, changed: [], removed: [] }])
		expect(generateNotesForSegment.generateNotesForSegment).toHaveBeenCalledTimes(2)

		// check that everything was removed and replaced
		expect(collection.remove).toHaveBeenCalledTimes(1)
		expect(collection.remove).toHaveBeenLastCalledWith(null)
		expect(collection.replace).toHaveBeenCalledTimes(2)
	})

	test('replace cache', async () => {
		const playlistId = protectString<RundownPlaylistId>('playlist0')
		const state: Partial<UISegmentPartNotesState> = {}
		const collection = createSpyPublishCollection()
		const newCache = createAndPopulateMockCache()

		// start out normally
		await manipulateUISegmentPartNotesPublicationData(
			{
				playlistId,
			},
			state,
			collection,
			{ newCache }
		)

		// Some notes should have been added
		expect(collection.commitChanges()).toEqual([defaultNotes, { added: defaultNotes, changed: [], removed: [] }])
		expect(generateNotesForSegment.generateNotesForSegment).toHaveBeenCalledTimes(2)
		collection.clearAllMocks()

		const newCache2 = createAndPopulateMockCache()
		newCache2.Segments.remove(segmentId0)

		// replace the cache
		await manipulateUISegmentPartNotesPublicationData(
			{
				playlistId,
			},
			state,
			collection,
			{ newCache: newCache2 }
		)

		// check that everything was removed and replaced
		expect(collection.remove).toHaveBeenCalledTimes(1)
		expect(collection.remove).toHaveBeenLastCalledWith(null)
		expect(collection.replace).toHaveBeenCalledTimes(1)
		expect(collection.commitChanges()).toEqual([
			[defaultNotes[1]],
			{ added: [], changed: [], removed: [defaultNotes[0]._id] },
		])
		expect(generateNotesForSegment.generateNotesForSegment).toHaveBeenCalledTimes(3)
	})

	test('update no reported changes', async () => {
		const playlistId = protectString<RundownPlaylistId>('playlist0')
		const state: Partial<UISegmentPartNotesState> = {}
		const collection = createSpyPublishCollection()
		const newCache = createAndPopulateMockCache()

		// start out normally
		await manipulateUISegmentPartNotesPublicationData(
			{
				playlistId,
			},
			state,
			collection,
			{ newCache }
		)

		// Some notes should have been added
		expect(collection.commitChanges()).toEqual([defaultNotes, { added: defaultNotes, changed: [], removed: [] }])
		expect(generateNotesForSegment.generateNotesForSegment).toHaveBeenCalledTimes(2)
		collection.clearAllMocks()

		// no change
		await manipulateUISegmentPartNotesPublicationData(
			{
				playlistId,
			},
			state,
			collection,
			{ invalidateRundownIds: [], invalidateSegmentIds: [] }
		)

		// check that nothing was done
		expect(collection.remove).toHaveBeenCalledTimes(0)
		expect(collection.replace).toHaveBeenCalledTimes(0)
		expect(generateNotesForSegment.generateNotesForSegment).toHaveBeenCalledTimes(2)
	})

	test('rundown changed', async () => {
		const playlistId = protectString<RundownPlaylistId>('playlist0')
		const state: Partial<UISegmentPartNotesState> = {}
		const collection = createSpyPublishCollection()
		const newCache = createAndPopulateMockCache()

		// start out normally
		await manipulateUISegmentPartNotesPublicationData(
			{
				playlistId,
			},
			state,
			collection,
			{ newCache }
		)

		// Some notes should have been added
		expect(collection.commitChanges()).toEqual([defaultNotes, { added: defaultNotes, changed: [], removed: [] }])
		expect(generateNotesForSegment.generateNotesForSegment).toHaveBeenCalledTimes(2)
		collection.clearAllMocks()

		// invalidate a rundown
		await manipulateUISegmentPartNotesPublicationData(
			{
				playlistId,
			},
			state,
			collection,
			{ invalidateRundownIds: [rundownId] }
		)

		// check that nothing was done
		expect(collection.remove).toHaveBeenCalledTimes(1)
		expect(collection.remove).toHaveBeenLastCalledWith(expect.anything())
		expect(collection.replace).toHaveBeenCalledTimes(2)
		expect(generateNotesForSegment.generateNotesForSegment).toHaveBeenCalledTimes(4)
	})

	test('segment changed', async () => {
		const playlistId = protectString<RundownPlaylistId>('playlist0')
		const state: Partial<UISegmentPartNotesState> = {}
		const collection = createSpyPublishCollection()
		const newCache = createAndPopulateMockCache()

		// start out normally
		await manipulateUISegmentPartNotesPublicationData(
			{
				playlistId,
			},
			state,
			collection,
			{ newCache }
		)

		// Some notes should have been added
		expect(collection.commitChanges()).toEqual([defaultNotes, { added: defaultNotes, changed: [], removed: [] }])
		expect(generateNotesForSegment.generateNotesForSegment).toHaveBeenCalledTimes(2)
		collection.clearAllMocks()

		// invalidate a rundown
		await manipulateUISegmentPartNotesPublicationData(
			{
				playlistId,
			},
			state,
			collection,
			{ invalidateSegmentIds: [segmentId1] }
		)

		// check that nothing was done
		expect(collection.remove).toHaveBeenCalledTimes(1)
		expect(collection.remove).toHaveBeenLastCalledWith(expect.anything())
		expect(collection.replace).toHaveBeenCalledTimes(1)
		expect(generateNotesForSegment.generateNotesForSegment).toHaveBeenCalledTimes(3)
	})

	describe('generateNotesForSegment calls', () => {
		const newCache = createAndPopulateMockCache()
		newCache.Parts.insert({
			_id: 'part0',
			_rank: 1,
			segmentId: segmentId0,
			rundownId: rundownId,
			notes: [],
			title: 'Some part',
			invalid: false,
			invalidReason: undefined,
		})
		newCache.Parts.insert({
			_id: 'part1',
			_rank: 2,
			segmentId: segmentId0,
			rundownId: rundownId,
			notes: [],
			title: 'Another part',
			invalid: false,
			invalidReason: undefined,
		})
		newCache.Parts.insert({
			_id: 'part2',
			_rank: 1,
			segmentId: segmentId1,
			rundownId: rundownId,
			notes: [],
			title: 'Next part',
			invalid: false,
			invalidReason: undefined,
		})
		newCache.PartInstances.insert({
			_id: 'instance0',
			segmentId: segmentId0,
			rundownId: rundownId,
			orphaned: 'deleted',
			reset: false,
			part: 'part' as any,
		})

		test('segment changed', async () => {
			const playlistId = protectString<RundownPlaylistId>('playlist0')
			const state: Partial<UISegmentPartNotesState> = {}
			const collection = createSpyPublishCollection()

			// start out normally
			await manipulateUISegmentPartNotesPublicationData(
				{
					playlistId,
				},
				state,
				collection,
				{ newCache }
			)

			// Some notes should have been added
			expect(collection.commitChanges()).toEqual([
				defaultNotes,
				{ added: defaultNotes, changed: [], removed: [] },
			])
			collection.clearAllMocks()
			expect(generateNotesForSegment.generateNotesForSegment).toHaveBeenCalledTimes(2)
			expect(generateNotesForSegment.generateNotesForSegment).toHaveBeenCalledWith(
				playlistId,
				{
					_id: 'segment0',
					_rank: 1,
					name: 'Segment 0',
					notes: [],
					orphaned: undefined,
					rundownId: 'rundown0',
				},
				'NRCS+ 2000',
				[
					{
						_id: 'part0',
						_rank: 1,
						invalid: false,
						notes: [],
						rundownId: 'rundown0',
						segmentId: 'segment0',
						title: 'Some part',
					},
					{
						_id: 'part1',
						_rank: 2,
						invalid: false,
						notes: [],
						rundownId: 'rundown0',
						segmentId: 'segment0',
						title: 'Another part',
					},
				],
				[
					{
						_id: 'instance0',
						orphaned: 'deleted',
						part: 'part',
						reset: false,
						rundownId: 'rundown0',
						segmentId: 'segment0',
					},
				]
			)
			expect(generateNotesForSegment.generateNotesForSegment).toHaveBeenCalledWith(
				playlistId,
				{
					_id: 'segment1',
					_rank: 1,
					name: 'Segment 1',
					notes: [],
					orphaned: undefined,
					rundownId: 'rundown0',
				},
				'NRCS+ 2000',
				[
					{
						_id: 'part2',
						_rank: 1,
						invalid: false,
						notes: [],
						rundownId: 'rundown0',
						segmentId: 'segment1',
						title: 'Next part',
					},
				],
				[]
			)
		})
	})
})
