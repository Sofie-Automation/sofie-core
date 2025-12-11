import { setupDefaultJobEnvironment } from '../../../__mocks__/context.js'
import { clone } from '@sofie-automation/corelib/dist/lib'
import {
	IngestChangeType,
	MOS,
	NrcsIngestPartChangeDetails,
	NrcsIngestSegmentChangeDetailsEnum,
} from '@sofie-automation/blueprints-integration'
import {
	handleMosDeleteStory,
	handleMosFullStory,
	handleMosInsertStories,
	handleMosMoveStories,
	handleMosSwapStories,
} from '../mosStoryJobs.js'
import { IngestUpdateOperationFunction, UpdateIngestRundownChange } from '../../runOperation.js'
import { IngestRundownWithSource } from '@sofie-automation/corelib/dist/dataModel/NrcsIngestDataCache'

function getDefaultIngestRundown(): IngestRundownWithSource {
	return {
		externalId: 'rundown0',
		type: 'mos',
		name: 'Rundown',
		rundownSource: { type: 'http' },
		payload: undefined,
		segments: [
			{
				externalId: 'segment-part0',
				name: 'Part 0',
				rank: 0,
				payload: undefined,
				parts: [
					{
						externalId: 'part0',
						name: 'Part 0',
						rank: 0,
						payload: undefined,
					},
				],
			},
			{
				externalId: 'segment-part1',
				name: 'Part 1',
				rank: 1,
				payload: undefined,
				parts: [
					{
						externalId: 'part1',
						name: 'Part 1',
						rank: 0,
						payload: undefined,
					},
				],
			},
			{
				externalId: 'segment-part2',
				name: 'Part 2',
				rank: 2,
				payload: undefined,
				parts: [
					{
						externalId: 'part2',
						name: 'Part 2',
						rank: 0,
						payload: undefined,
					},
				],
			},
			{
				externalId: 'segment-part3',
				name: 'Part 3',
				rank: 3,
				payload: undefined,
				parts: [
					{
						externalId: 'part3',
						name: 'Part 3',
						rank: 0,
						payload: undefined,
					},
				],
			},
		],
	}
}

const mosTypes = MOS.getMosTypes(false)

describe('handleMosDeleteStory', () => {
	it('no stories', () => {
		const context = setupDefaultJobEnvironment()

		expect(
			handleMosDeleteStory(context, {
				rundownExternalId: 'rundown0',
				stories: [],
			})
		).toBeNull()
	})

	it('no rundown', () => {
		const context = setupDefaultJobEnvironment()

		const executeJob = handleMosDeleteStory(context, {
			rundownExternalId: 'rundown0',
			stories: [mosTypes.mosString128.create('story0')],
		}) as IngestUpdateOperationFunction
		expect(executeJob).toBeTruthy()

		expect(() => executeJob(undefined)).toThrow(/Rundown(.*)not found/)
	})

	it('missing story', () => {
		const context = setupDefaultJobEnvironment()

		const ingestRundown = getDefaultIngestRundown()

		const executeJob = handleMosDeleteStory(context, {
			rundownExternalId: 'rundown0',
			stories: [mosTypes.mosString128.create('story0')],
		}) as IngestUpdateOperationFunction
		expect(executeJob).toBeTruthy()

		expect(() => executeJob(clone(ingestRundown))).toThrow(/in rundown(.*)were not found/)
	})

	it('mixed found and missing', () => {
		const context = setupDefaultJobEnvironment()

		const ingestRundown = getDefaultIngestRundown()

		const executeJob = handleMosDeleteStory(context, {
			rundownExternalId: 'rundown0',
			stories: [
				mosTypes.mosString128.create('story0'), // missing
				mosTypes.mosString128.create('part1'), // exists
			],
		}) as IngestUpdateOperationFunction
		expect(executeJob).toBeTruthy()

		expect(() => executeJob(clone(ingestRundown))).toThrow(/in rundown(.*)were not found/)
	})

	it('good', () => {
		const context = setupDefaultJobEnvironment()

		const ingestRundown = getDefaultIngestRundown()

		const executeJob = handleMosDeleteStory(context, {
			rundownExternalId: 'rundown0',
			stories: [
				mosTypes.mosString128.create('part1'), // exists
			],
		}) as IngestUpdateOperationFunction
		expect(executeJob).toBeTruthy()

		const changes = executeJob(clone(ingestRundown))

		// update the expected ingestRundown
		ingestRundown.segments.splice(1, 1)

		expect(changes).toEqual({
			ingestRundown,
			changes: {
				source: IngestChangeType.Ingest,
				segmentChanges: {
					'segment-part1': NrcsIngestSegmentChangeDetailsEnum.Deleted,
				},
			},
		} satisfies UpdateIngestRundownChange)
	})
})

