import { ExternalMessageQueueObjId } from '@sofie-automation/corelib/dist/dataModel/Ids'

export interface NewExternalMessageQueueAPI {
	remove(messageId: ExternalMessageQueueObjId): Promise<void>
	toggleHold(messageId: ExternalMessageQueueObjId): Promise<void>
	retry(messageId: ExternalMessageQueueObjId): Promise<void>
}

export enum ExternalMessageQueueAPIMethods {
	'remove' = 'externalMessages.remove',
	'toggleHold' = 'externalMessages.toggleHold',
	'retry' = 'externalMessages.retry',
}
