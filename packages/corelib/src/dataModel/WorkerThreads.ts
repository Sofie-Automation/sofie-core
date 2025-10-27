import { StatusCode } from '@sofie-automation/shared-lib/dist/lib/status'
import { WorkerId, WorkerThreadId } from './Ids.js'

export interface WorkerThreadStatus {
	_id: WorkerThreadId

	/** If if the parent Worker process */
	workerId: WorkerId

	/** The instance id is unique each time a worker starts up */
	instanceId: string
	/** A user-facing name */
	name: string

	statusCode: StatusCode
	reason: string
}
