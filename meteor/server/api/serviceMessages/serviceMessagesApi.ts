import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'
import { ServiceMessage } from '@sofie-automation/meteor-lib/dist/collections/CoreSystem'
import { getCoreSystemAsync } from '../../coreSystem/collection'
import { logger } from '../../logging'
import { CoreSystem } from '../../collections'

export interface WriteStatus {
	isUpdate?: boolean
}

/**
 * Get all service messages in the system currently
 *
 * @returns all service messages currently stored in the system
 *
 * @throws if messages cant be read due to a technical problem
 */
export async function readAllMessages(): Promise<Array<ServiceMessage>> {
	const coreSystem = await getCoreSystemAsync()
	if (!coreSystem || !coreSystem.serviceMessages) {
		logger.error('coreSystem.serviceMessages doesnt exist. ServiceMessages API wont work.')
		throw new Error('coreSystem.serviceMessages is not available. Database not migrated?')
	}

	const { serviceMessages } = coreSystem
	return Object.keys(serviceMessages).map((key) => serviceMessages[key])
}

/**
 * Store a service message in the system
 *
 * @param message - the message to be stored
 *
 * @returns status for the write operation
 *
 * @throws when a message can't be written
 */
export async function writeMessage(message: ServiceMessage): Promise<WriteStatus> {
	const coreSystem = await getCoreSystemAsync()
	if (!coreSystem || !coreSystem.serviceMessages) {
		throw new Error('coreSystem.serviceMessages is not available. Database not migrated?')
	}

	const { serviceMessages } = coreSystem
	const isUpdate = serviceMessages[message.id] ? true : false

	try {
		serviceMessages[message.id] = message
		await CoreSystem.updateAsync(coreSystem._id, { $set: { serviceMessages } })
		return { isUpdate }
	} catch (error) {
		logger.error(stringifyError(error))
		throw new Error(`Unable to store service message: ${stringifyError(error)}`)
	}
}

export async function deleteMessage(id: string): Promise<ServiceMessage> {
	const coreSystem = await getCoreSystemAsync()
	if (!coreSystem || !coreSystem.serviceMessages) {
		throw new Error('coreSystem.serviceMessages is not available. Database not migrated?')
	}

	const { serviceMessages } = coreSystem
	const message = serviceMessages[id]

	try {
		if (message) {
			delete serviceMessages[message.id]
			await CoreSystem.updateAsync(coreSystem._id, { $set: { serviceMessages } })
			return message
		} else {
			throw new Error(`Message with id ${id} can not be found, and therefore not deleted`)
		}
	} catch (error) {
		logger.error(stringifyError(error))
		throw new Error(`Unable to delete service message ${id}: ${stringifyError(error)}`)
	}
}
