import { setupDefaultJobEnvironment } from '../../__mocks__/context.js'
import {
	handleRegenerateSegment,
	handleRemovedSegment,
	handleUpdatedSegment,
	handleUpdatedSegmentRanks,
} from '../ingestSegmentJobs.js'
import { clone } from '@sofie-automation/corelib/dist/lib'
import {
	IngestChangeType,
	IngestSegment,
	NrcsIngestSegmentChangeDetailsEnum,
} from '@sofie-automation/blueprints-integration'
import { UpdateIngestRundownChange } from '../runOperation.js'
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
				externalId: 'segment0',
				name: 'Segment 0',
				rank: 0,
				payload: undefined,
				parts: [
					{
						externalId: 'part0',
						name: 'Part 0',
						rank: 0,
						payload: undefined,
					},
					{
						externalId: 'part1',
						name: 'Part 1',
						rank: 1,
						payload: undefined,
					},
				],
			},
			{
				externalId: 'segment1',
				name: 'Segment 1',
				rank: 1,
				payload: undefined,
				parts: [
					{
						externalId: 'part2',
						name: 'Part 2',
						rank: 0,
						payload: undefined,
					},
					{
						externalId: 'part3',
						name: 'Part 3',
						rank: 1,
						payload: undefined,
					},
				],
			},
		],
	}
}

describe('handleRegenerateSegment', () => {
	it('no rundown', () => {
		const context = setupDefaultJobEnvironment()

		expect(() =>
			handleRegenerateSegment(
				context,
				{
					rundownExternalId: 'rundown0',
					segmentExternalId: 'segment0',
				},
				undefined
			)
		).toThrow(/Rundown(.*)not found/)
	})

	it('missing segment', () => {
		const context = setupDefaultJobEnvironment()

		const ingestRundown = getDefaultIngestRundown()

		expect(() =>
			handleRegenerateSegment(
				context,
				{
					rundownExternalId: 'rundown0',
					segmentExternalId: 'segmentX',
				},
				clone(ingestRundown)
			)
		).toThrow(/Rundown(.*)does not have a Segment/)
	})

	it('good', () => {
		const context = setupDefaultJobEnvironment()

		const ingestRundown = getDefaultIngestRundown()

		const changes = handleRegenerateSegment(
			context,
			{
				rundownExternalId: 'rundown0',
				segmentExternalId: 'segment1',
			},
			clone(ingestRundown)
		)

		// update the expected ingestRundown
		// ingestRundown.modified = 1
		// ingestRundown.segments.splice(1, 1)

		expect(changes).toEqual({
			ingestRundown,
			changes: {
				source: IngestChangeType.Ingest,
				segmentChanges: {
					segment1: {
						payloadChanged: true,
					},
				},
			},
		} satisfies UpdateIngestRundownChange)
	})
})

describe('handleRemovedSegment', () => {
	it('no rundown', () => {
		const context = setupDefaultJobEnvironment()

		expect(() =>
			handleRemovedSegment(
				context,
				{
					rundownExternalId: 'rundown0',
					segmentExternalId: 'segment0',
				},
				undefined
			)
		).toThrow(/Rundown(.*)not found/)
	})

	it('missing segment', () => {
		const context = setupDefaultJobEnvironment()

		const ingestRundown = getDefaultIngestRundown()

		expect(() =>
			handleRemovedSegment(
				context,
				{
					rundownExternalId: 'rundown0',
					segmentExternalId: 'segmentX',
				},
				clone(ingestRundown)
			)
		).toThrow(/Rundown(.*)does not have a Segment/)
	})

	it('good', () => {
		const context = setupDefaultJobEnvironment()

		const ingestRundown = getDefaultIngestRundown()

		const changes = handleRemovedSegment(
			context,
			{
				rundownExternalId: 'rundown0',
				segmentExternalId: 'segment1',
			},
			clone(ingestRundown)
		)

		// update the expected ingestRundown
		ingestRundown.segments.splice(1, 1)

		expect(changes).toEqual({
			ingestRundown,
			changes: {
				source: IngestChangeType.Ingest,
				segmentChanges: {
					segment1: NrcsIngestSegmentChangeDetailsEnum.Deleted,
				},
			},
		} satisfies UpdateIngestRundownChange)
	})
})

