import type {
	GroupPartsInMosRundownAndChangesResult,
	IProcessIngestDataContext,
	IngestDefaultChangesOptions,
	IngestRundown,
	IngestSegment,
	MutableIngestRundown,
	NrcsIngestChangeDetails,
} from '@sofie-automation/blueprints-integration'
import { StudioContext } from './StudioContext.js'
import { defaultApplyIngestChanges } from '../ingest/defaultApplyIngestChanges.js'
import {
	groupMosPartsIntoIngestSegments,
	groupPartsInRundownAndChanges,
} from '../ingest/groupPartsInRundownAndChanges.js'

/**
 * Provides a context for blueprints while running the blueprints.processIngestData() method.
 * Note: This provides some common helpers for doing mutations of the IngestRundown.
 * Custom updates of the IngestRundown are done by calling methods on the mutableIngestRundown itself.
 */
export class ProcessIngestDataContext extends StudioContext implements IProcessIngestDataContext {
	defaultApplyIngestChanges<TRundownPayload, TSegmentPayload, TPartPayload>(
		mutableIngestRundown: MutableIngestRundown<TRundownPayload, TSegmentPayload, TPartPayload>,
		nrcsIngestRundown: IngestRundown,
		ingestChanges: NrcsIngestChangeDetails,
		options?: IngestDefaultChangesOptions<TRundownPayload, TSegmentPayload, TPartPayload>
	): void {
		defaultApplyIngestChanges(mutableIngestRundown, nrcsIngestRundown, ingestChanges, {
			transformRundownPayload: (payload) => payload as TRundownPayload,
			transformSegmentPayload: (payload) => payload as TSegmentPayload,
			transformPartPayload: (payload) => payload as TPartPayload,
			...options,
		})
	}

	groupMosPartsInRundownAndChangesWithSeparator(
		ingestRundown: IngestRundown,
		previousIngestRundown: IngestRundown | undefined,
		ingestChanges: NrcsIngestChangeDetails,
		partNameSeparator: string
	): GroupPartsInMosRundownAndChangesResult {
		if (ingestRundown.type !== 'mos') throw new Error('Only supported for mos rundowns')

		return groupPartsInRundownAndChanges(ingestRundown, previousIngestRundown, ingestChanges, (segments) =>
			groupMosPartsIntoIngestSegments(ingestRundown.externalId, segments, partNameSeparator)
		)
	}

	groupPartsInRundownAndChanges<TRundownPayload = unknown, TSegmentPayload = unknown, TPartPayload = unknown>(
		ingestRundown: IngestRundown,
		previousIngestRundown: IngestRundown | undefined,
		ingestChanges: NrcsIngestChangeDetails,
		groupPartsIntoSegments: (ingestSegments: IngestSegment[]) => IngestSegment<TSegmentPayload, TPartPayload>[]
	): GroupPartsInMosRundownAndChangesResult<TRundownPayload, TSegmentPayload, TPartPayload> {
		return groupPartsInRundownAndChanges<TRundownPayload, TSegmentPayload, TPartPayload>(
			ingestRundown,
			previousIngestRundown,
			ingestChanges,
			groupPartsIntoSegments
		)
	}
}
