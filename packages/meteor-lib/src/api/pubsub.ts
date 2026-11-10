import type {
	BucketId,
	PeripheralDeviceId,
	RundownPlaylistId,
	ShowStyleBaseId,
	StudioId,
} from '@sofie-automation/corelib/dist/dataModel/Ids.js'
import type { Bucket } from '@sofie-automation/corelib/dist/dataModel/Bucket.js'
import type { ICoreSystem } from '../collections/CoreSystem.js'
import type { Evaluation } from '../collections/Evaluations.js'
import type { ExpectedPlayoutItem } from '@sofie-automation/corelib/dist/dataModel/ExpectedPlayoutItem.js'
import type { RundownLayoutBase } from '../collections/RundownLayouts.js'
import type { SnapshotItem } from '../collections/Snapshots.js'
import type { TranslationsBundle } from '../collections/TranslationsBundles.js'
import type { DBTriggeredActions, UITriggeredActionsObj } from '../collections/TriggeredActions.js'
import type { UserActionsLogItem } from '../collections/UserActionsLog.js'
import type { UIBucketContentStatus, UISegmentPartNote } from './rundownNotifications.js'
import type { UIDeviceTriggerPreview } from './MountedTriggers.js'
import type { UIBlueprintUpgradeStatus } from './upgradeStatus.js'
import {
	PeripheralDevicePubSub,
	type PeripheralDevicePubSubTypes,
	type PeripheralDevicePubSubCollections,
	type PeripheralDevicePubSubCollectionsNames,
} from '@sofie-automation/shared-lib/dist/pubsub/peripheralDevice'
import {
	CorelibPubSub,
	type CorelibPubSubCollections,
	type CorelibPubSubTypes,
} from '@sofie-automation/corelib/dist/pubsub.js'
import type { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections.js'
import type { UIShowStyleBase } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase.js'
import type { UIStudio } from '@sofie-automation/corelib/dist/dataModel/Studio.js'

/**
 * Ids of possible DDP subscriptions for the UI only
 */
export enum MeteorPubSub {
	/**
	 * Fetch the CoreSystem document
	 */
	coreSystem = 'coreSystem',
	/**
	 * Fetch all User Evaluations for the specified time range
	 */
	evaluations = 'evaluations',

	/**
	 * Fetch RundownPlaylists for the specified Studio, limited to either active or inactive playlists
	 */
	rundownPlaylistForStudio = 'rundownPlaylistForStudio',

	/**
	 * Fetch either all TriggeredActions or limited to the specified ShowStyleBases
	 */
	triggeredActions = 'triggeredActions',
	/**
	 * Fetch all the Snapshots in the system
	 */
	snapshots = 'snapshots',
	/**
	 * Fetch all User Action Log entries for the specified time range
	 */
	userActionsLog = 'userActionsLog',
	/**
	 * Fetch either all RundownLayouts or limited to the specified ShowStyleBases
	 */
	rundownLayouts = 'rundownLayouts',
	/**
	 * Fetch all translation bundles
	 */
	translationsBundles = 'translationsBundles',

	// custom publications:

	/**
	 * Fetch the simplified timeline mappings for a given studio
	 */
	mappingsForStudio = 'mappingsForStudio',
	/**
	 * Fetch the simplified timeline for a given studio
	 */
	timelineForStudio = 'timelineForStudio',

	/**
	 * Ingest status of rundowns for a PeripheralDevice
	 */
	ingestDeviceRundownStatusTestTool = 'ingestDeviceRundownStatusTestTool',

	/**
	 * Fetch the simplified playout UI view of the specified ShowStyleBase
	 */
	uiShowStyleBase = 'uiShowStyleBase',
	/**
	 * Fetch the simplified playout UI view of the specified Studio.
	 * If the id is null, all studios will be returned
	 */
	uiStudio = 'uiStudio',
	/**
	 * Fetch the simplified playout UI view of the TriggeredActions in the specified ShowStyleBase.
	 * If the id is null, only global TriggeredActions will be returned
	 */
	uiTriggeredActions = 'uiTriggeredActions',

	/**
	 * Fetch the calculated trigger previews for the given Studio
	 */
	deviceTriggersPreview = 'deviceTriggersPreview',

	/**
	 * Fetch the Segment and Part notes in the given RundownPlaylist
	 * If the id is null, nothing will be returned
	 */
	uiSegmentPartNotes = 'uiSegmentPartNotes',
	/**
	 * Fetch the Pieces content-status in the given Bucket
	 */
	uiBucketContentStatuses = 'uiBucketContentStatuses',
	/**
	 * Fetch the Upgrade Statuses of all Blueprints in the system
	 */
	uiBlueprintUpgradeStatuses = 'uiBlueprintUpgradeStatuses',
}

/**
 * Names of all the known DDP publications
 */
export const AllPubSubNames: string[] = [
	...Object.values<string>(MeteorPubSub),
	...Object.values<string>(CorelibPubSub),
	...Object.values<string>(PeripheralDevicePubSub),
]

/**
 * Type definitions for all DDP subscriptions.
 * All the PubSub ids must be present here, or they will produce type errors when used
 */
export type AllPubSubTypes = CorelibPubSubTypes & PeripheralDevicePubSubTypes & MeteorPubSubTypes

export interface MeteorPubSubTypes {
	[MeteorPubSub.coreSystem]: (token?: string) => CollectionName.CoreSystem
	[MeteorPubSub.evaluations]: (dateFrom: number, dateTo: number, token?: string) => CollectionName.Evaluations

	[MeteorPubSub.rundownPlaylistForStudio]: (studioId: StudioId, isActive: boolean) => CollectionName.RundownPlaylists

	[MeteorPubSub.triggeredActions]: (
		/** ShowStyleBaseIds to fetch for, or null to just fetch global */
		showStyleBaseIds: ShowStyleBaseId[] | null,
		token?: string
	) => CollectionName.TriggeredActions
	[MeteorPubSub.snapshots]: (token?: string) => CollectionName.Snapshots
	[MeteorPubSub.userActionsLog]: (dateFrom: number, dateTo: number, token?: string) => CollectionName.UserActionsLog
	[MeteorPubSub.rundownLayouts]: (
		/** ShowStyleBaseIds to fetch for, or null to fetch all */
		showStyleBaseIds: ShowStyleBaseId[] | null,
		token?: string
	) => CollectionName.RundownLayouts
	[MeteorPubSub.translationsBundles]: (token?: string) => CollectionName.TranslationsBundles

	// custom publications:

	[MeteorPubSub.mappingsForStudio]: () => PeripheralDevicePubSubCollectionsNames.studioMappings
	[MeteorPubSub.timelineForStudio]: () => PeripheralDevicePubSubCollectionsNames.studioTimeline

	[MeteorPubSub.ingestDeviceRundownStatusTestTool]: (
		peripheralDeviceId: PeripheralDeviceId
	) => PeripheralDevicePubSubCollectionsNames.ingestRundownStatus

	[MeteorPubSub.uiShowStyleBase]: (showStyleBaseId: ShowStyleBaseId) => CustomCollectionName.UIShowStyleBase
	/** Subscribe to one or all studios */
	[MeteorPubSub.uiStudio]: (studioId: StudioId | null) => CustomCollectionName.UIStudio
	[MeteorPubSub.uiTriggeredActions]: (
		showStyleBaseId: ShowStyleBaseId | null
	) => CustomCollectionName.UITriggeredActions

	[MeteorPubSub.deviceTriggersPreview]: (
		studioId: StudioId,
		token?: string
	) => CustomCollectionName.UIDeviceTriggerPreviews

	/** Custom publications for the UI */
	[MeteorPubSub.uiSegmentPartNotes]: (playlistId: RundownPlaylistId | null) => CustomCollectionName.UISegmentPartNotes
	[MeteorPubSub.uiBucketContentStatuses]: (
		studioId: StudioId,
		bucketId: BucketId
	) => CustomCollectionName.UIBucketContentStatuses
	[MeteorPubSub.uiBlueprintUpgradeStatuses]: () => CustomCollectionName.UIBlueprintUpgradeStatuses
}

export type AllPubSubCollections = PeripheralDevicePubSubCollections &
	CorelibPubSubCollections &
	MeteorPubSubCollections

/**
 * Ids of possible Custom collections, populated by DDP subscriptions
 */
export enum CustomCollectionName {
	UIShowStyleBase = 'uiShowStyleBase',
	UIStudio = 'uiStudio',
	UITriggeredActions = 'uiTriggeredActions',
	UIDeviceTriggerPreviews = 'deviceTriggerPreviews',
	UISegmentPartNotes = 'uiSegmentPartNotes',
	UIBucketContentStatuses = 'uiBucketContentStatuses',
	UIBlueprintUpgradeStatuses = 'uiBlueprintUpgradeStatuses',
}

export type MeteorPubSubCollections = {
	[CollectionName.CoreSystem]: ICoreSystem
	[CollectionName.Evaluations]: Evaluation
	[CollectionName.TriggeredActions]: DBTriggeredActions
	[CollectionName.Snapshots]: SnapshotItem
	[CollectionName.UserActionsLog]: UserActionsLogItem
	[CollectionName.RundownLayouts]: RundownLayoutBase
	[CollectionName.Buckets]: Bucket
	[CollectionName.TranslationsBundles]: TranslationsBundle
	[CollectionName.ExpectedPlayoutItems]: ExpectedPlayoutItem
} & MeteorPubSubCustomCollections

export type MeteorPubSubCustomCollections = {
	[CustomCollectionName.UIShowStyleBase]: UIShowStyleBase
	[CustomCollectionName.UIStudio]: UIStudio
	[CustomCollectionName.UITriggeredActions]: UITriggeredActionsObj
	[CustomCollectionName.UIDeviceTriggerPreviews]: UIDeviceTriggerPreview
	[CustomCollectionName.UISegmentPartNotes]: UISegmentPartNote
	[CustomCollectionName.UIBucketContentStatuses]: UIBucketContentStatus
	[CustomCollectionName.UIBlueprintUpgradeStatuses]: UIBlueprintUpgradeStatus
}
