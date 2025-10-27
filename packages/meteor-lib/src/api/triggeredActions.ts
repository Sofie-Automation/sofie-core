import { ITranslatableMessage, SomeAction } from '@sofie-automation/blueprints-integration'
import { ShowStyleBaseId, TriggeredActionId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBBlueprintTrigger } from '../collections/TriggeredActions.js'

export interface NewTriggeredActionsAPI {
	createTriggeredActions(
		showStyleBaseId: ShowStyleBaseId | null,
		base?: CreateTriggeredActionsContent
	): Promise<TriggeredActionId>
	removeTriggeredActions(id: TriggeredActionId): Promise<void>
}

export interface CreateTriggeredActionsContent {
	_rank?: number
	name?: ITranslatableMessage | string
	triggers?: Record<string, DBBlueprintTrigger>
	actions?: Record<string, SomeAction>
	styleClassNames?: string
}

export enum TriggeredActionsAPIMethods {
	'removeTriggeredActions' = 'triggeredActions.removeTriggeredActions',
	'createTriggeredActions' = 'triggeredActions.createTriggeredActions',
}
