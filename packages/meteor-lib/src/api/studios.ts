import { PeripheralDeviceId, StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import {
	IStudioSettings,
	MappingsExt,
	StudioRouteSet,
	StudioRouteSetExclusivityGroup,
} from '@sofie-automation/corelib/dist/dataModel/Studio'

export interface NewStudiosAPI {
	insertStudio(): Promise<StudioId>
	removeStudio(studioId: StudioId): Promise<void>

	assignConfigToPeripheralDevice(
		studioId: StudioId,
		configId: string,
		deviceId: PeripheralDeviceId | null
	): Promise<void>
}

export enum StudiosAPIMethods {
	'insertStudio' = 'studio.insertStudio',
	'removeStudio' = 'studio.removeStudio',

	'assignConfigToPeripheralDevice' = 'studio.assignConfigToPeripheralDevice',
}

/**
 * A minimal version of DBStudio, intended for the playout portions of the UI.
 * Note: The settings ui uses the raw types
 * This intentionally does not extend Studio, so that we have fine-grained control over the properties exposed
 */
export interface UIStudio {
	_id: StudioId

	/** User-presentable name for the studio installation */
	name: string

	/** Mappings between the physical devices / outputs and logical ones */
	mappings: MappingsExt

	settings: IStudioSettings

	routeSets: Record<string, StudioRouteSet>
	routeSetExclusivityGroups: Record<string, StudioRouteSetExclusivityGroup>
}
