import { RundownLayoutType } from '../collections/RundownLayouts'
import { RundownLayoutId, ShowStyleBaseId } from '@sofie-automation/corelib/dist/dataModel/Ids'

export interface NewRundownLayoutsAPI {
	createRundownLayout(
		name: string,
		type: RundownLayoutType,
		showStyleBaseId: ShowStyleBaseId,
		regionId: string
	): Promise<RundownLayoutId>
	removeRundownLayout(id: RundownLayoutId): Promise<void>
}

export enum RundownLayoutsAPIMethods {
	'removeRundownLayout' = 'rundownLayout.removeRundownLayout',
	'createRundownLayout' = 'rundownLayout.createRundownLayout',
}