describe('handleUpdatedSegment', () => {
	const newIngestSegment: IngestSegment = {
		externalId: 'segmentX',
		name: 'New Segment',
		rank: 66,
		payload: {
			val: 'my new segment',
		},
		parts: [
			{
				externalId: 'partX',
				name: 'New Part',
				rank: 0,
				payload: undefined,
			},
		],
	}

	it('no rundown', () => {
		const context = setupDefaultJobEnvironment()

		expect(() =>
			handleUpdatedSegment(context, {
				rundownExternalId: 'rundown0',
				ingestSegment: clone(newIngestSegment),
				isCreateAction: true,
			})(undefined)
		).toThrow(/Rundown(.*)not found/)
	})

	it('missing id', () => {
		const context = setupDefaultJobEnvironment()

		const ingestRundown = getDefaultIngestRundown()

		const customIngestSegment = clone(newIngestSegment)
		customIngestSegment.externalId = ''

		expect(() =>
			handleUpdatedSegment(context, {
				rundownExternalId: 'rundown0',
				ingestSegment: customIngestSegment,
				isCreateAction: true,
			})(clone(ingestRundown))
		).toThrow(/Segment externalId must be set!/)
	})

	it('insert segment', () => {
		const context = setupDefaultJobEnvironment()

		const ingestRundown = getDefaultIngestRundown()

		const changes = handleUpdatedSegment(context, {
			rundownExternalId: 'rundown0',
			ingestSegment: clone(newIngestSegment),
			isCreateAction: true,
		})(clone(ingestRundown)) as UpdateIngestRundownChange

		// update the expected ingestRundown
		ingestRundown.segments.push(newIngestSegment)

		expect(changes).toEqual({
			ingestRundown,
			changes: {
				source: IngestChangeType.Ingest,
				segmentChanges: {
					segmentX: NrcsIngestSegmentChangeDetailsEnum.InsertedOrUpdated,
				},
			},
		} satisfies UpdateIngestRundownChange)
	})

	it('update missing segment', () => {
		const context = setupDefaultJobEnvironment()

		const ingestRundown = getDefaultIngestRundown()

		expect(() =>
			handleUpdatedSegment(context, {
				rundownExternalId: 'rundown0',
				ingestSegment: clone(newIngestSegment),
				isCreateAction: false,
			})(clone(ingestRundown))
		).toThrow(/Segment(.*)not found/)
	})

	it('update segment', () => {
		const context = setupDefaultJobEnvironment()

		const ingestRundown = getDefaultIngestRundown()

		const customIngestSegment = clone(newIngestSegment)
		customIngestSegment.externalId = 'segment1'

		const changes = handleUpdatedSegment(context, {
			rundownExternalId: 'rundown0',
			ingestSegment: clone(customIngestSegment),
			isCreateAction: false, // has no impact
		})(clone(ingestRundown)) as UpdateIngestRundownChange

		// update the expected ingestRundown
		ingestRundown.segments.splice(1, 1, customIngestSegment)

		expect(changes).toEqual({
			ingestRundown,
			changes: {
				source: IngestChangeType.Ingest,
				segmentChanges: {
					segment1: NrcsIngestSegmentChangeDetailsEnum.InsertedOrUpdated,
				},
			},
		} satisfies UpdateIngestRundownChange)
	})
})

describe('handleUpdatedSegmentRanks', () => {
	it('no rundown', () => {
		const context = setupDefaultJobEnvironment()

		expect(() =>
			handleUpdatedSegmentRanks(
				context,
				{
					rundownExternalId: 'rundown0',
					newRanks: {
						segment0: 1,
						segment1: 0,
					},
				},
				undefined
			)
		).toThrow(/Rundown(.*)not found/)
	})

	it('no valid changes', () => {
		const context = setupDefaultJobEnvironment()

		const ingestRundown = getDefaultIngestRundown()

		const changes = handleUpdatedSegmentRanks(
			context,
			{
				rundownExternalId: 'rundown0',
				newRanks: {
					segmentX: 2,
				},
			},
			clone(ingestRundown)
		)

		expect(changes).toEqual({
			ingestRundown,
			changes: {
				source: IngestChangeType.Ingest,
				segmentOrderChanged: false,
			},
		} satisfies UpdateIngestRundownChange)
	})

	it('update some segments', () => {
		const context = setupDefaultJobEnvironment()

		const ingestRundown = getDefaultIngestRundown()

		const changes = handleUpdatedSegmentRanks(
			context,
			{
				rundownExternalId: 'rundown0',
				newRanks: {
					segmentX: 2,
					segment0: 5,
				},
			},
			clone(ingestRundown)
		)

		ingestRundown.segments[0].rank = 5
		expect(changes).toEqual({
			ingestRundown,
			changes: {
				source: IngestChangeType.Ingest,
				segmentOrderChanged: true,
			},
		} satisfies UpdateIngestRundownChange)
	})

	it('invalid rank value type', () => {
		const context = setupDefaultJobEnvironment()

		const ingestRundown = getDefaultIngestRundown()

		const changes = handleUpdatedSegmentRanks(
			context,
			{
				rundownExternalId: 'rundown0',
				newRanks: {
					segmentX: 2,
					segment0: 'a' as any,
				},
			},
			clone(ingestRundown)
		)

		expect(changes).toEqual({
			ingestRundown,
			changes: {
				source: IngestChangeType.Ingest,
				segmentOrderChanged: false,
			},
		} satisfies UpdateIngestRundownChange)
	})
})

// Future: tests for handleRemoveOrphanedSegemnts
