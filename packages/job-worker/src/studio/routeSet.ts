import { SwitchRouteSetProps } from '@sofie-automation/corelib/dist/worker/studio'
import { JobContext } from '../jobs'
import { runJobWithStudioPlayoutModel } from './lock'
import { updateTimelineFromStudioPlayoutModel } from '../playout/lib'

export async function handleSwitchRouteSet(context: JobContext, data: SwitchRouteSetProps): Promise<void> {
	await runJobWithStudioPlayoutModel(context, async (studioPlayoutModel) => {
		const routesetChangeMayAffectTimeline = studioPlayoutModel.switchRouteSet(data.routeSetId, data.state)

		if (routesetChangeMayAffectTimeline) {
			await updateTimelineFromStudioPlayoutModel(context, studioPlayoutModel)
		}
	})
}
