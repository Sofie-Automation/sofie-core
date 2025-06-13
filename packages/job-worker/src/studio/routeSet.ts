import { SwitchRouteSetProps } from '@sofie-automation/corelib/dist/worker/studio'
import { JobContext } from '../jobs/index.js'
import { runJobWithStudioPlayoutModel } from './lock.js'
import { updateTimelineFromStudioPlayoutModel } from '../playout/lib.js'

export async function handleSwitchRouteSet(context: JobContext, data: SwitchRouteSetProps): Promise<void> {
	await runJobWithStudioPlayoutModel(context, async (studioPlayoutModel) => {
		const routesetChangeMayAffectTimeline = studioPlayoutModel.switchRouteSet(data.routeSetId, data.state)

		if (routesetChangeMayAffectTimeline) {
			await updateTimelineFromStudioPlayoutModel(context, studioPlayoutModel)
		}
	})
}
