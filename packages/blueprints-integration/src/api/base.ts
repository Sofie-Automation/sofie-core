import type { NoteSeverity } from '../lib.js'
import type { ITranslatableMessage } from '../translations.js'

export enum BlueprintManifestType {
	SYSTEM = 'system',
	STUDIO = 'studio',
	SHOWSTYLE = 'showstyle',
}

export interface BlueprintManifestBase {
	blueprintType: BlueprintManifestType
	// Manifest properties, to be used by Core

	/** Unique id of the blueprint. This is used by core to check if blueprints are the same blueprint, but differing versions */
	blueprintId?: string
	/** Version of the blueprint */
	blueprintVersion: string
	/** Version of the blueprint-integration that the blueprint depend on */
	integrationVersion: string
	/** Version of the TSR-types that the blueprint depend on */
	TSRVersion: string
}

export interface IConfigMessage {
	level: NoteSeverity
	message: ITranslatableMessage
}

export interface BlueprintConfigCoreConfig {
	hostUrl: string
	frameRate: number
}
