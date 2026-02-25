import type { ActionUserData, IBlueprintActionManifest } from '../action.js'
import type {
	IActionExecutionContext,
	ISyncIngestUpdateToPartInstanceContext,
	IPartEventContext,
	IRundownContext,
	IStudioUserContext,
	ISegmentUserContext,
	IShowStyleUserContext,
	ICommonContext,
	ITimelineEventContext,
	IRundownDataChangedEventContext,
	IRundownTimingEventContext,
	IGetRundownContext,
	IDataStoreActionExecutionContext,
	IRundownActivationContext,
	IShowStyleContext,
	IFixUpConfigContext,
	IOnTakeContext,
	IOnSetAsNextContext,
} from '../context/index.js'
import type { IngestAdlib, ExtendedIngestRundown, IngestRundown } from '../ingest.js'
import type { IBlueprintExternalMessageQueueObj } from '../message.js'
import type {
	IBlueprintAdLibPiece,
	IBlueprintResolvedPieceInstance,
	IBlueprintPartInstance,
	PartEndState,
	IBlueprintPieceInstance,
	IBlueprintPartDB,
	IBlueprintAdLibPieceDB,
	IBlueprintRundown,
	ExpectedPlayoutItemGeneric,
	IBlueprintSegment,
	IBlueprintPiece,
	IBlueprintPart,
	IBlueprintRundownPiece,
	IBlueprintRundownPieceDB,
} from '../documents/index.js'
import type { IBlueprintShowStyleVariant, IOutputLayer, ISourceLayer } from '../showStyle.js'
import type { SourceLayerType } from '../content.js'
import type { TSR, OnGenerateTimelineObj, TimelineObjectCoreExt } from '../timeline.js'
import type { IBlueprintConfig } from '../common.js'
import type { ReadonlyDeep } from 'type-fest'
import type { JSONSchema } from '@sofie-automation/shared-lib/dist/lib/JSONSchemaTypes'
import type { JSONBlob } from '@sofie-automation/shared-lib/dist/lib/JSONBlob'
import type { BlueprintConfigCoreConfig, BlueprintManifestBase, BlueprintManifestType, IConfigMessage } from './base.js'
import type { IBlueprintTriggeredActions } from '../triggers.js'
import type { ExpectedPackage } from '../package.js'
import type { ABResolverConfiguration } from '../abPlayback.js'
import type { SofieIngestSegment } from '../ingest-types.js'
import { PackageStatusMessage } from '@sofie-automation/shared-lib/dist/packageStatusMessages'
import { BlueprintPlayoutPersistentStore } from '../context/playoutStore.js'

export { PackageStatusMessage }

export type TimelinePersistentState = unknown

export interface ShowStyleBlueprintManifest<
	TRawConfig = IBlueprintConfig,
	TProcessedConfig = unknown,
