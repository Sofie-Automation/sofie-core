import type { IBlueprintConfig } from '../common.js'
import type { ReadonlyDeep } from 'type-fest'
import type { BlueprintConfigCoreConfig, BlueprintManifestBase, BlueprintManifestType, IConfigMessage } from './base.js'
import type { JSONSchema } from '@sofie-automation/shared-lib/dist/lib/JSONSchemaTypes'
import type { JSONBlob } from '@sofie-automation/shared-lib/dist/lib/JSONBlob'
import type {
	ICommonContext,
	IFixUpConfigContext,
	IStudioBaselineContext,
	IStudioUserContext,
	IProcessIngestDataContext,
} from '../context/index.js'
import type { IBlueprintShowStyleBase } from '../showStyle.js'
import type {
	ExtendedIngestRundown,
	NrcsIngestChangeDetails,
	IngestRundown,
	MutableIngestRundown,
	UserOperationChange,
} from '../ingest.js'
import type {
	ExpectedPlayoutItemGeneric,
	IBlueprintResultRundownPlaylist,
	IBlueprintRundownDB,
} from '../documents/index.js'
import type { BlueprintMappings } from '../studio.js'
import type { TimelineObjectCoreExt, TSR } from '../timeline.js'
import type { ExpectedPackage } from '../package.js'
import type {
	StudioRouteSet,
	StudioRouteSetExclusivityGroup,
} from '@sofie-automation/shared-lib/dist/core/model/StudioRouteSet'
import type {
	StudioPackageContainer,
	StudioPackageContainerSettings,
} from '@sofie-automation/shared-lib/dist/core/model/PackageContainer'
import type { IStudioSettings } from '@sofie-automation/shared-lib/dist/core/model/StudioSettings'
import type { MosDeviceConfig } from '@sofie-automation/shared-lib/dist/generated/MosGatewayDevicesTypes'
import type { MosGatewayConfig } from '@sofie-automation/shared-lib/dist/generated/MosGatewayOptionsTypes'
import type { PlayoutGatewayConfig } from '@sofie-automation/shared-lib/dist/generated/PlayoutGatewayConfigTypes'
import type { LiveStatusGatewayConfig } from '@sofie-automation/shared-lib/dist/generated/LiveStatusGatewayOptionsTypes'

export interface StudioBlueprintManifest<
	TRawConfig = IBlueprintConfig,
	TProcessedConfig = unknown,
> extends BlueprintManifestBase {
	blueprintType: BlueprintManifestType.STUDIO

	/** A list of config items this blueprint expects to be available on the Studio */
	studioConfigSchema: JSONBlob<JSONSchema>

	/** The config presets exposed by this blueprint */
	configPresets: Record<string, IStudioConfigPreset<TRawConfig>>

	/** Translations connected to the studio (as stringified JSON) */
	translations?: string

	/** Returns the items used to build the baseline (default state) of a studio, this is the baseline used when there's no active rundown */
	getBaseline: (context: IStudioBaselineContext) => BlueprintResultStudioBaseline

	/** Returns the id of the show style to use for a rundown, return null to ignore that rundown */
	getShowStyleId: (
		context: IStudioUserContext,
		showStyles: ReadonlyDeep<Array<IBlueprintShowStyleBase>>,
		ingestRundown: ExtendedIngestRundown
	) => string | null

	/** Returns information about the playlist this rundown is a part of, return null to not make it a part of a playlist */
	getRundownPlaylistInfo?: (
		context: IStudioUserContext,
		rundowns: IBlueprintRundownDB[],
		playlistExternalId: string
	) => BlueprintResultRundownPlaylist | null

	/**
	 * Apply automatic upgrades to the structure of user specified config overrides
	 * This lets you apply various changes to the user's values in an abstract way
	 */
	fixUpConfig?: (context: IFixUpConfigContext<TRawConfig>) => void

	/**
	 * Validate the config passed to this blueprint
	 * In this you should do various sanity checks of the config and return a list of messages to display to the user.
	 * These messages do not stop `applyConfig` from being called.
	 */
	validateConfig?: (context: ICommonContext, config: TRawConfig) => Array<IConfigMessage>

	/**
	 * Apply the config by generating the data to be saved into the db.
	 * This should be written to give a predictable and stable result, it can be called with the same config multiple times
	 */
	applyConfig?: (
		context: ICommonContext,
		config: TRawConfig,
		coreConfig: BlueprintConfigCoreConfig
	) => BlueprintResultApplyStudioConfig

	/** Preprocess config before storing it by core to later be returned by context's getStudioConfig. If not provided, getStudioConfig will return unprocessed blueprint config */
	preprocessConfig?: (
		context: ICommonContext,
		config: TRawConfig,
		coreConfig: BlueprintConfigCoreConfig
	) => TProcessedConfig

	/**
	 * Optional method to validate the blueprint config passed to this blueprint according to the API schema.
	 * Returns a list of messages to the caller that are used for logging or to throw if errors have been found.
	 */
	validateConfigFromAPI?: (context: ICommonContext, apiConfig: object) => Array<IConfigMessage>

	/** Validate the rundown payload passed to this blueprint according to the API schema, returning a list of error messages. */
	validateRundownPayloadFromAPI?: (context: ICommonContext, payload: unknown) => Array<string>

	/** Validate the segment payload passed to this blueprint according to the API schema, returning a list of error messages. */
	validateSegmentPayloadFromAPI?: (context: ICommonContext, payload: unknown) => Array<string>

	/** Validate the part payload passed to this blueprint according to the API schema, returning a list of error messages. */
	validatePartPayloadFromAPI?: (context: ICommonContext, payload: unknown) => Array<string>

	/**
	 * Optional method to transform from an API blueprint config to the database blueprint config if these are required to be different.
	 * If this method is not defined the config object will be used directly
	 */
	blueprintConfigFromAPI?: (context: ICommonContext, config: object) => IBlueprintConfig

	/**
	 * Optional method to transform from a database blueprint config to the API blueprint config if these are required to be different.
	 * If this method is not defined the config object will be used directly
	 */
	blueprintConfigToAPI?: (context: ICommonContext, config: TRawConfig) => object

	/**
	 * Process an ingest operation, to apply changes to the sofie interpretation of the ingest data
	 */
	processIngestData?: (
		context: IProcessIngestDataContext,
		mutableIngestRundown: MutableIngestRundown<any, any, any>,
		nrcsIngestRundown: IngestRundown,
		previousNrcsIngestRundown: IngestRundown | undefined,
		changes: NrcsIngestChangeDetails | UserOperationChange
	) => Promise<void>
}

