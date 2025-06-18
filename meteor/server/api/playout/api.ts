import { registerClassToMeteorMethods, MeteorDebugMethods } from '../../methods'
import { NewPlayoutAPI, PlayoutAPIMethods } from '@sofie-automation/meteor-lib/dist/api/playout'
import { ServerPlayoutAPI } from './playout'
import { getCurrentTime } from '../../lib/lib'
import { logger } from '../../logging'
import { MethodContextAPI } from '../methodContext'
import { QueueStudioJob } from '../../worker/worker'
import { StudioJobs } from '@sofie-automation/corelib/dist/worker/studio'

import { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { UserPermissions } from '@sofie-automation/meteor-lib/dist/userPermissions'
import { assertConnectionHasOneOfPermissions } from '../../security/auth'
import { Studios } from '../../collections'
import { Meteor } from 'meteor/meteor'

const PERMISSIONS_FOR_STUDIO_BASELINE: Array<keyof UserPermissions> = ['configure', 'studio']

class ServerPlayoutAPIClass extends MethodContextAPI implements NewPlayoutAPI {
	async updateStudioBaseline(studioId: StudioId): Promise<string | false> {
		assertConnectionHasOneOfPermissions(this.connection, ...PERMISSIONS_FOR_STUDIO_BASELINE)

		const res = await QueueStudioJob(StudioJobs.UpdateStudioBaseline, studioId, undefined)
		return res.complete
	}
	async shouldUpdateStudioBaseline(studioId: StudioId) {
		assertConnectionHasOneOfPermissions(this.connection, ...PERMISSIONS_FOR_STUDIO_BASELINE)

		const studio = await Studios.findOneAsync(studioId)
		if (!studio) throw new Meteor.Error(404, `Studio "${studioId}" not found`)

		return ServerPlayoutAPI.shouldUpdateStudioBaseline(studio)
	}
}
registerClassToMeteorMethods(PlayoutAPIMethods, ServerPlayoutAPIClass, false)

// Temporary methods
MeteorDebugMethods({
	debug__printTime: () => {
		const now = getCurrentTime()
		logger.debug(new Date(now))
		return now
	},
})
