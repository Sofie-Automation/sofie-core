import type { BlueprintMappings } from '@sofie-automation/shared-lib/dist/core/model/Timeline'
import type { ICommonContext, IUserNotesContext } from './baseContext.js'
import type { IPackageInfoContext } from './packageInfoContext.js'

export interface IStudioContext extends ICommonContext {
	/** The id of the studio */
	readonly studioId: string

	/** Returns the Studio blueprint config. If StudioBlueprintManifest.preprocessConfig is provided, a config preprocessed by that function is returned, otherwise it is returned unprocessed */
	getStudioConfig: () => unknown
	/** Returns a reference to a studio config value, that can later be resolved in Core */
	getStudioConfigRef(configKey: string): string

	/** Get the mappings for the studio */
	getStudioMappings: () => Readonly<BlueprintMappings>
}

export interface IStudioBaselineContext extends IStudioContext, IPackageInfoContext {}

export interface IStudioUserContext extends IUserNotesContext, IStudioContext {}
