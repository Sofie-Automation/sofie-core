import type { IngestRundown, IngestSegment } from '@sofie-automation/shared-lib/dist/peripheralDevice/ingest'
import type { IStudioContext } from './studioContext.js'
import type { IngestDefaultChangesOptions, MutableIngestRundown, NrcsIngestChangeDetails } from '../ingest.js'

export interface IProcessIngestDataContext extends IStudioContext {
	/**
	 * Perform the default syncing of changes from the ingest data to the rundown.
	 *
	 * Please note that this may be overly aggressive at removing any changes made by user operations
	 * If you are using user operations, you may need to perform some pre and post fixups to ensure
	 * changes aren't wiped unnecessarily.
	 *
	 * @param ingestRundown NRCS version of the IngestRundown to copy from
	 * @param ingestChanges A description of the changes that have been made to the rundown and should be propagated
	 * @param options Options for how to apply the changes
	 */
	defaultApplyIngestChanges<TRundownPayload, TSegmentPayload, TPartPayload>(
		mutableIngestRundown: MutableIngestRundown<TRundownPayload, TSegmentPayload, TPartPayload>,
		ingestRundown: IngestRundown,
		ingestChanges: NrcsIngestChangeDetails,
		options?: IngestDefaultChangesOptions<TRundownPayload, TSegmentPayload, TPartPayload>
	): void

	/**
	 * Group the Parts in a MOS Rundown and return a new changes object
	 * This will group the Parts based on the segment name, using the separator provided to extract the segment name from the part name
	 *
	 * Please note that this ignores some of the granularity of the `ingestChanges` object, and relies more on the `previousIngestRundown` instead
	 * If you are using user operations, you may need to perform some pre and post fixups to ensure changes aren't wiped unnecessarily.
	 *
	 * @param ingestRundown The rundown whose parts needs grouping
	 * @param previousIngestRundown The rundown prior to the changes, if known
	 * @param ingestChanges The changes which have been performed in `ingestRundown`, that need to translating
	 * @param partNameSeparator A string to split the part name on
	 * @returns A transformed rundown and changes object
	 */
	groupMosPartsInRundownAndChangesWithSeparator(
		ingestRundown: IngestRundown,
		previousIngestRundown: IngestRundown | undefined,
		ingestChanges: NrcsIngestChangeDetails,
		partNameSeparator: string
	): GroupPartsInMosRundownAndChangesResult

	/**
	 * Group Parts in a Rundown and return a new changes object
	 *
	 * Please note that this ignores some of the granularity of the `ingestChanges` object, and relies more on the `previousIngestRundown` instead
	 * If you are using user operations, you may need to perform some pre and post fixups to ensure changes aren't wiped unnecessarily.
	 *
	 * @param ingestRundown The rundown whose parts needs grouping
	 * @param previousIngestRundown The rundown prior to the changes, if known
	 * @param ingestChanges The changes which have been performed in `ingestRundown`, that need to translating
	 * @param groupPartsIntoSegments A function to group parts into segments
	 * @returns A transformed rundown and changes object
	 */
	groupPartsInRundownAndChanges<TRundownPayload = unknown, TSegmentPayload = unknown, TPartPayload = unknown>(
		ingestRundown: IngestRundown,
		previousIngestRundown: IngestRundown | undefined,
		ingestChanges: NrcsIngestChangeDetails,
		groupPartsIntoSegments: (ingestSegments: IngestSegment[]) => IngestSegment<TSegmentPayload, TPartPayload>[]
	): GroupPartsInMosRundownAndChangesResult<TRundownPayload, TSegmentPayload, TPartPayload>
}

export interface GroupPartsInMosRundownAndChangesResult<
	TRundownPayload = unknown,
	TSegmentPayload = unknown,
	TPartPayload = unknown,
> {
	nrcsIngestRundown: IngestRundown<TRundownPayload, TSegmentPayload, TPartPayload>
	ingestChanges: NrcsIngestChangeDetails
}
