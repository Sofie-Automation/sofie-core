import {
	BlueprintManifestType,
	IBlueprintConfig,
	IStudioConfigPreset,
	IShowStyleConfigPreset,
} from '@sofie-automation/blueprints-integration'
import { JSONBlob } from '@sofie-automation/shared-lib/dist/lib/JSONBlob'
import { JSONSchema } from '@sofie-automation/shared-lib/dist/lib/JSONSchemaTypes'
import { ProtectedString } from '../protectedString.js'
import { BlueprintId } from './Ids.js'
import type { PackageStatusMessage } from '@sofie-automation/shared-lib/dist/packageStatusMessages'

export type BlueprintHash = ProtectedString<'BlueprintHash'>

export interface Blueprint {
	_id: BlueprintId
	name: string
	/** String containing the Code for the blueprint */
	code: string
	/** Whether the blueprint has a code or not. Is equal to !!blueprint.code. */
	hasCode: boolean
	/** Timestamp, last time the blueprint was modified */
	modified: number
	/** Timestamp, when the blueprint was created */
	created: number

	/**
	 * Blueprint author defined unique id for this blueprint
	 * This could be the same for multiple blueprints in the system
	 */
	blueprintId: string
	blueprintType?: BlueprintManifestType

	studioConfigSchema?: JSONBlob<JSONSchema>
	showStyleConfigSchema?: JSONBlob<JSONSchema>

	studioConfigPresets?: Record<string, IStudioConfigPreset>
	showStyleConfigPresets?: Record<string, IShowStyleConfigPreset>

	databaseVersion: {
		system: string | undefined
	}

	blueprintVersion: string
	integrationVersion: string
	TSRVersion: string
	/** Whether version checks should be disabled for this version */
	disableVersionChecks?: boolean

	/** Hash for the blueprint, changed each time it is changed */
	blueprintHash: BlueprintHash

	/** Whether the blueprint this wraps has a `fixUpConfig` function defined */
	hasFixUpFunction: boolean

	/**
	 * The blueprint provided alternate package status messages, if any were provided
	 * Any undefined/unset values will use the system default messages.
	 * Any empty strings will suppress the message from being shown.
	 */
	packageStatusMessages?: Partial<Record<PackageStatusMessage, string | undefined>>
}

/** Describes the last state a Blueprint document was in when applying config changes */
export interface LastBlueprintConfig {
	blueprintId: BlueprintId
	blueprintHash: BlueprintHash
	blueprintConfigPresetId: string | undefined

	config: IBlueprintConfig
}
