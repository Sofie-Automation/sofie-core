/* tslint:disable:no-use-before-declare */
import { PackageInfo } from '../../coreSystem'
import { shouldUpdateStudioBaselineInner } from '@sofie-automation/corelib/dist/studio/baseline'
import { Blueprints, RundownPlaylists, Timeline } from '../../collections'
import { StudioJobs } from '@sofie-automation/corelib/dist/worker/studio'
import { QueueStudioJob } from '../../worker/worker'
import { DBStudio } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'

export namespace ServerPlayoutAPI {
	export async function shouldUpdateStudioBaseline(studio: DBStudio): Promise<string | false> {
		// This is intentionally not in a lock/queue, as doing so will cause it to block playout performance, and being wrong is harmless

		if (studio) {
			const activePlaylists = await RundownPlaylists.findFetchAsync(
				{ studioId: studio._id, activationId: { $exists: true } },
				{ projection: { _id: 1 } }
			)
			if (activePlaylists.length > 0) return false

			const [timeline, blueprint] = await Promise.all([
				Timeline.findOneAsync(studio._id),
				studio.blueprintId
					? Blueprints.findOneAsync(studio.blueprintId, { projection: { blueprintVersion: 1 } })
					: null,
			])
			if (blueprint === undefined) return 'missingBlueprint'

			return shouldUpdateStudioBaselineInner(PackageInfo.version, studio, timeline ?? null, blueprint)
		} else {
			return false
		}
	}

	export async function switchRouteSet(
		studioId: StudioId,
		routeSetId: string,
		state: boolean | 'toggle'
	): Promise<void> {
		const queuedJob = await QueueStudioJob(StudioJobs.SwitchRouteSet, studioId, {
			routeSetId,
			state,
		})
		await queuedJob.complete
	}
}
