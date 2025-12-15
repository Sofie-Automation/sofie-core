import { IBlueprintConfig, IOutputLayer, ISourceLayer, SourceLayerType } from '@sofie-automation/blueprints-integration'
import { ObjectWithOverrides } from '../settings/objectWithOverrides.js'
import { BlueprintHash, LastBlueprintConfig } from './Blueprint.js'
import { BlueprintId, ShowStyleBaseId } from './Ids.js'

export interface HotkeyDefinition {
	_id: string
	/** Reference to the hotkey in Sofie */
	key: string
	/** Label of the key, to be displayed in GUI */
	label: string

	// --------- Note: The properties below are used in a TV2-only feature --------------

	/** Alternate hotkey that can be used through AutoHotKey, after importing the script */
	platformKey?: string
	/** Used for the color */
	sourceLayerType?: SourceLayerType
	/** Alternate color */
	buttonColor?: string
	up?: (e: any) => void
	down?: (e: any) => void
}

export type OutputLayers = Record<string, IOutputLayer | undefined>
export type SourceLayers = Record<string, ISourceLayer | undefined>

export interface DBShowStyleBase {
	_id: ShowStyleBaseId

	/** Name of this show style */
	name: string
	/** Id of the blueprint used by this show-style */
	blueprintId: BlueprintId
	/** Id of the blueprint config preset */
	blueprintConfigPresetId?: string
	/** Whether blueprintConfigPresetId is invalid, and does not match a currently exposed preset from the Blueprint */
	blueprintConfigPresetIdUnlinked?: boolean

	/** A list of hotkeys, used to display a legend of hotkeys for the user in GUI */
	hotkeyLegend?: Array<HotkeyDefinition>

	/** "Outputs" in the UI */
	outputLayersWithOverrides: ObjectWithOverrides<OutputLayers>
	/** "Layers" in the GUI */
	sourceLayersWithOverrides: ObjectWithOverrides<SourceLayers>

	/** Config values are used by the Blueprints */
	blueprintConfigWithOverrides: ObjectWithOverrides<IBlueprintConfig>

	/** Configuration for displaying AB resolver channel assignments across different screens */
	abChannelDisplay?: {
		/** Source layer IDs that should show AB channel info */
		sourceLayerIds: string[]
		/** Configure by source layer type */
		sourceLayerTypes: SourceLayerType[]
		/** Only show for specific output layers (e.g., only PGM) */
		outputLayerIds: string[]
		/** Enable display on Director screen */
		showOnDirectorScreen: boolean
		// Future: showOnPresenterScreen, showOnCameraScreen when those views are implemented
	}

	/** Blueprint default for abChannelDisplay (saved during blueprint upgrade) */
	blueprintAbChannelDisplay?: {
		sourceLayerIds: string[]
		sourceLayerTypes: SourceLayerType[]
		outputLayerIds: string[]
		showOnDirectorScreen: boolean
	}

	_rundownVersionHash: string

	/** Details on the last blueprint used to generate the defaults values for this */
	lastBlueprintConfig: LastBlueprintConfig | undefined
	/** Last BlueprintHash where the fixupConfig method was run */
	lastBlueprintFixUpHash: BlueprintHash | undefined
}
