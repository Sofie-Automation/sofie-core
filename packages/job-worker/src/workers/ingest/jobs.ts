import { JobContext } from '../../jobs'
import { IngestJobs, IngestJobFunc } from '@sofie-automation/corelib/dist/worker/ingest'
import {
	handleMosDeleteStory,
	handleMosFullStory,
	handleMosInsertStories,
	handleMosMoveStories,
	handleMosSwapStories,
} from '../../ingest/mosDevice/mosStoryJobs'
import {
	handleMosRundownData,
	handleMosRundownMetadata,
	handleMosRundownReadyToAir,
	handleMosRundownStatus,
} from '../../ingest/mosDevice/mosRundownJobs'
import {
	handleRegenerateRundown,
	handleRemovedRundown,
	handleUpdatedRundown,
	handleUpdatedRundownMetaData,
	handleUserRemoveRundown,
	handleUserUnsyncRundown,
} from '../../ingest/ingestRundownJobs'
import { handleRemovedPart, handleUpdatedPart } from '../../ingest/ingestPartJobs'
import {
	handleRegenerateSegment,
	handleRemovedSegment,
	handleRemoveOrphanedSegemnts,
	handleUpdatedSegment,
	handleUpdatedSegmentRanks,
} from '../../ingest/ingestSegmentJobs'
import { handleExpectedPackagesRegenerate, handleUpdatedPackageInfoForRundown } from '../../ingest/packageInfo'
import {
	handleBucketActionModify,
	handleBucketActionRegenerateExpectedPackages,
	handleBucketEmpty,
	handleBucketPieceModify,
	handleBucketRemoveAdlibAction,
	handleBucketRemoveAdlibPiece,
} from '../../ingest/bucket/bucketAdlibs'
import { handleBucketItemImport, handleBucketItemRegenerate } from '../../ingest/bucket/import'
import { handleUserExecuteChangeOperation } from '../../ingest/userOperation'
import {
	wrapCustomIngestJob,
	wrapGenericIngestJob,
	wrapGenericIngestJobWithPrecheck,
	wrapMosIngestJob,
} from '../../ingest/jobWrappers'
import { handleCreateAdlibTestingRundownForShowStyleVariant } from '../../ingest/createAdlibTestingRundown'

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

	[IngestJobs.ExpectedPackagesRegenerate]: handleExpectedPackagesRegenerate,
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
