import type {
	IBlueprintConfig,
	StudioRouteSet,
	StudioRouteSetExclusivityGroup,
} from '@sofie-automation/blueprints-integration'
import type { DBStudio, IStudioSettings, MappingsExt } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { omit } from '@sofie-automation/corelib/dist/lib'
import { applyAndValidateOverrides } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'

/**
 * A lightly processed version of DBStudio, with any ObjectWithOverrides<T> pre-flattened
 */
export interface JobStudio extends Omit<
	DBStudio,
	| 'mappingsWithOverrides'
	| 'blueprintConfigWithOverrides'
	| 'settingsWithOverrides'
	| 'routeSetsWithOverrides'
	| 'routeSetExclusivityGroupsWithOverrides'
	| 'packageContainersWithOverrides'
> {
	/** Mappings between the physical devices / outputs and logical ones */
	mappings: MappingsExt

	/** Config values are used by the Blueprints */
	blueprintConfig: IBlueprintConfig

	settings: IStudioSettings

	routeSets: Record<string, StudioRouteSet>
	routeSetExclusivityGroups: Record<string, StudioRouteSetExclusivityGroup>

	// /** Contains settings for which Package Containers are present in the studio.
	//  * (These are used by the Package Manager and the Expected Packages)
	//  */
	// packageContainers: Record<string, StudioPackageContainer>
}

export function convertStudioToJobStudio(studio: DBStudio): JobStudio {
	return {
		...omit(
			studio,
			'mappingsWithOverrides',
			'blueprintConfigWithOverrides',
			'settingsWithOverrides',
			'routeSetsWithOverrides',
			'routeSetExclusivityGroupsWithOverrides',
			'packageContainersWithOverrides'
		),
		// Note: checking for the overrides properties to exist first,
		// because if they might not exist when migrating from an older version
		// and this would crash the job-worker, creating a catch-22 situation.

		mappings: studio.mappingsWithOverrides
			? applyAndValidateOverrides(studio.mappingsWithOverrides).obj
			: (studio as any).mappings || {},
		blueprintConfig: studio.blueprintConfigWithOverrides
			? applyAndValidateOverrides(studio.blueprintConfigWithOverrides).obj
			: (studio as any).blueprintConfig || {},
		settings: studio.settingsWithOverrides
			? applyAndValidateOverrides(studio.settingsWithOverrides).obj
			: (studio as any).settings || {},
		routeSets: studio.routeSetsWithOverrides
			? applyAndValidateOverrides(studio.routeSetsWithOverrides).obj
			: (studio as any).routeSets || {},
		routeSetExclusivityGroups: studio.routeSetExclusivityGroupsWithOverrides
			? applyAndValidateOverrides(studio.routeSetExclusivityGroupsWithOverrides).obj
			: (studio as any).routeSetExclusivityGroups || {},
		// packageContainers: studio.packageContainersWithOverrides ? applyAndValidateOverrides(studio.packageContainersWithOverrides).obj : (studio as any).packageContainers || {},
	}
}