export interface BlueprintResultStudioBaseline {
	timelineObjects: TimelineObjectCoreExt<TSR.TSRTimelineContent>[]
	expectedPlayoutItems?: ExpectedPlayoutItemGeneric[]
	expectedPackages?: ExpectedPackage.Any[]
}

/** Key is the ID of the external ID of the Rundown, Value is the rank to be assigned */
export interface BlueprintResultOrderedRundowns {
	[rundownExternalId: string]: number
}

export interface BlueprintResultRundownPlaylist {
	playlist: IBlueprintResultRundownPlaylist
	/** Returns information about the order of rundowns in a playlist, null will use natural sorting on rundown name */
	order: BlueprintResultOrderedRundowns | null
}

/**
 * Blueprint defined default values for various Studio configuration.
 * Note: The user is able to override values from these in the UI, as well as add their own entries and disable ones which are defined here
 */
export interface BlueprintResultApplyStudioConfig {
	/** Playout Mappings */
	mappings: BlueprintMappings

	/** Parent device settings */
	parentDevices: Record<string, BlueprintParentDeviceSettings>
	/** Playout-gateway subdevices */
	playoutDevices: Record<string, { parentConfigId?: string; options: TSR.DeviceOptionsAny }>
	/** Ingest-gateway subdevices, the types here depend on the gateway you use */
	ingestDevices: Record<string, { parentConfigId?: string; options: BlueprintMosDeviceConfig | unknown }>
	/** Input-gateway subdevices */
	inputDevices: Record<string, { parentConfigId?: string; options: unknown }>
	/** Route Sets */
	routeSets?: Record<string, StudioRouteSet>
	/** Route Set Exclusivity Groups */
	routeSetExclusivityGroups?: Record<string, StudioRouteSetExclusivityGroup>
	/** Package Containers */
	packageContainers?: Record<string, StudioPackageContainer>
	/** Which Package Containers are used for media previews/thumbnails in GUI */
	packageContainerSettings?: StudioPackageContainerSettings

	studioSettings?: IStudioSettings
}
export interface BlueprintParentDeviceSettings {
	/**
	 * User friendly name for the device
	 */
	name: string

	options: Record<string, any>
}

export type BlueprintMosGatewayConfig = MosGatewayConfig

export type BlueprintMosDeviceConfig = MosDeviceConfig

export type BlueprintPlayoutGatewayConfig = PlayoutGatewayConfig

export type BlueprintLiveStatusGatewayConfig = LiveStatusGatewayConfig

export interface IStudioConfigPreset<TConfig = IBlueprintConfig> {
	name: string

	config: TConfig
}
