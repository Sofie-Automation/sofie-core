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
/** A Branding of a ShowStyle, as exposed to the Blueprints */
export interface IBlueprintBrandingInfo {
	/** Id of the Branding, as stored on the ShowStyleBase */
	_id: string

	/** User facing name of the Branding */
	name: string

	/** Config for this Branding, as described by `ShowStyleBlueprintManifest.brandingConfigSchema` */
	config: IBlueprintConfig
}

export interface IBlueprintShowStyleVariant {
	_id: string
	name: string

	/** Config values are used by the Blueprints */
	blueprintConfig: IBlueprintConfig
}

export { ISourceLayer, IOutputLayer }
