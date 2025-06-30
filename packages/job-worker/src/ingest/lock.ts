import { SegmentId, RundownId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { JobContext } from '../jobs/index.js'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { RundownLock } from '../jobs/lock.js'

/**
 * The result of the initial stage of an Ingest operation
 * This gets provided to the Commit stage, and informs it what has changed
 */
export interface CommitIngestData {
	/** Segment Ids which had any changes */
	changedSegmentIds: SegmentId[]
	/** Segments to be removed or orphaned */
	removedSegmentIds: SegmentId[]
	/**
	 * Segments that had their ids changed. This helps then be orphaned in the correct place
	 * eg, whole segment is renamed and middle part deleted.
	 *
	 * Maps fromSegmentId to toSegmentId.
	 *
	 * _Note: Only supported for MOS, not 'normal' ingest operations_
	 */
	renamedSegments: Map<SegmentId, SegmentId> | null

	/** Set to true if the rundown should be removed or orphaned */
	removeRundown: boolean

	/** Whether to return an error if the rundown is unable to be removed */
	returnRemoveFailure?: boolean
}

/**
 * Run a minimal rundown job. This is an alternative to `runIngestJob`, for operations to operate on a Rundown without the full Ingest flow
 * This automatically aquires the RundownLock, loads the Rundown and does a basic access check
 * @param context Context of the job being run
 * @param rundownId Id of the rundown to run for
 * @param fcn Function to run inside the lock
 * @returns Result of the provided function
 */
export async function runWithRundownLock<TRes>(
	context: JobContext,
	rundownId: RundownId,
	fcn: (rundown: DBRundown | undefined, lock: RundownLock) => Promise<TRes>
): Promise<TRes> {
	if (!rundownId) {
		throw new Error(`Job is missing rundownId`)
	}

	return runWithRundownLockWithoutFetchingRundown(context, rundownId, async (lock) => {
		const rundown = await context.directCollections.Rundowns.findOne(rundownId)
		if (rundown && rundown.studioId !== context.studioId) {
			throw new Error(`Job rundown "${rundownId}" not found or for another studio`)
		}

		return fcn(rundown, lock)
	})
}

/**
 * Lock the rundown for a quick task without the cache
 */
export async function runWithRundownLockWithoutFetchingRundown<TRes>(
	context: JobContext,
	rundownId: RundownId,
	fcn: (lock: RundownLock) => Promise<TRes>
): Promise<TRes> {
	const rundownLock = await context.lockRundown(rundownId)
	try {
		const res = await fcn(rundownLock)
		// Explicitly await fcn, before releasing the lock
		return res
	} finally {
		await rundownLock.release()
	}
}
