import { JobContext } from '../jobs/index.js'
import { IngestRemovePartProps, IngestUpdatePartProps } from '@sofie-automation/corelib/dist/worker/ingest'
import { UpdateIngestRundownChange } from './runOperation.js'
import { IngestChangeType, NrcsIngestPartChangeDetails } from '@sofie-automation/blueprints-integration'
import { IngestRundownWithSource } from '@sofie-automation/corelib/dist/dataModel/NrcsIngestDataCache'

/**
 * Remove a Part from a Segment
 */
export function handleRemovedPart(
	_context: JobContext,
	data: IngestRemovePartProps,
	ingestRundown: IngestRundownWithSource | undefined
): UpdateIngestRundownChange {
	if (!ingestRundown) throw new Error(`Rundown "${data.rundownExternalId}" not found`)

	const ingestSegment = ingestRundown.segments.find((s) => s.externalId === data.segmentExternalId)
	if (!ingestSegment) {
		throw new Error(
			`Rundown "${data.rundownExternalId}" does not have a Segment "${data.segmentExternalId}" to update`
		)
	}
	const partCountBefore = ingestSegment.parts.length
	ingestSegment.parts = ingestSegment.parts.filter((p) => p.externalId !== data.partExternalId)

	if (partCountBefore === ingestSegment.parts.length) {
		return {
			// No change
			ingestRundown,
			changes: {
				source: IngestChangeType.Ingest,
			},
		} satisfies UpdateIngestRundownChange
	}

	return {
		// We modify in-place
		ingestRundown,
		changes: {
			source: IngestChangeType.Ingest,
			segmentChanges: {
				[data.segmentExternalId]: {
					partChanges: {
						[data.partExternalId]: NrcsIngestPartChangeDetails.Deleted,
					},
				},
			},
		},
	} satisfies UpdateIngestRundownChange
}

/**
 * Insert or update a Part in a Segment
 */
export function handleUpdatedPart(
	_context: JobContext,
	data: IngestUpdatePartProps,
	ingestRundown: IngestRundownWithSource | undefined
): UpdateIngestRundownChange {
	if (!ingestRundown) throw new Error(`Rundown "${data.rundownExternalId}" not found`)

	const ingestSegment = ingestRundown.segments.find((s) => s.externalId === data.segmentExternalId)
	if (!ingestSegment) {
		throw new Error(
			`Rundown "${data.rundownExternalId}" does not have a Segment "${data.segmentExternalId}" to update`
		)
	}
	const partCountBefore = ingestSegment.parts.length
	ingestSegment.parts = ingestSegment.parts.filter((p) => p.externalId !== data.ingestPart.externalId)
	const isUpdate = partCountBefore !== ingestSegment.parts.length

	ingestSegment.parts.push(data.ingestPart)

	return {
		// We modify in-place
		ingestRundown,
		changes: {
			source: IngestChangeType.Ingest,
			segmentChanges: {
				[data.segmentExternalId]: {
					partChanges: {
						[data.ingestPart.externalId]: isUpdate
							? NrcsIngestPartChangeDetails.Updated
							: NrcsIngestPartChangeDetails.Inserted,
					},
				},
			},
		},
	} satisfies UpdateIngestRundownChange
}
