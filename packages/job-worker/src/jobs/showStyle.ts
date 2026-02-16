import { IBlueprintConfig } from '@sofie-automation/blueprints-integration'
import { ShowStyleVariantId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBShowStyleBase, OutputLayers, SourceLayers } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { DBShowStyleVariant } from '@sofie-automation/corelib/dist/dataModel/ShowStyleVariant'
import { deepFreeze, omit } from '@sofie-automation/corelib/dist/lib'
import { applyAndValidateOverrides } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { ReadonlyDeep } from 'type-fest'

/**
 * A lightly processed version of DBShowStyleVariant, with any ObjectWithOverrides<T> pre-flattened
 */
export interface ProcessedShowStyleVariant extends Omit<DBShowStyleVariant, 'blueprintConfigWithOverrides'> {
	blueprintConfig: IBlueprintConfig
}

/**
 * A lightly processed version of DBShowStyleBase, with any ObjectWithOverrides<T> pre-flattened
 */
export interface ProcessedShowStyleBase extends Omit<
	DBShowStyleBase,
	'sourceLayersWithOverrides' | 'outputLayersWithOverrides' | 'blueprintConfigWithOverrides'
> {
	sourceLayers: SourceLayers
	outputLayers: OutputLayers
	blueprintConfig: IBlueprintConfig
}

export interface ProcessedShowStyleCompound extends Omit<ProcessedShowStyleBase, 'blueprintConfig'> {
	showStyleVariantId: ShowStyleVariantId
	_rundownVersionHashVariant: string
	combinedBlueprintConfig: IBlueprintConfig
}

export function processShowStyleBase(doc: DBShowStyleBase): ReadonlyDeep<ProcessedShowStyleBase> {
	return deepFreeze<ProcessedShowStyleBase>({
		...omit(doc, 'sourceLayersWithOverrides', 'outputLayersWithOverrides', 'blueprintConfigWithOverrides'),
		sourceLayers: applyAndValidateOverrides(doc.sourceLayersWithOverrides).obj,
		outputLayers: applyAndValidateOverrides(doc.outputLayersWithOverrides).obj,
		blueprintConfig: applyAndValidateOverrides(doc.blueprintConfigWithOverrides).obj,
	})
}
export function processShowStyleVariant(doc: DBShowStyleVariant): ReadonlyDeep<ProcessedShowStyleVariant> {
	return deepFreeze<ProcessedShowStyleVariant>({
		...omit(doc, 'blueprintConfigWithOverrides'),
		blueprintConfig: applyAndValidateOverrides(doc.blueprintConfigWithOverrides).obj,
	})
}
