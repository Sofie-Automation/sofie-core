import { Meteor } from 'meteor/meteor'
import { check } from '../lib/check'
import { StatusCode } from '@sofie-automation/blueprints-integration'
import { deferAsync, getCurrentTime } from '../lib/lib'
import { registerClassToMeteorMethods } from '../methods'
import {
	NewExternalMessageQueueAPI,
	ExternalMessageQueueAPIMethods,
} from '@sofie-automation/meteor-lib/dist/api/ExternalMessageQueue'
import { StatusObject, setSystemStatus } from '../systemStatus/systemStatus'
import { MethodContextAPI, MethodContext } from './methodContext'
import { ExternalMessageQueueObjId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ExternalMessageQueue } from '../collections'
import { ExternalMessageQueueObj } from '@sofie-automation/corelib/dist/dataModel/ExternalMessageQueue'
import { MongoQuery } from '@sofie-automation/corelib/dist/mongo'
import { UserPermissions } from '@sofie-automation/meteor-lib/dist/userPermissions'
import { assertConnectionHasOneOfPermissions } from '../security/auth'

const USER_PERMISSIONS_FOR_EXTERNAL_MESSAGES: Array<keyof UserPermissions> = ['configure', 'studio', 'service']

let updateExternalMessageQueueStatusTimeout = 0
function updateExternalMessageQueueStatus(): void {
	if (!updateExternalMessageQueueStatusTimeout) {
		updateExternalMessageQueueStatusTimeout = Meteor.setTimeout(() => {
			updateExternalMessageQueueStatusTimeout = 0
			deferAsync(async () => {
				const query: MongoQuery<ExternalMessageQueueObj> = {
					sent: { $not: { $gt: 0 } },
					tryCount: { $gt: 3 },
				}

				// TODO - limit the fields of this query
				const messagesOnQueueCount = await ExternalMessageQueue.countDocuments(query)
				let status: StatusObject = {
					statusCode: StatusCode.GOOD,
				}
				if (messagesOnQueueCount > 0) {
					const messagesOnQueueExample = await ExternalMessageQueue.findOneAsync(query)
					status = {
						statusCode: StatusCode.WARNING_MAJOR,
						messages: [
							`There are ${messagesOnQueueCount} unsent messages on queue (one of the unsent messages has the error message: "${
								messagesOnQueueExample?.errorMessage
							}", to receiver "${messagesOnQueueExample?.type}", "${JSON.stringify(
								messagesOnQueueExample?.receiver
							)}")`,
						],
					}
				}
				setSystemStatus('External Message queue', status)
			})
		}, 5000)
	}
}

Meteor.startup(async () => {
	await ExternalMessageQueue.observeChanges(
		{
			sent: { $not: { $gt: 0 } },
			tryCount: { $gt: 3 },
		},
		{
			added: updateExternalMessageQueueStatus,
			changed: updateExternalMessageQueueStatus,
			removed: updateExternalMessageQueueStatus,
		}
	)

	updateExternalMessageQueueStatus()
	// triggerdoMessageQueue(5000)
})

async function removeExternalMessage(context: MethodContext, messageId: ExternalMessageQueueObjId): Promise<void> {
	check(messageId, String)

	assertConnectionHasOneOfPermissions(context.connection, ...USER_PERMISSIONS_FOR_EXTERNAL_MESSAGES)

	// TODO - is this safe? what if it is in the middle of execution?
	await ExternalMessageQueue.removeAsync(messageId)
}
async function toggleHold(context: MethodContext, messageId: ExternalMessageQueueObjId): Promise<void> {
	check(messageId, String)

	assertConnectionHasOneOfPermissions(context.connection, ...USER_PERMISSIONS_FOR_EXTERNAL_MESSAGES)

	const existingMessage = await ExternalMessageQueue.findOneAsync(messageId)
	if (!existingMessage) throw new Meteor.Error(404, `ExternalMessage "${messageId}" not found!`)

	await ExternalMessageQueue.updateAsync(messageId, {
		$set: {
			hold: !existingMessage.hold,
		},
	})
}
async function retry(context: MethodContext, messageId: ExternalMessageQueueObjId): Promise<void> {
	check(messageId, String)

	assertConnectionHasOneOfPermissions(context.connection, ...USER_PERMISSIONS_FOR_EXTERNAL_MESSAGES)

	const existingMessage = await ExternalMessageQueue.findOneAsync(messageId)
	if (!existingMessage) throw new Meteor.Error(404, `ExternalMessage "${messageId}" not found!`)

	const tryGap = getCurrentTime() - 1 * 60 * 1000
	await ExternalMessageQueue.updateAsync(messageId, {
		$set: {
			manualRetry: true,
			hold: false,
			errorFatal: false,
			lastTry:
				existingMessage.lastTry !== undefined && existingMessage.lastTry > tryGap
					? tryGap
					: existingMessage.lastTry,
		},
	})
	// triggerdoMessageQueue(1000)
}
class ServerExternalMessageQueueAPI extends MethodContextAPI implements NewExternalMessageQueueAPI {
	async remove(messageId: ExternalMessageQueueObjId) {
		return removeExternalMessage(this, messageId)
	}
	async toggleHold(messageId: ExternalMessageQueueObjId) {
		return toggleHold(this, messageId)
	}
	async retry(messageId: ExternalMessageQueueObjId) {
		return retry(this, messageId)
	}
}
registerClassToMeteorMethods(ExternalMessageQueueAPIMethods, ServerExternalMessageQueueAPI, false)
