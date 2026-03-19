import { ShowStyleBaseId, ShowStyleVariantId, StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBShowStyleVariant } from '@sofie-automation/corelib/dist/dataModel/ShowStyleVariant'

export interface NewShowStylesAPI {
	insertShowStyleBase(): Promise<ShowStyleBaseId>
	insertShowStyleVariant(showStyleBaseId: ShowStyleBaseId): Promise<ShowStyleVariantId>
	importShowStyleVariant(showStyleVariant: Omit<DBShowStyleVariant, '_id'>): Promise<ShowStyleVariantId>
	importShowStyleVariantAsNew(showStyleVariant: DBShowStyleVariant): Promise<ShowStyleVariantId>
	removeShowStyleBase(showStyleBaseId: ShowStyleBaseId): Promise<void>
	removeShowStyleVariant(showStyleVariantId: ShowStyleVariantId): Promise<void>
	reorderShowStyleVariant(showStyleVariantId: ShowStyleVariantId, newRank: number): Promise<void>

	getCreateAdlibTestingRundownOptions(): Promise<CreateAdlibTestingRundownOption[]>
}

export enum ShowStylesAPIMethods {
	'insertShowStyleBase' = 'showstyles.insertShowStyleBase',
	'insertShowStyleVariant' = 'showstyles.insertShowStyleVariant',
	'importShowStyleVariant' = 'showstyles.importShowStyleVariant',
	'importShowStyleVariantAsNew' = 'showstyles.importShowStyleVariantAsNew',
	'removeShowStyleBase' = 'showstyles.removeShowStyleBase',
	'removeShowStyleVariant' = 'showstyles.removeShowStyleVariant',
	'reorderShowStyleVariant' = 'showstyles.reorderShowStyleVariant',

	getCreateAdlibTestingRundownOptions = 'showstyles.getCreateAdlibTestingRundownOptions',
}

export interface CreateAdlibTestingRundownOption {
	studioId: StudioId
	showStyleVariantId: ShowStyleVariantId

	label: string
}
