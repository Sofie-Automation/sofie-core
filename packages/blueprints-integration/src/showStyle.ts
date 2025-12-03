import { ISourceLayer, IOutputLayer } from '@sofie-automation/shared-lib/dist/core/model/ShowStyle'
import { IBlueprintConfig } from './common.js'

export interface IBlueprintShowStyleBase {
	_id: string

	/** Id of the blueprint in the database */
	blueprintId: string

	/** "Outputs" in the UI */
	outputLayers: IOutputLayer[]
	/** "Layers" in the GUI */
	sourceLayers: ISourceLayer[]

	/** Config values are used by the Blueprints */
	blueprintConfig: IBlueprintConfig
}
export interface IBlueprintShowStyleVariant {
	_id: string
	name: string

	/** Config values are used by the Blueprints */
	blueprintConfig: IBlueprintConfig
}

export { ISourceLayer, IOutputLayer }
