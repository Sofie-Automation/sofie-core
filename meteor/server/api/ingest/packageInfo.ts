import {
	ExpectedPackageDBFromBucketAdLib,
	ExpectedPackageDBFromBucketAdLibAction,
	ExpectedPackageDBFromStudioBaselineObjects,
	ExpectedPackageDBType,
	ExpectedPackageFromRundown,
	ExpectedPackageFromRundownBaseline,
} from '@sofie-automation/corelib/dist/dataModel/ExpectedPackages'
import { PackageInfoDB } from '@sofie-automation/corelib/dist/dataModel/PackageInfos'
import { ExpectedPackages, Rundowns } from '../../collections'
import { assertNever } from '@sofie-automation/corelib/dist/lib'
import { lazyIgnore } from '../../lib/lib'
import { logger } from '../../logging'
import { runIngestOperation } from './lib'
import { IngestJobs } from '@sofie-automation/corelib/dist/worker/ingest'
import { ExpectedPackageId, RundownId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { Rundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { QueueStudioJob } from '../../worker/worker'
import { StudioJobs } from '@sofie-automation/corelib/dist/worker/studio'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'

export async function onUpdatedPackageInfo(packageId: ExpectedPackageId, _doc: PackageInfoDB | null): Promise<void> {
	logger.info(`PackageInfo updated "${packageId}"`)

	const pkg = await ExpectedPackages.findOneAsync(packageId)
	if (!pkg) {
		logger.warn(`onUpdatedPackageInfo: Received update for missing package: "${packageId}"`)
		return
	}

	if (pkg.listenToPackageInfoUpdates) {
		switch (pkg.fromPieceType) {
			case ExpectedPackageDBType.PIECE:
			case ExpectedPackageDBType.ADLIB_PIECE:
			case ExpectedPackageDBType.ADLIB_ACTION:
			case ExpectedPackageDBType.BASELINE_ADLIB_PIECE:
			case ExpectedPackageDBType.BASELINE_ADLIB_ACTION:
			case ExpectedPackageDBType.BASELINE_PIECE:
			case ExpectedPackageDBType.RUNDOWN_BASELINE_OBJECTS:
				onUpdatedPackageInfoForRundownDebounce(pkg)
				break
			case ExpectedPackageDBType.BUCKET_ADLIB:
			case ExpectedPackageDBType.BUCKET_ADLIB_ACTION:
				onUpdatedPackageInfoForBucketItemDebounce(pkg)
				break
			case ExpectedPackageDBType.STUDIO_BASELINE_OBJECTS:
				onUpdatedPackageInfoForStudioBaselineDebounce(pkg)
				break
			default:
				assertNever(pkg)
				break
		}
	}
}

const pendingRundownPackageUpdates = new Map<RundownId, Array<ExpectedPackageId>>()
function onUpdatedPackageInfoForRundownDebounce(pkg: ExpectedPackageFromRundown | ExpectedPackageFromRundownBaseline) {
	const existingEntry = pendingRundownPackageUpdates.get(pkg.rundownId)
	if (existingEntry) {
		// already queued, add to the batch
		existingEntry.push(pkg._id)
	} else {
		pendingRundownPackageUpdates.set(pkg.rundownId, [pkg._id])
	}

	// TODO: Scaling - this won't batch correctly if package manager directs calls to multiple instances
	lazyIgnore(
		`onUpdatedPackageInfoForRundown_${pkg.rundownId}`,
		() => {
			const packageIds = pendingRundownPackageUpdates.get(pkg.rundownId)
			if (packageIds) {
				pendingRundownPackageUpdates.delete(pkg.rundownId)
				onUpdatedPackageInfoForRundown(pkg.rundownId, packageIds).catch((e) => {
					logger.error(
						`Updating ExpectedPackages for Rundown "${pkg.rundownId}" failed: ${stringifyError(e)}`
					)
				})
			}
		},
		1000
	)
}

async function onUpdatedPackageInfoForRundown(
	rundownId: RundownId,
	packageIds: Array<ExpectedPackageId>
): Promise<void> {
	if (packageIds.length === 0) {
		return
	}

	const tmpRundown = (await Rundowns.findOneAsync(rundownId, {
		projection: {
			studioId: 1,
			externalId: 1,
		},
	})) as Pick<Rundown, 'studioId' | 'externalId'> | undefined
	if (!tmpRundown) {
		logger.error(
			`onUpdatedPackageInfoForRundown: Missing rundown "${rundownId}" for packages "${packageIds.join(', ')}"`
		)
		return
	}

	await runIngestOperation(tmpRundown.studioId, IngestJobs.PackageInfosUpdatedRundown, {
		rundownExternalId: tmpRundown.externalId,
		packageIds,
	})
}

function onUpdatedPackageInfoForBucketItemDebounce(
	pkg: ExpectedPackageDBFromBucketAdLib | ExpectedPackageDBFromBucketAdLibAction
) {
	lazyIgnore(
		`onUpdatedPackageInfoForBucket_${pkg.studioId}_${pkg.bucketId}_${pkg.pieceExternalId}`,
		() => {
			runIngestOperation(pkg.studioId, IngestJobs.BucketItemRegenerate, {
				bucketId: pkg.bucketId,
				externalId: pkg.pieceExternalId,
			}).catch((err) => {
				logger.error(
					`Updating ExpectedPackages for Bucket "${pkg.bucketId}" Item "${
						pkg.pieceExternalId
					}" failed: ${stringifyError(err)}`
				)
			})
		},
		1000
	)
}

function onUpdatedPackageInfoForStudioBaselineDebounce(pkg: ExpectedPackageDBFromStudioBaselineObjects) {
	lazyIgnore(
		`onUpdatedPackageInfoForStudioBaseline_${pkg.studioId}`,
		() => {
			QueueStudioJob(StudioJobs.UpdateStudioBaseline, pkg.studioId, undefined)
				.then(async (job) => {
					await job.complete
				})
				.catch((err) => {
					logger.error(
						`Updating ExpectedPackages for StudioBaseline "${pkg.studioId}" failed: ${stringifyError(err)}`
					)
				})
		},
		1000
	)
}