describe('handleMosFullStory', () => {
	const newMosStory: MOS.IMOSROFullStory = {
		ID: mosTypes.mosString128.create('part1'),
		RunningOrderId: mosTypes.mosString128.create('rundown0'),
		Body: [
			{
				itemType: 'other',
				Type: 'p',
				Content: 'Hello World!',
			},
		],
	}

	it('no rundown', () => {
		const context = setupDefaultJobEnvironment()

		const executeJob = handleMosFullStory(context, {
			rundownExternalId: 'rundown0',
			story: clone(newMosStory),
		}) as IngestUpdateOperationFunction
		expect(executeJob).toBeTruthy()

		expect(() => executeJob(undefined)).toThrow(/Rundown(.*)not found/)
	})

	it('missing story', () => {
		const context = setupDefaultJobEnvironment()

		const ingestRundown = getDefaultIngestRundown()

		const executeJob = handleMosFullStory(context, {
			rundownExternalId: 'rundown0',
			story: {
				...clone(newMosStory),
				ID: mosTypes.mosString128.create('storyX'),
			},
		}) as IngestUpdateOperationFunction
		expect(executeJob).toBeTruthy()

		expect(() => executeJob(clone(ingestRundown))).toThrow(/Missing MOS Story(.*)in Rundown/)
	})

	it('good', () => {
		const context = setupDefaultJobEnvironment()

		const ingestRundown = getDefaultIngestRundown()

		const executeJob = handleMosFullStory(context, {
			rundownExternalId: 'rundown0',
			story: clone(newMosStory),
		}) as IngestUpdateOperationFunction
		expect(executeJob).toBeTruthy()

		const changes = executeJob(clone(ingestRundown))

		// update the expected ingestRundown
		ingestRundown.segments[1].parts[0].payload = newMosStory

		expect(changes).toEqual({
			ingestRundown,
			changes: {
				source: IngestChangeType.Ingest,
				segmentChanges: {
					'segment-part1': {
						partChanges: {
							part1: NrcsIngestPartChangeDetails.Updated,
						},
					},
				},
			},
		} satisfies UpdateIngestRundownChange)
	})
})

