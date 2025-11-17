import { Time, TimeDuration } from '@sofie-automation/shared-lib/dist/lib/lib'
import { UserActionsLogItemId, UserId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { TimelineHash } from '@sofie-automation/corelib/dist/dataModel/Timeline'

export interface UserActionsLogItem {
	_id: UserActionsLogItemId

	/** The user from which the action originated */
	userId: UserId | null
	/** The cliend address (IP-address) of the requester */
	clientAddress: string
	/** Timestamp for when the action was created (ie beginning of execution) */
	timestamp: Time
	method: string
	args: string
	context: string
	/** undefined=in progress, true=finished successfully, false=finished with error */
	success?: boolean
	errorMessage?: string

	/** Timestamp for when the action result was sent to the Client */
	doneTime?: Time

	/** The timelineHash that resulted from the userAction. Used to set .gatewayDuration. */
	timelineHash?: TimelineHash
	/** Timestamp for when the timeline was generated, used to calculate .gatewayDuration. */
	timelineGenerated?: number

	/** Timestamp (as calculated by the GUI) for when the user initiated the execution of the action */
	clientTime?: Time

	/** The time it took (within core & worker) to execute the action */
	executionTime?: TimeDuration
	/** The time it took within the worker to execute */
	workerTime?: TimeDuration
	/** The total time it took for playout-gateway(s) to receive and execute the timeline. */
	gatewayDuration?: TimeDuration[]
	/** The time playout-gateway(s) reported it took to resolve the timeline. */
	timelineResolveDuration?: TimeDuration[]
}
