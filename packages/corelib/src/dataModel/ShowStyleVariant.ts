import { IBlueprintConfig } from '@sofie-automation/blueprints-integration'
import { ObjectWithOverrides } from '../settings/objectWithOverrides.js'
import { ShowStyleVariantId, ShowStyleBaseId } from './Ids.js'

export interface DBShowStyleVariant {
	_id: ShowStyleVariantId

	/** A number used to sort the variants within their ShowStyleBase. */
	_rank: number

	/** Id of parent ShowStyleBase */
	showStyleBaseId: ShowStyleBaseId

	/** Id of the blueprint config preset */
	blueprintConfigPresetId?: string
	/** Whether blueprintConfigPresetId is invalid, and does not match a currently exposed preset from the Blueprint */
	blueprintConfigPresetIdUnlinked?: boolean

	name: string

	/** Config values are used by the Blueprints */
	blueprintConfigWithOverrides: ObjectWithOverrides<IBlueprintConfig>

	/** Whether a testing rundown can be generated for this variant */
	canGenerateAdlibTestingRundown?: boolean

	_rundownVersionHash: string
}
