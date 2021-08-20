import { DBTriggeredActions, TriggeredActionId } from '../collections/TriggeredActions'
import { ShowStyleBaseId } from '../collections/ShowStyleBases'

export interface NewTriggeredActionsAPI {
	createTriggeredActions(
		showStyleBaseId: ShowStyleBaseId | null,
		base?: Partial<Pick<DBTriggeredActions, '_rank' | 'triggers' | 'actions' | 'name'>>
	): Promise<TriggeredActionId>
	removeTriggeredActions(id: TriggeredActionId): Promise<void>
}

export enum TriggeredActionsAPIMethods {
	'removeTriggeredActions' = 'triggeredActions.removeTriggeredActions',
	'createTriggeredActions' = 'triggeredActions.createTriggeredActions',
}
