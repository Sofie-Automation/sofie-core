import { setupDefaultJobEnvironment } from '../../__mocks__/context.js'
import { handleRemovedPart, handleUpdatedPart } from '../ingestPartJobs.js'
import { clone } from '@sofie-automation/corelib/dist/lib'
import { IngestChangeType, IngestPart, NrcsIngestPartChangeDetails } from '@sofie-automation/blueprints-integration'
import { UpdateIngestRundownChange } from '../runOperation.js'
import { IngestRundownWithSource } from '@sofie-automation/corelib/dist/dataModel/NrcsIngestDataCache'

function getDefaultIngestRundown(): IngestRundownWithSource {
	return {
		externalId: 'rundown0',
		type: 'mos',
		name: 'Rundown',
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
		rundownSource: { type: 'http' },
	}
}

describe('handleRemovedPart', () => {
	it('no rundown', () => {
		const context = setupDefaultJobEnvironment()

		expect(() =>
			handleRemovedPart(
				context,
				{
					rundownExternalId: 'rundown0',
					segmentExternalId: 'segment0',
					partExternalId: 'part0',
				},
				undefined
			)
		).toThrow(/Rundown(.*)not found/)
	})

	it('missing segment', () => {
		const context = setupDefaultJobEnvironment()

		const ingestRundown = getDefaultIngestRundown()

		expect(() =>
			handleRemovedPart(
				context,
				{
					rundownExternalId: 'rundown0',
					segmentExternalId: 'segmentX',
					partExternalId: 'part0',
				},
				clone(ingestRundown)
			)
		).toThrow(/Rundown(.*)does not have a Segment/)
	})

	it('missing part', () => {
		const context = setupDefaultJobEnvironment()

		const ingestRundown = getDefaultIngestRundown()

		const changes = handleRemovedPart(
			context,
			{
				rundownExternalId: 'rundown0',
				segmentExternalId: 'segment0',
				partExternalId: 'partX',
			},
			clone(ingestRundown)
		)
		expect(changes).toEqual({
			ingestRundown,
			changes: {
				// No changes
				source: IngestChangeType.Ingest,
			},
		} satisfies UpdateIngestRundownChange)
	})

	it('part belongs to different segment', () => {
		const context = setupDefaultJobEnvironment()

		const ingestRundown = getDefaultIngestRundown()

		const changes = handleRemovedPart(
			context,
			{
				rundownExternalId: 'rundown0',
				segmentExternalId: 'segment1',
				partExternalId: 'part0',
			},
			clone(ingestRundown)
		)
		expect(changes).toEqual({
			ingestRundown,
			changes: {
				// No changes
				source: IngestChangeType.Ingest,
			},
		} satisfies UpdateIngestRundownChange)
	})

	it('good', () => {
		const context = setupDefaultJobEnvironment()

		const ingestRundown = getDefaultIngestRundown()

		const changes = handleRemovedPart(
			context,
			{
				rundownExternalId: 'rundown0',
				segmentExternalId: 'segment1',
				partExternalId: 'part2',
			},
			clone(ingestRundown)
		)

		// update the expected ingestRundown
		ingestRundown.segments[1].parts.splice(0, 1)

		expect(changes).toEqual({
			ingestRundown,
			changes: {
				source: IngestChangeType.Ingest,
				segmentChanges: {
					segment1: {
						partChanges: {
							part2: NrcsIngestPartChangeDetails.Deleted,
						},
					},
				},
			},
		} satisfies UpdateIngestRundownChange)
	})
})

describe('handleUpdatedPart', () => {
	const newIngestPart: IngestPart = {
		externalId: 'partX',
		name: 'New Part',
		rank: 66,
		payload: {
			val: 'my new part',
		},
	}

	it('no rundown', () => {
		const context = setupDefaultJobEnvironment()

		expect(() =>
			handleUpdatedPart(
				context,
				{
					rundownExternalId: 'rundown0',
					segmentExternalId: 'segment0',
					ingestPart: clone(newIngestPart),
					isCreateAction: true,
				},
				undefined
			)
		).toThrow(/Rundown(.*)not found/)
	})

	it('missing segment', () => {
		const context = setupDefaultJobEnvironment()

		const ingestRundown = getDefaultIngestRundown()

		expect(() =>
			handleUpdatedPart(
				context,
				{
					rundownExternalId: 'rundown0',
					segmentExternalId: 'segmentX',
					ingestPart: clone(newIngestPart),
					isCreateAction: true,
				},
				clone(ingestRundown)
			)
		).toThrow(/Rundown(.*)does not have a Segment/)
	})

	it('insert part', () => {
		const context = setupDefaultJobEnvironment()

		const ingestRundown = getDefaultIngestRundown()

		const changes = handleUpdatedPart(
			context,
			{
				rundownExternalId: 'rundown0',
				segmentExternalId: 'segment1',
				ingestPart: clone(newIngestPart),
				isCreateAction: true,
			},
			clone(ingestRundown)
		)

		// update the expected ingestRundown
		ingestRundown.segments[1].parts.push(newIngestPart)

		expect(changes).toEqual({
			ingestRundown,
			changes: {
				source: IngestChangeType.Ingest,
				segmentChanges: {
					segment1: {
						partChanges: {
							partX: NrcsIngestPartChangeDetails.Inserted,
						},
					},
				},
			},
		} satisfies UpdateIngestRundownChange)
	})

	it('update part', () => {
		const context = setupDefaultJobEnvironment()

		const ingestRundown = getDefaultIngestRundown()

		const newIngestPart2 = { ...newIngestPart, externalId: 'part2' }

		const changes = handleUpdatedPart(
			context,
			{
				rundownExternalId: 'rundown0',
				segmentExternalId: 'segment1',
				ingestPart: clone(newIngestPart2),
				isCreateAction: true,
			},
			clone(ingestRundown)
		)

		// update the expected ingestRundown
		ingestRundown.segments[1].parts.splice(0, 1)
		ingestRundown.segments[1].parts.push(newIngestPart2)

		expect(changes).toEqual({
			ingestRundown,
			changes: {
				source: IngestChangeType.Ingest,
				segmentChanges: {
					segment1: {
						partChanges: {
							part2: NrcsIngestPartChangeDetails.Updated,
						},
					},
				},
			},
		} satisfies UpdateIngestRundownChange)
	})
})
