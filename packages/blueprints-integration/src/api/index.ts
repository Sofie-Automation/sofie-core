import type { SystemBlueprintManifest } from './system.js'
import type { StudioBlueprintManifest } from './studio.js'
import type { ShowStyleBlueprintManifest } from './showStyle.js'

export * from './base.js'
export * from './showStyle.js'
export * from './studio.js'
export * from './system.js'

export interface BlueprintManifestSet {
	blueprints: {
		[id: string]: string
	}
	assets: {
		[id: string]: string
	}
}
export type SomeBlueprintManifest = SystemBlueprintManifest | StudioBlueprintManifest | ShowStyleBlueprintManifest
