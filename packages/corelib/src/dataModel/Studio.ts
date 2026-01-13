import { IBlueprintConfig, TSR } from '@sofie-automation/blueprints-integration'
import { ObjectWithOverrides } from '../settings/objectWithOverrides.js'
import { StudioId, BlueprintId, ShowStyleBaseId, MappingsHash, PeripheralDeviceId } from './Ids.js'
import { BlueprintHash, LastBlueprintConfig } from './Blueprint.js'
import { MappingsExt, MappingExt } from '@sofie-automation/shared-lib/dist/core/model/Timeline'
import {
	ResultingMappingRoute,
	RouteMapping,
	StudioRouteBehavior,
	ResultingMappingRoutes,
	StudioRouteSet,
	StudioRouteSetExclusivityGroup,
	StudioRouteType,
	StudioAbPlayerDisabling,
} from '@sofie-automation/shared-lib/dist/core/model/StudioRouteSet'
import { StudioPackageContainer } from '@sofie-automation/shared-lib/dist/core/model/PackageContainer'
import { IStudioSettings } from '@sofie-automation/shared-lib/dist/core/model/StudioSettings'

export { MappingsExt, MappingExt, MappingsHash, IStudioSettings }

// RouteSet functions has been moved to shared-lib:
// So we need to re-export them here:
export {
	StudioRouteSetExclusivityGroup,
	ResultingMappingRoute,
	RouteMapping,
	StudioRouteBehavior,
	ResultingMappingRoutes,
	StudioRouteSet,
	StudioRouteType,
	StudioAbPlayerDisabling,
	StudioPackageContainer,
}

export type StudioLight = Omit<DBStudio, 'mappingsWithOverrides' | 'blueprintConfigWithOverrides'>

/** A set of available layer groups in a given installation */
export interface DBStudio {
	_id: StudioId

	/** User-presentable name for the studio installation */
	name: string
	/** Id of the blueprint used by this studio-installation */
	blueprintId?: BlueprintId
	/** Id of the blueprint config preset */
	blueprintConfigPresetId?: string
	/** Whether blueprintConfigPresetId is invalid, and does not match a currently exposed preset from the Blueprint */
	blueprintConfigPresetIdUnlinked?: boolean

	/** Mappings between the physical devices / outputs and logical ones */
	mappingsWithOverrides: ObjectWithOverrides<MappingsExt>

	/**
	 * A hash that is to be changed whenever there is a change to the mappings or routeSets
	 * The reason for this to exist is to be able to sync the timeline to what set of mappings it was created (routed) from.
	 */
	mappingsHash?: MappingsHash

	/** List of which ShowStyleBases this studio wants to support */
	supportedShowStyleBase: Array<ShowStyleBaseId>

	/** Config values are used by the Blueprints */
	blueprintConfigWithOverrides: ObjectWithOverrides<IBlueprintConfig>

	settingsWithOverrides: ObjectWithOverrides<IStudioSettings>

	_rundownVersionHash: string

	routeSetsWithOverrides: ObjectWithOverrides<Record<string, StudioRouteSet>>
	routeSetExclusivityGroupsWithOverrides: ObjectWithOverrides<Record<string, StudioRouteSetExclusivityGroup>>

	/** Contains settings for which Package Containers are present in the studio.
	 * (These are used by the Package Manager and the Expected Packages)
	 */
	packageContainersWithOverrides: ObjectWithOverrides<Record<string, StudioPackageContainer>>

	/** Which package containers is used for media previews in GUI */
	previewContainerIds: string[]
	thumbnailContainerIds: string[]

	peripheralDeviceSettings: StudioPeripheralDeviceSettings

	/** Details on the last blueprint used to generate the defaults values for this */
	lastBlueprintConfig: LastBlueprintConfig | undefined
	/** Last BlueprintHash where the fixupConfig method was run */
	lastBlueprintFixUpHash: BlueprintHash | undefined
}

export interface StudioPeripheralDeviceSettings {
	/** Settings for gateway parent-devices */
	deviceSettings: ObjectWithOverrides<Record<string, StudioDeviceSettings>>

	/** Playout gateway sub-devices */
	playoutDevices: ObjectWithOverrides<Record<string, StudioPlayoutDevice>>

	/** Ingest gateway sub-devices */
	ingestDevices: ObjectWithOverrides<Record<string, StudioIngestDevice>>

	/** Input gateway sub-devices */
	inputDevices: ObjectWithOverrides<Record<string, StudioInputDevice>>
}

export interface StudioIngestDevice {
	/**
	 * The id of the gateway this is assigned to
	 * Future: This may be replaced with some other grouping or way of assigning devices
	 */
	peripheralDeviceId: PeripheralDeviceId | undefined
	/** Settings blob of the subdevice, from the sub-device config schema */
	options: unknown
}

export interface StudioInputDevice {
	/**
	 * The id of the gateway this is assigned to
	 * Future: This may be replaced with some other grouping or way of assigning devices
	 */
	peripheralDeviceId: PeripheralDeviceId | undefined
	/** Settings blob of the subdevice, from the sub-device config schema */
	options: unknown
}

export interface StudioPlayoutDevice {
	/**
	 * The id of the gateway this is assigned to
	 * Future: This may be replaced with some other grouping or way of assigning devices
	 */
	peripheralDeviceId: PeripheralDeviceId | undefined

	options: TSR.DeviceOptionsAny
}

export interface StudioDeviceSettings {
	/**
	 * User friendly name for the device
	 */
	name: string

	options: unknown
}