> extends BlueprintManifestBase {
	blueprintType: BlueprintManifestType.SHOWSTYLE

	/** A list of config items this blueprint expects to be available on the ShowStyle */
	showStyleConfigSchema: JSONBlob<JSONSchema>

	/** The config presets exposed by this blueprint */
	configPresets: Record<string, IShowStyleConfigPreset<TRawConfig>>

	/** Alternate package status messages, to override the builtin ones produced by Sofie */
	packageStatusMessages?: Partial<Record<PackageStatusMessage, string | undefined>>

	/** Translations connected to the studio (as stringified JSON) */
	translations?: string

	// --------------------------------------------------------------
	// Callbacks called by Core:

	/** Returns the id of the show style variant to use for a rundown, return null to ignore that rundown */
	getShowStyleVariantId: (
		context: IStudioUserContext,
		showStyleVariants: ReadonlyDeep<Array<IBlueprintShowStyleVariant>>,
		ingestRundown: ExtendedIngestRundown
	) => string | null

	/** Generate rundown from ingest data. return null to ignore that rundown */
	getRundown: (
		context: IGetRundownContext,
		ingestRundown: ExtendedIngestRundown
	) => BlueprintResultRundown | null | Promise<BlueprintResultRundown | null>

	/** Generate segment from ingest data */
	getSegment: (
		context: ISegmentUserContext,
		ingestSegment: SofieIngestSegment
	) => BlueprintResultSegment | Promise<BlueprintResultSegment>

	/**
	 * Generate an Adlib Testing IngestRundown for the specified ShowStyleVariant.
	 * This is used to generate a rundown which can be used for testing adlibs, or minimal use of Sofie without a rundown from an NRCS.
	 */
	generateAdlibTestingIngestRundown?: (
		context: IShowStyleUserContext,
		showStyleVariant: IBlueprintShowStyleVariant
	) => IngestRundown | Promise<IngestRundown>

	/**
	 * Allows the blueprint to custom-modify the PartInstance, on ingest data update (this is run after getSegment())
	 *
	 * `playStatus: previous` means that the currentPartInstance is `orphaned: adlib-part` and thus possibly depends on an already past PartInstance for some of it's properties. Therefore the blueprint is allowed to modify the most recently played non-adlibbed PartInstance using ingested data.
	 *
	 * `newData.part` will be `undefined` when the PartInstance is orphaned. Generally, it's useful to differentiate the behavior of the implementation of this function based on `existingPartInstance.partInstance.orphaned` state
	 */
	syncIngestUpdateToPartInstance?: (
		context: ISyncIngestUpdateToPartInstanceContext,
		existingPartInstance: BlueprintSyncIngestPartInstance,
		newData: BlueprintSyncIngestNewData,
		playoutStatus: 'previous' | 'current' | 'next'
	) => void

	/**
	 * Execute an action defined by an IBlueprintActionManifest.
	 *
	 * This callback allows an action to perform operations only on the Timeline Datastore. This allows for a _fast-path_ for rapid-fire actions, before the full `executeAction` callback resolves. For more information on how to use this callback, see "Timeline Datastore" in Sofie TV Automation Documentation for Blueprint Developers.
	 */
	executeDataStoreAction?: (
		context: IDataStoreActionExecutionContext,
		actionId: string,
		userData: ActionUserData,
		triggerMode?: string
	) => Promise<void>

	/** Execute an action defined by an IBlueprintActionManifest */
	executeAction?: (
		context: IActionExecutionContext,
		playoutPersistentState: BlueprintPlayoutPersistentStore<TimelinePersistentState>,
		actionId: string,
		userData: ActionUserData,
		triggerMode: string | undefined,
		privateData: unknown | undefined,
		publicData: unknown | undefined,
		actionOptions: { [key: string]: any } | undefined
	) => Promise<void>

	/** Generate adlib piece from ingest data */
	getAdlibItem?: (
		context: IShowStyleUserContext,
		ingestItem: IngestAdlib
	) =>
		| Promise<IBlueprintAdLibPiece | IBlueprintActionManifest | null>
		| IBlueprintAdLibPiece
		| IBlueprintActionManifest
		| null

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
	applyConfig?: (context: ICommonContext, config: TRawConfig) => BlueprintResultApplyShowStyleConfig

	/** Preprocess config before storing it by core to later be returned by context's getShowStyleConfig. If not provided, getShowStyleConfig will return unprocessed blueprint config */
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

	/**
	 * Optional method to transform from an API blueprint config to the database blueprint config if these are required to be different.
	 * If this method is not defined the config object will be used directly
	 */
	blueprintConfigFromAPI?: (context: ICommonContext, config: object) => TRawConfig

	/**
	 * Optional method to transform from a database blueprint config to the API blueprint config if these are required to be different.
	 * If this method is not defined the config object will be used directly
	 */
	blueprintConfigToAPI?: (context: ICommonContext, config: TRawConfig) => object

	// Events

	/**
	 * Called at the final stage of RundownPlaylist activation, before the updated timeline is submitted to the Playout Gateway,
	 * This is a good place to prepare any external systems for the rundown going live.
	 */
	onRundownActivate?: (context: IRundownActivationContext) => Promise<void>
	/** Called upon the first take in a RundownPlaylist */
	onRundownFirstTake?: (context: IPartEventContext) => Promise<void>
	/**
	 * Called at the final stage of RundownPlaylist deactivation, before the updated timeline is submitted to the Playout Gateway,
	 * This is a good place to prepare any external systems for the rundown going offline.
	 */
	onRundownDeActivate?: (context: IRundownActivationContext) => Promise<void>

	/** Called before a Take action */
	onPreTake?: (context: IPartEventContext) => Promise<void>
	/**
	 * Called during a Take action.
	 * Allows for part modification or aborting the take.
	 */
	onTake?: (
		context: IOnTakeContext,
		playoutPersistentState: BlueprintPlayoutPersistentStore<TimelinePersistentState>
	) => Promise<void>
	/** Called after a Take action */
	onPostTake?: (context: IPartEventContext) => Promise<void>

	/**
	 * Called when a part is set as Next, including right after a Take.
	 * Allows for part modification.
	 */
	onSetAsNext?: (
		context: IOnSetAsNextContext,
		playoutPersistentState: BlueprintPlayoutPersistentStore<TimelinePersistentState>
	) => Promise<void>

	/** Called after the timeline has been generated, used to manipulate the timeline */
	onTimelineGenerate?: (
		context: ITimelineEventContext,
		timeline: OnGenerateTimelineObj<TSR.TSRTimelineContent>[],
		playoutPersistentState: BlueprintPlayoutPersistentStore<TimelinePersistentState>,
		previousPartEndState: PartEndState | undefined,
		resolvedPieces: IBlueprintResolvedPieceInstance[]
	) => Promise<BlueprintResultTimeline>

	/** Called just before `onTimelineGenerate` to perform AB-playback for the timeline */
	getAbResolverConfiguration?: (context: IShowStyleContext) => ABResolverConfiguration

	/** Called just before taking the next part. This generates some persisted data used by onTimelineGenerate to modify the timeline based on the previous part (eg, persist audio levels) */
	getEndStateForPart?: (
		context: IRundownContext,
		playoutPersistentState: BlueprintPlayoutPersistentStore<TimelinePersistentState>,
		partInstance: IBlueprintPartInstance,
		resolvedPieces: IBlueprintResolvedPieceInstance[],
		time: number
	) => PartEndState

	/** Called when the Rundown data changes, to be able to update any queued external messages */
	onRundownDataChangedEvent?: (
		context: IRundownDataChangedEventContext
	) => Promise<IBlueprintExternalMessageQueueObj[]>

	/**
	 * Called when the timing for a PartInstance or its content changes.
	 * This will often be batched (via a short debounce), but is called for each part when either the part or a piece timing changes.
	 */
	onRundownTimingEvent?: (context: IRundownTimingEventContext) => Promise<IBlueprintExternalMessageQueueObj[]>
}