describe('handleMosInsertStories', () => {
	function createMockStory(id: string, slug: string): MOS.IMOSROStory {
		return {
			ID: mosTypes.mosString128.create(id),
			Slug: mosTypes.mosString128.create(slug),
			Items: [],
		}
	}

	it('no rundown', () => {
		const context = setupDefaultJobEnvironment()

		const newStory = createMockStory('partX', 'Part X')

		const executeJob = handleMosInsertStories(context, {
			rundownExternalId: 'rundown0',
			newStories: [newStory],
			insertBeforeStoryId: null,
			replace: false,
		}) as IngestUpdateOperationFunction
		expect(executeJob).toBeTruthy()

		expect(() => executeJob(undefined)).toThrow(/Rundown(.*)not found/)
	})

	it('no stories', () => {
		const context = setupDefaultJobEnvironment()

		const executeJob = handleMosInsertStories(context, {
			rundownExternalId: 'rundown0',
			newStories: [],
			insertBeforeStoryId: null,
			replace: false,
		}) as IngestUpdateOperationFunction
		expect(executeJob).toBeNull()
	})

	it('unknown insertBeforeStoryId', () => {
		const context = setupDefaultJobEnvironment()

		const ingestRundown = getDefaultIngestRundown()
		const newStory = createMockStory('partX', 'Part X')

		const executeJob = handleMosInsertStories(context, {
			rundownExternalId: 'rundown0',
			newStories: [newStory],
			insertBeforeStoryId: mosTypes.mosString128.create('storyX'),
			replace: false,
		}) as IngestUpdateOperationFunction
		expect(executeJob).toBeTruthy()

		expect(() => executeJob(clone(ingestRundown))).toThrow(/Part (.*)in rundown(.*)not found/)
	})

	it('insert in middle', () => {
		const context = setupDefaultJobEnvironment()

		const ingestRundown = getDefaultIngestRundown()
		const newStory = createMockStory('partX', 'Part X')

		const executeJob = handleMosInsertStories(context, {
			rundownExternalId: 'rundown0',
			newStories: [newStory],
			insertBeforeStoryId: mosTypes.mosString128.create('part1'),
			replace: false,
		}) as IngestUpdateOperationFunction
		expect(executeJob).toBeTruthy()

		const changes = executeJob(clone(ingestRundown))

		// update the expected ingestRundown
		ingestRundown.segments.splice(1, 0, {
			externalId: 'segment-partX',
			name: 'Part X',
			rank: 1,
			payload: undefined,
			parts: [
				{
					externalId: 'partX',
					name: 'Part X',
					rank: 0,
					payload: undefined,
				},
			],
		})
		ingestRundown.segments[2].rank = 2
		ingestRundown.segments[3].rank = 3
		ingestRundown.segments[4].rank = 4

		expect(changes).toEqual({
			ingestRundown,
			changes: {
				source: IngestChangeType.Ingest,
				segmentChanges: {
					'segment-partX': NrcsIngestSegmentChangeDetailsEnum.InsertedOrUpdated,
				},
				segmentOrderChanged: true,
			},
		} satisfies UpdateIngestRundownChange)
	})

	it('insert in middle, with replace', () => {
		const context = setupDefaultJobEnvironment()

		const ingestRundown = getDefaultIngestRundown()
		const newStory = createMockStory('partX', 'Part X')

		const executeJob = handleMosInsertStories(context, {
			rundownExternalId: 'rundown0',
			newStories: [newStory],
			insertBeforeStoryId: mosTypes.mosString128.create('part1'),
			replace: true,
		}) as IngestUpdateOperationFunction
		expect(executeJob).toBeTruthy()

		const changes = executeJob(clone(ingestRundown))

		// update the expected ingestRundown
		ingestRundown.segments.splice(1, 1, {
			externalId: 'segment-partX',
			name: 'Part X',
			rank: 1,
			payload: undefined,
			parts: [
				{
					externalId: 'partX',
					name: 'Part X',
					rank: 0,
					payload: undefined,
				},
			],
		})

		expect(changes).toEqual({
			ingestRundown,
			changes: {
				source: IngestChangeType.Ingest,
				segmentChanges: {
					'segment-part1': NrcsIngestSegmentChangeDetailsEnum.Deleted,
					'segment-partX': NrcsIngestSegmentChangeDetailsEnum.InsertedOrUpdated,
				},
				segmentOrderChanged: true,
			},
		} satisfies UpdateIngestRundownChange)
	})

	it('insert at end', () => {
		const context = setupDefaultJobEnvironment()

		const ingestRundown = getDefaultIngestRundown()
		const newStory = createMockStory('partX', 'Part X')

		const executeJob = handleMosInsertStories(context, {
			rundownExternalId: 'rundown0',
			newStories: [newStory],
			insertBeforeStoryId: null,
			replace: true,
		}) as IngestUpdateOperationFunction
		expect(executeJob).toBeTruthy()

		const changes = executeJob(clone(ingestRundown))

		// update the expected ingestRundown
		ingestRundown.segments.push({
			externalId: 'segment-partX',
			name: 'Part X',
			rank: 4,
			payload: undefined,
			parts: [
				{
					externalId: 'partX',
					name: 'Part X',
					rank: 0,
					payload: undefined,
				},
			],
		})

		expect(changes).toEqual({
			ingestRundown,
			changes: {
				source: IngestChangeType.Ingest,
				segmentChanges: {
					'segment-partX': NrcsIngestSegmentChangeDetailsEnum.InsertedOrUpdated,
				},
				segmentOrderChanged: true,
			},
		} satisfies UpdateIngestRundownChange)
	})
})

describe('handleMosSwapStories', () => {
	it('no rundown', () => {
		const context = setupDefaultJobEnvironment()

		const executeJob = handleMosSwapStories(context, {
			rundownExternalId: 'rundown0',
			story0: mosTypes.mosString128.create('part1'),
			story1: mosTypes.mosString128.create('part3'),
		}) as IngestUpdateOperationFunction
		expect(executeJob).toBeTruthy()

		expect(() => executeJob(undefined)).toThrow(/Rundown(.*)not found/)
	})

	it('swap with itself', () => {
		const context = setupDefaultJobEnvironment()

		const executeJob = handleMosSwapStories(context, {
			rundownExternalId: 'rundown0',
			story0: mosTypes.mosString128.create('part1'),
			story1: mosTypes.mosString128.create('part1'),
		}) as IngestUpdateOperationFunction
		expect(executeJob).toBeNull()
	})

	it('missing story0', () => {
		const context = setupDefaultJobEnvironment()

		const ingestRundown = getDefaultIngestRundown()

		const executeJob = handleMosSwapStories(context, {
			rundownExternalId: 'rundown0',
			story0: mosTypes.mosString128.create('partX'),
			story1: mosTypes.mosString128.create('part3'),
		}) as IngestUpdateOperationFunction
		expect(executeJob).toBeTruthy()

		expect(() => executeJob(clone(ingestRundown))).toThrow(/Story (.*)not found in rundown(.*)/)
	})

	it('missing story1', () => {
		const context = setupDefaultJobEnvironment()

		const ingestRundown = getDefaultIngestRundown()

		const executeJob = handleMosSwapStories(context, {
			rundownExternalId: 'rundown0',
			story0: mosTypes.mosString128.create('part1'),
			story1: mosTypes.mosString128.create('partX'),
		}) as IngestUpdateOperationFunction
		expect(executeJob).toBeTruthy()

		expect(() => executeJob(clone(ingestRundown))).toThrow(/Story (.*)not found in rundown(.*)/)
	})

	it('swap', () => {
		const context = setupDefaultJobEnvironment()

		const ingestRundown = getDefaultIngestRundown()

		const executeJob = handleMosSwapStories(context, {
			rundownExternalId: 'rundown0',
			story0: mosTypes.mosString128.create('part1'),
			story1: mosTypes.mosString128.create('part3'),
		}) as IngestUpdateOperationFunction
		expect(executeJob).toBeTruthy()

		const changes = executeJob(clone(ingestRundown))

		// update the expected ingestRundown
		const oldPart3 = ingestRundown.segments.splice(3, 1, ingestRundown.segments[1])
		ingestRundown.segments.splice(1, 1, ...oldPart3)
		ingestRundown.segments[1].rank = 1
		ingestRundown.segments[3].rank = 3

		expect(changes).toEqual({
			ingestRundown,
			changes: {
				source: IngestChangeType.Ingest,
				segmentOrderChanged: true,
			},
		} satisfies UpdateIngestRundownChange)
	})
})

