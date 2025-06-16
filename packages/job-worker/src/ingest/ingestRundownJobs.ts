import { JobContext } from '../jobs/index.js'
import { logger } from '../logging.js'
import { runWithRundownLock } from './lock.js'
import { getRundownId } from './lib.js'
import { removeRundownFromDb } from '../rundownPlaylists.js'
import { DBRundown, RundownOrphanedReason } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import {
	IngestRegenerateRundownProps,
	IngestRemoveRundownProps,
	IngestUpdateRundownMetaDataProps,
	IngestUpdateRundownProps,
	UserRemoveRundownProps,
	UserUnsyncRundownProps,
} from '@sofie-automation/corelib/dist/worker/ingest'
import { ComputedIngestChangeAction, UpdateIngestRundownChange, UpdateIngestRundownResult } from './runOperation.js'
import {
	IngestChangeType,
	IngestRundown,
	NrcsIngestRundownChangeDetails,
} from '@sofie-automation/blueprints-integration'
import { wrapGenericIngestJob } from './jobWrappers.js'
import { IngestRundownWithSource } from '@sofie-automation/corelib/dist/dataModel/NrcsIngestDataCache'

/**
 * Attempt to remove a rundown, or orphan it
 */
export function handleRemovedRundown(
	_context: JobContext,
	data: IngestRemoveRundownProps,
	_ingestRundown: IngestRundown | undefined
): UpdateIngestRundownResult {
	// Remove it
	return data.forceDelete ? ComputedIngestChangeAction.FORCE_DELETE : ComputedIngestChangeAction.DELETE
}
const handleRemovedRundownWrapped = wrapGenericIngestJob(handleRemovedRundown)

/**
 * User requested removing a rundown
 */
export async function handleUserRemoveRundown(context: JobContext, data: UserRemoveRundownProps): Promise<void> {
	const tmpRundown = await context.directCollections.Rundowns.findOne(data.rundownId)
	if (!tmpRundown || tmpRundown.studioId !== context.studioId) {
		// Either not found, or belongs to someone else
		return
	}

	if (tmpRundown._id !== getRundownId(context.studioId, tmpRundown.externalId)) {
		/**
		 * If the rundown is not created via an ingest method, there can be a bad relationship between _id and externalId, which causes the rundown to not be found.
		 * This typically happens when a rundown is restored from a snapshot.
		 * When this happens, we need to remove the rundown directly.
		 */

		return runWithRundownLock(context, data.rundownId, async (rundown, lock) => {
			if (rundown) {
				// It's from a snapshot, so should be removed directly, as that means it cannot run ingest operations
				// Note: this bypasses activation checks, but that probably doesnt matter
				await removeRundownFromDb(context, lock)

				// check if the playlist is now empty
				const rundownCount: Pick<DBRundown, '_id'>[] = await context.directCollections.Rundowns.findFetch(
					{ playlistId: rundown.playlistId },
					{ projection: { _id: 1 } }
				)
				if (rundownCount.length === 0) {
					// A lazy approach, but good enough for snapshots
					await context.directCollections.RundownPlaylists.remove(rundown.playlistId)
				}
			}
		})
	} else {
		// Its a real rundown, so defer to the proper route for deletion
		return handleRemovedRundownWrapped(context, {
			rundownExternalId: tmpRundown.externalId,
			forceDelete: data.force,
		})
	}
}

/**
 * Insert or update a rundown with a new IngestRundown
 */
export function handleUpdatedRundown(
	_context: JobContext,
	data: IngestUpdateRundownProps,
	ingestRundown: IngestRundownWithSource | undefined
): UpdateIngestRundownChange {
	if (!ingestRundown && !data.isCreateAction) throw new Error(`Rundown "${data.rundownExternalId}" not found`)

	return {
		ingestRundown: {
			...data.ingestRundown,
			rundownSource: data.rundownSource,
		},
		changes: {
			source: IngestChangeType.Ingest,
			rundownChanges: NrcsIngestRundownChangeDetails.Regenerate,
		},
	} satisfies UpdateIngestRundownChange
}

/**
 * Update a rundown from a new IngestRundown (ingoring IngestSegments)
 */
export function handleUpdatedRundownMetaData(
	_context: JobContext,
	data: IngestUpdateRundownMetaDataProps,
	ingestRundown: IngestRundownWithSource | undefined
): UpdateIngestRundownChange {
	if (!ingestRundown) throw new Error(`Rundown "${data.rundownExternalId}" not found`)

	return {
		ingestRundown: {
			...data.ingestRundown,
			rundownSource: data.rundownSource,
			segments: ingestRundown.segments,
		},
		changes: {
			source: IngestChangeType.Ingest,
			rundownChanges: NrcsIngestRundownChangeDetails.Payload,
		},
	} satisfies UpdateIngestRundownChange
}

/**
 * Regnerate a Rundown from the cached IngestRundown
 */
export function handleRegenerateRundown(
	_context: JobContext,
	data: IngestRegenerateRundownProps,
	ingestRundown: IngestRundownWithSource | undefined
): UpdateIngestRundownChange {
	if (!ingestRundown) throw new Error(`Rundown "${data.rundownExternalId}" not found`)

	return {
		// We want to regenerate unmodified
		ingestRundown,
		changes: {
			source: IngestChangeType.Ingest,
			rundownChanges: NrcsIngestRundownChangeDetails.Regenerate,
		},
	} satisfies UpdateIngestRundownChange
}

/**
 * User requested unsyncing a rundown
 */
export async function handleUserUnsyncRundown(context: JobContext, data: UserUnsyncRundownProps): Promise<void> {
	return runWithRundownLock(context, data.rundownId, async (rundown) => {
		if (!rundown) return // Ignore if rundown is not found

		if (!rundown.orphaned) {
			await context.directCollections.Rundowns.update(rundown._id, {
				$set: {
					orphaned: RundownOrphanedReason.MANUAL,
				},
			})
		} else {
			logger.info(`Rundown "${rundown._id}" was already unsynced`)
		}
	})
}