export interface BlueprintResultTimeline {
	timeline: OnGenerateTimelineObj<TSR.TSRTimelineContent>[]
}
export interface BlueprintResultBaseline {
	timelineObjects: TimelineObjectCoreExt<TSR.TSRTimelineContent>[]
	expectedPlayoutItems?: ExpectedPlayoutItemGeneric[]
	expectedPackages?: ExpectedPackage.Any[]
}
export interface BlueprintResultRundown {
	rundown: IBlueprintRundown
	globalAdLibPieces: IBlueprintAdLibPiece[]
	globalActions: IBlueprintActionManifest[]
	globalPieces?: IBlueprintRundownPiece[]
	baseline: BlueprintResultBaseline
}
export interface BlueprintResultSegment {
	segment: IBlueprintSegment
	parts: BlueprintResultPart[]
}

export interface BlueprintResultPart {
	part: IBlueprintPart
	pieces: IBlueprintPiece[]
	adLibPieces: IBlueprintAdLibPiece[]
	actions: IBlueprintActionManifest[]
}

export interface BlueprintSyncIngestNewData {
	// source: BlueprintSyncIngestDataSource
	/** The new part */
	part: IBlueprintPartDB | undefined
	/** A list of pieces (including infinites) that would be present in a fresh copy of this partInstance */
	pieceInstances: IBlueprintPieceInstance[]
	/** The adlib pieces belonging to this part */
	adLibPieces: IBlueprintAdLibPieceDB[]
	/** The adlib actions belonging to this part */
	actions: IBlueprintActionManifest[]
	/** A list of adlibs that have pieceInstances in the partInstance in question */
	referencedAdlibs: IBlueprintAdLibPieceDB[]
	/**
	 * The list of pieces which belong to the Rundown, and may be active
	 * Note: Some of these may have played and been stopped before the current PartInstance
	 */
	rundownPieces: IBlueprintRundownPieceDB[]
}

// TODO: add something like this later?
// export enum BlueprintSyncIngestDataSource {
// 	/** The data update came from the same segment */
// 	SEGMENT = 'segment',
// 	/** The data update came from another infinite being updated */
// 	INFINITE = 'infinite',
// 	ADLIB = 'adlib',
// 	UNKNOWN = 'unknown'
// }

export interface BlueprintSyncIngestPartInstance {
	partInstance: IBlueprintPartInstance
	pieceInstances: IBlueprintPieceInstance[]
	// Upcoming interface:
	// adLibPieceInstances: IBlueprintAdlibPieceInstance[]
	// adLibActionInstances: IBlueprintAdlibActionInstance[]
}

export interface BlueprintResultApplyShowStyleConfig {
	sourceLayers: ISourceLayer[]
	outputLayers: IOutputLayer[]

	triggeredActions: IBlueprintTriggeredActions[]

	/** Configuration for displaying AB resolver channel assignments */
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
}

export interface IShowStyleConfigPreset<TConfig = IBlueprintConfig> {
	name: string

	config: TConfig

	variants: Record<string, IShowStyleVariantConfigPreset<TConfig>>
}

export interface IShowStyleVariantConfigPreset<TConfig = IBlueprintConfig> {
	name: string

	config: Partial<TConfig>
}
