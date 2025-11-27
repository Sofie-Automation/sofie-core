import { ShowStyleBaseId, ShowStyleVariantId, StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import {
	HotkeyDefinition,
	OutputLayers,
	SourceLayers,
	type DBShowStyleBase,
} from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
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

/**
 * A minimal version of DBShowStyleBase, intended for the playout portions of the UI.
 * Note: The settings ui uses the raw types
 * This intentionally does not extend ShowStyleBase, so that we have fine-grained control over the properties exposed
 */
export interface UIShowStyleBase {
	_id: ShowStyleBaseId

	/** Name of this show style */
	name: string

	/** A list of hotkeys, used to display a legend of hotkeys for the user in GUI */
	hotkeyLegend?: Array<HotkeyDefinition>

	/** "Outputs" in the UI */
	outputLayers: OutputLayers
	/** "Layers" in the GUI */
	sourceLayers: SourceLayers

	/** Configuration for displaying AB resolver channels on various screens */
	abChannelDisplay?: DBShowStyleBase['abChannelDisplay']
}

export interface CreateAdlibTestingRundownOption {
	studioId: StudioId
	showStyleVariantId: ShowStyleVariantId

	label: string
}
