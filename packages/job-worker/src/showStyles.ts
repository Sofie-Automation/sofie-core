import { IBlueprintConfig } from '@sofie-automation/blueprints-integration'
import { deepFreeze } from '@sofie-automation/corelib/dist/lib'
import deepmerge from 'deepmerge'
import { ReadonlyDeep } from 'type-fest'
import { ProcessedShowStyleBase, ProcessedShowStyleVariant, ProcessedShowStyleCompound } from './jobs/index.js'

export function createShowStyleCompound(
	showStyleBase: ReadonlyDeep<ProcessedShowStyleBase>,
	showStyleVariant: ReadonlyDeep<ProcessedShowStyleVariant>
): ReadonlyDeep<ProcessedShowStyleCompound> | undefined {
	if (showStyleBase._id !== showStyleVariant.showStyleBaseId) return undefined

	const configs = deepmerge<IBlueprintConfig>(
		showStyleBase.blueprintConfig as IBlueprintConfig,
		showStyleVariant.blueprintConfig as IBlueprintConfig,
		{
			arrayMerge: (_destinationArray, sourceArray, _options) => sourceArray,
		}
	)

	return deepFreeze({
		...showStyleBase,
		showStyleVariantId: showStyleVariant._id,
		name: `${showStyleBase.name}-${showStyleVariant.name}`,
		combinedBlueprintConfig: configs,
		_rundownVersionHash: showStyleBase._rundownVersionHash,
		_rundownVersionHashVariant: showStyleVariant._rundownVersionHash,
	})
}
