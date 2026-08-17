import { NewPlayoutAPI } from '@sofie-automation/meteor-lib/dist/api/playout'
import { ServerPlayoutAPI } from './playout'
import { MethodContextAPI } from '../methodContext'
import { QueueStudioJob } from '../../worker/worker'
import { StudioJobs } from '@sofie-automation/corelib/dist/worker/studio'

import { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { UserPermissions } from '@sofie-automation/meteor-lib/dist/userPermissions'
import { assertConnectionHasOneOfPermissions } from '../../security/auth'
import { Studios } from '../../collections'
import { SofieError } from '@sofie-automation/corelib/dist/error'

const PERMISSIONS_FOR_STUDIO_BASELINE: Array<keyof UserPermissions> = ['configure', 'studio']

export class ServerPlayoutAPIClass extends MethodContextAPI implements NewPlayoutAPI {
	async updateStudioBaseline(studioId: StudioId): Promise<string | false> {
		assertConnectionHasOneOfPermissions(this.connection, ...PERMISSIONS_FOR_STUDIO_BASELINE)

		const res = await QueueStudioJob(StudioJobs.UpdateStudioBaseline, studioId, undefined)
		return res.complete
	}
	async shouldUpdateStudioBaseline(studioId: StudioId): Promise<string | false> {
		assertConnectionHasOneOfPermissions(this.connection, ...PERMISSIONS_FOR_STUDIO_BASELINE)

		const studio = await Studios.findOneAsync(studioId)
		if (!studio) throw new SofieError(404, `Studio "${studioId}" not found`)

		return ServerPlayoutAPI.shouldUpdateStudioBaseline(studio)
	}
}
