import { ExpectedPackageDBType } from '@sofie-automation/corelib/dist/dataModel/ExpectedPackages'
import { SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import {
	ExpectedPackagesRegenerateProps,
	PackageInfosUpdatedRundownProps,
} from '@sofie-automation/corelib/dist/worker/ingest'
import { logger } from '../logging.js'
import { JobContext } from '../jobs/index.js'
import { regenerateSegmentsFromIngestData } from './generationSegment.js'
import { runWithRundownLock } from './lock.js'
import { updateExpectedPackagesForPartModel, updateExpectedPackagesForRundownBaseline } from './expectedPackages.js'
import { loadIngestModelFromRundown } from './model/implementation/LoadIngestModel.js'
import { runCustomIngestUpdateOperation } from './runOperation.js'

/**
 * Debug: Regenerate ExpectedPackages for a Rundown
 */
export async function handleExpectedPackagesRegenerate(
	context: JobContext,
	data: ExpectedPackagesRegenerateProps
): Promise<void> {
	return runWithRundownLock(context, data.rundownId, async (rundown, rundownLock) => {
		if (!rundown) throw new Error(`Rundown "${data.rundownId}" not found`)

		const ingestModel = await loadIngestModelFromRundown(context, rundownLock, rundown)

		for (const part of ingestModel.getAllOrderedParts()) {
			updateExpectedPackagesForPartModel(context, part)
		}

		await updateExpectedPackagesForRundownBaseline(context, ingestModel, undefined, true)

		await ingestModel.saveAllToDatabase()
	})
}

/**
 * Some PackageInfos have been updated, regenerate any Parts which depend on these PackageInfos
 */
export async function handleUpdatedPackageInfoForRundown(
	context: JobContext,
	data: PackageInfosUpdatedRundownProps
): Promise<void> {
	if (data.packageIds.length === 0) {
		return
	}

	await runCustomIngestUpdateOperation(context, data, async (context, ingestModel, ingestRundown) => {
		if (!ingestRundown) {
			logger.error(
				`onUpdatedPackageInfoForRundown called but ingestRundown is undefined (rundownExternalId: "${data.rundownExternalId}")`
			)
			return null
		}

		/** All segments that need updating */
		const segmentsToUpdate = new Set<SegmentId>()
		let regenerateRundownBaseline = false

		for (const packageId of data.packageIds) {
			const pkg = ingestModel.findExpectedPackage(packageId)
			if (pkg) {
				if (
					pkg.fromPieceType === ExpectedPackageDBType.PIECE ||
					pkg.fromPieceType === ExpectedPackageDBType.ADLIB_PIECE ||
					pkg.fromPieceType === ExpectedPackageDBType.ADLIB_ACTION
				) {
					segmentsToUpdate.add(pkg.segmentId)
				} else if (
					pkg.fromPieceType === ExpectedPackageDBType.BASELINE_ADLIB_ACTION ||
					pkg.fromPieceType === ExpectedPackageDBType.BASELINE_ADLIB_PIECE ||
					pkg.fromPieceType === ExpectedPackageDBType.RUNDOWN_BASELINE_OBJECTS
				) {
					regenerateRundownBaseline = true
				}
			} else {
				logger.warn(`onUpdatedPackageInfoForRundown: Missing package: "${packageId}"`)
			}
		}

		logger.info(
			`onUpdatedPackageInfoForRundown: PackageInfo for "${data.packageIds.join(
				', '
			)}" will trigger update of segments: ${Array.from(segmentsToUpdate).join(', ')}`
		)

		if (regenerateRundownBaseline) {
			// trigger a re-generation of the rundown baseline
			// TODO - to be implemented.
		}

		const { result, skippedSegments } = await regenerateSegmentsFromIngestData(
			context,
			ingestModel,
			ingestRundown,
			Array.from(segmentsToUpdate)
		)

		if (skippedSegments.length > 0) {
			logger.warn(
				`onUpdatedPackageInfoForRundown: Some segments were skipped during update: ${skippedSegments.join(
					', '
				)}`
			)
		}

		logger.warn(`onUpdatedPackageInfoForRundown: Changed ${result?.changedSegmentIds.length ?? 0} segments`)
		return result
	})
}
