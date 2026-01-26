import { JobContext } from '../../jobs/index.js'
import { IngestJobs, IngestJobFunc } from '@sofie-automation/corelib/dist/worker/ingest'
import {
	handleMosDeleteStory,
	handleMosFullStory,
	handleMosInsertStories,
	handleMosMoveStories,
	handleMosSwapStories,
} from '../../ingest/mosDevice/mosStoryJobs.js'
import {
	handleMosRundownData,
	handleMosRundownMetadata,
	handleMosRundownReadyToAir,
	handleMosRundownStatus,
} from '../../ingest/mosDevice/mosRundownJobs.js'
import {
	handleRegenerateRundown,
	handleRemovedRundown,
	handleUpdatedRundown,
	handleUpdatedRundownMetaData,
	handleUserRemoveRundown,
	handleUserUnsyncRundown,
} from '../../ingest/ingestRundownJobs.js'
import { handleRemovedPart, handleUpdatedPart } from '../../ingest/ingestPartJobs.js'
import {
	handleRegenerateSegment,
	handleRemovedSegment,
	handleRemoveOrphanedSegemnts,
	handleUpdatedSegment,
	handleUpdatedSegmentRanks,
} from '../../ingest/ingestSegmentJobs.js'
import { handleUpdatedPackageInfoForRundown } from '../../ingest/packageInfo.js'
import {
	handleBucketActionModify,
	handleBucketActionRegenerateExpectedPackages,
	handleBucketEmpty,
	handleBucketPieceModify,
	handleBucketRemoveAdlibAction,
	handleBucketRemoveAdlibPiece,
} from '../../ingest/bucket/bucketAdlibs.js'
import { handleBucketItemImport, handleBucketItemRegenerate } from '../../ingest/bucket/import.js'
import { handleUserExecuteChangeOperation } from '../../ingest/userOperation.js'
import {
	wrapCustomIngestJob,
	wrapGenericIngestJob,
	wrapGenericIngestJobWithPrecheck,
	wrapMosIngestJob,
} from '../../ingest/jobWrappers.js'
import { handleCreateAdlibTestingRundownForShowStyleVariant } from '../../ingest/createAdlibTestingRundown.js'

type ExecutableFunction<T extends keyof IngestJobFunc> = (
	context: JobContext,
	data: Parameters<IngestJobFunc[T]>[0]
) => Promise<ReturnType<IngestJobFunc[T]>>

export type IngestJobHandlers = {
	[T in keyof IngestJobFunc]: ExecutableFunction<T>
}

export const ingestJobHandlers: IngestJobHandlers = {
	[IngestJobs.RemoveRundown]: wrapGenericIngestJob(handleRemovedRundown),
	[IngestJobs.UpdateRundown]: wrapGenericIngestJob(handleUpdatedRundown),
	[IngestJobs.UpdateRundownMetaData]: wrapGenericIngestJob(handleUpdatedRundownMetaData),
	[IngestJobs.RemoveSegment]: wrapGenericIngestJob(handleRemovedSegment),
	[IngestJobs.UpdateSegment]: wrapGenericIngestJobWithPrecheck(handleUpdatedSegment),
	[IngestJobs.UpdateSegmentRanks]: wrapGenericIngestJob(handleUpdatedSegmentRanks),
	[IngestJobs.RemovePart]: wrapGenericIngestJob(handleRemovedPart),
	[IngestJobs.UpdatePart]: wrapGenericIngestJob(handleUpdatedPart),
	[IngestJobs.RegenerateRundown]: wrapGenericIngestJob(handleRegenerateRundown),
	[IngestJobs.RegenerateSegment]: wrapGenericIngestJob(handleRegenerateSegment),

	[IngestJobs.RemoveOrphanedSegments]: wrapCustomIngestJob(handleRemoveOrphanedSegemnts),

	[IngestJobs.MosRundown]: wrapMosIngestJob(handleMosRundownData),
	[IngestJobs.MosRundownMetadata]: wrapMosIngestJob(handleMosRundownMetadata),
	[IngestJobs.MosRundownStatus]: handleMosRundownStatus,
	[IngestJobs.MosRundownReadyToAir]: wrapCustomIngestJob(handleMosRundownReadyToAir),
	[IngestJobs.MosFullStory]: wrapMosIngestJob(handleMosFullStory),
	[IngestJobs.MosDeleteStory]: wrapMosIngestJob(handleMosDeleteStory),
	[IngestJobs.MosInsertStory]: wrapMosIngestJob(handleMosInsertStories),
	[IngestJobs.MosMoveStory]: wrapMosIngestJob(handleMosMoveStories),
	[IngestJobs.MosSwapStory]: wrapMosIngestJob(handleMosSwapStories),

	[IngestJobs.PackageInfosUpdatedRundown]: handleUpdatedPackageInfoForRundown,

	[IngestJobs.UserRemoveRundown]: handleUserRemoveRundown,
	[IngestJobs.UserUnsyncRundown]: handleUserUnsyncRundown,
	[IngestJobs.UserExecuteChangeOperation]: handleUserExecuteChangeOperation,

	[IngestJobs.BucketItemImport]: handleBucketItemImport,
	[IngestJobs.BucketItemRegenerate]: handleBucketItemRegenerate,
	[IngestJobs.BucketActionRegenerateExpectedPackages]: handleBucketActionRegenerateExpectedPackages,
	[IngestJobs.BucketActionModify]: handleBucketActionModify,
	[IngestJobs.BucketPieceModify]: handleBucketPieceModify,
	[IngestJobs.BucketRemoveAdlibPiece]: handleBucketRemoveAdlibPiece,
	[IngestJobs.BucketRemoveAdlibAction]: handleBucketRemoveAdlibAction,
	[IngestJobs.BucketEmpty]: handleBucketEmpty,

	[IngestJobs.CreateAdlibTestingRundownForShowStyleVariant]: handleCreateAdlibTestingRundownForShowStyleVariant,
}