describe('handleMosMoveStories', () => {
	it('no rundown', () => {
		const context = setupDefaultJobEnvironment()

		const executeJob = handleMosMoveStories(context, {
			rundownExternalId: 'rundown0',
			insertBeforeStoryId: null,
			stories: [mosTypes.mosString128.create('part3')],
		}) as IngestUpdateOperationFunction
		expect(executeJob).toBeTruthy()

		expect(() => executeJob(undefined)).toThrow(/Rundown(.*)not found/)
	})

	it('no stories', () => {
		const context = setupDefaultJobEnvironment()

		const executeJob = handleMosMoveStories(context, {
			rundownExternalId: 'rundown0',
			insertBeforeStoryId: mosTypes.mosString128.create('part1'),
			stories: [],
		}) as IngestUpdateOperationFunction
		expect(executeJob).toBeNull()
	})

	it('missing story', () => {
		const context = setupDefaultJobEnvironment()

		const ingestRundown = getDefaultIngestRundown()

		const executeJob = handleMosMoveStories(context, {
			rundownExternalId: 'rundown0',
			insertBeforeStoryId: null,
			stories: [mosTypes.mosString128.create('partX'), mosTypes.mosString128.create('part3')],
		}) as IngestUpdateOperationFunction
		expect(executeJob).toBeTruthy()

		expect(() => executeJob(clone(ingestRundown))).toThrow(/were not found(.*)in rundown/)
	})

	it('move to end', () => {
		const context = setupDefaultJobEnvironment()

		const ingestRundown = getDefaultIngestRundown()

		const executeJob = handleMosMoveStories(context, {
			rundownExternalId: 'rundown0',
			insertBeforeStoryId: null,
			stories: [mosTypes.mosString128.create('part1')],
		}) as IngestUpdateOperationFunction
		expect(executeJob).toBeTruthy()

		const changes = executeJob(clone(ingestRundown))

		// update the expected ingestRundown
		const oldPart1 = ingestRundown.segments.splice(1, 1)
		ingestRundown.segments.push(...oldPart1)
		ingestRundown.segments[1].rank = 1
		ingestRundown.segments[2].rank = 2
		ingestRundown.segments[3].rank = 3

		expect(changes).toEqual({
			ingestRundown,
			changes: {
				source: IngestChangeType.Ingest,
				segmentOrderChanged: true,
			},
		} satisfies UpdateIngestRundownChange)
	})

	it('move to middle', () => {
		const context = setupDefaultJobEnvironment()

		const ingestRundown = getDefaultIngestRundown()

		const executeJob = handleMosMoveStories(context, {
			rundownExternalId: 'rundown0',
			insertBeforeStoryId: mosTypes.mosString128.create('part1'),
			stories: [mosTypes.mosString128.create('part2')],
		}) as IngestUpdateOperationFunction
		expect(executeJob).toBeTruthy()

		const changes = executeJob(clone(ingestRundown))

		// update the expected ingestRundown
		const oldPart2 = ingestRundown.segments.splice(2, 1)
		ingestRundown.segments.splice(1, 0, ...oldPart2)
		ingestRundown.segments[1].rank = 1
		ingestRundown.segments[2].rank = 2

		expect(changes).toEqual({
			ingestRundown,
			changes: {
				source: IngestChangeType.Ingest,
				segmentOrderChanged: true,
			},
		} satisfies UpdateIngestRundownChange)
	})
})
