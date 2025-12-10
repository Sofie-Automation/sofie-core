import { BlueprintManifestType } from '@sofie-automation/blueprints-integration'
import { Blueprint } from '@sofie-automation/corelib/dist/dataModel/Blueprint'
import { assertNever } from '@sofie-automation/corelib/dist/lib'
import { SYSTEM_ID } from '@sofie-automation/meteor-lib/dist/collections/CoreSystem'
import { Meteor } from 'meteor/meteor'
import { Studios, CoreSystem, Rundowns, ShowStyleBases } from '../../collections'
import { runUpgradeForShowStyleBase, runUpgradeForStudio } from '../../migration/upgrades'
import { runUpgradeForCoreSystem } from '../../migration/upgrades/system'
import { RundownId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import _ from 'underscore'
import { Rundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { QueueIngestJob, QueueStudioJob } from '../../worker/worker'
import { StudioJobs } from '@sofie-automation/corelib/dist/worker/studio'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'
import { logger } from '../../logging'
import { IngestJobs } from '@sofie-automation/corelib/dist/worker/ingest'

export async function blueprintsPerformDevelopmentMode(blueprint: Blueprint): Promise<void> {
	// Note: These are not the most efficient implementations, but this is a development tool so the simplicity is more important
	switch (blueprint.blueprintType) {
		case BlueprintManifestType.SHOWSTYLE: {
			const showStyles = await ShowStyleBases.findFetchAsync(
				{ blueprintId: blueprint._id },
				{ projection: { _id: 1 } }
			)

			// Run upgrade for all studios
			await Promise.all(showStyles.map(async (showStyle) => runUpgradeForShowStyleBase(showStyle._id)))

			// Reload any rundowns
			const affectedRundowns = (await Rundowns.findFetchAsync(
				{ showStyleBaseId: { $in: showStyles.map((showStyle) => showStyle._id) } },
				{ projection: { _id: 1 } }
			)) as Pick<Rundown, '_id'>[]

			// Perform a debounced reload
			for (const rundown of affectedRundowns) {
				rundownIdsToReload.add(rundown._id)
			}
			debouncedReloadRundowns()

			break
		}
		case BlueprintManifestType.STUDIO: {
			const studios = await Studios.findFetchAsync({ blueprintId: blueprint._id }, { projection: { _id: 1 } })

			// Run upgrade for all studios
			await Promise.all(studios.map(async (studio) => runUpgradeForStudio(studio._id)))

			// Trigger a regeneration of the timeline
			await Promise.all(
				studios.map(async (studio) => {
					try {
						const job = await QueueStudioJob(StudioJobs.UpdateTimeline, studio._id, undefined)

						await job.complete
					} catch (e) {
						logger.error(`Failed to update timeline for studio ${studio._id}: ${stringifyError(e)}`)
					}
				})
			)

			// Reload any rundowns
			const affectedRundowns = (await Rundowns.findFetchAsync(
				{ studioId: { $in: studios.map((studio) => studio._id) } },
				{ projection: { _id: 1 } }
			)) as Pick<Rundown, '_id'>[]

			// Perform a debounced reload
			for (const rundown of affectedRundowns) {
				rundownIdsToReload.add(rundown._id)
			}
			debouncedReloadRundowns()

			break
		}
		case BlueprintManifestType.SYSTEM: {
			const coreSystem = await CoreSystem.findOneAsync(SYSTEM_ID, { projection: { blueprintId: 1 } })
			if (coreSystem?.blueprintId !== blueprint._id) return
			await runUpgradeForCoreSystem(SYSTEM_ID)
			break
		}
		case undefined:
			// Nothing to do
			break
		default:
			assertNever(blueprint.blueprintType)
			throw new Meteor.Error(400, `Blueprint type "${blueprint.blueprintType}" is not valid`)
	}
}

// Note: This is a development tool, so doesn't need to worry about replication
const rundownIdsToReload = new Set<RundownId>()
const debouncedReloadRundowns = _.debounce(
	() => {
		if (rundownIdsToReload.size === 0) return

		const rundownIds = Array.from(rundownIdsToReload)
		rundownIdsToReload.clear()

		// Perform the reload
		Rundowns.findFetchAsync({ _id: { $in: rundownIds } })
			.then(async (rundowns) => {
				// Trigger a reload with the default strategy
				await Promise.all(
					rundowns.map(async (rundown) => {
						try {
							const job = await QueueIngestJob(IngestJobs.RegenerateRundown, rundown.studioId, {
								rundownExternalId: rundown.externalId,
							})

							await job.complete
						} catch (e) {
							logger.error(
								`Regenerating rundown "${rundown.name}"(${rundown._id}) failed: ${stringifyError(e)}`
							)
						}
					})
				)
			})
			.catch((e) => {
				logger.error(`Failed to reload rundowns: ${stringifyError(e)}`)
			})
	},
	1000,
	false
)
