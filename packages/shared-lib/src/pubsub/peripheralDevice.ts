import { PeripheralDeviceForDevice } from '../core/model/peripheralDevice.js'
import { RoutedMappings, RoutedTimeline } from '../core/model/Timeline.js'
import { DBTimelineDatastoreEntry } from '../core/model/TimelineDatastore.js'
import {
	PackageManagerPlayoutContext,
	PackageManagerPackageContainers,
	PackageManagerExpectedPackage,
} from '../package-manager/publications.js'
import { PeripheralDeviceId, RundownId, RundownPlaylistId } from '../core/model/Ids.js'
import { ProtectedString } from '../lib/protectedString.js'
import { PeripheralDeviceCommand } from '../core/model/PeripheralDeviceCommand.js'
import { ExpectedPlayoutItemPeripheralDevice } from '../expectedPlayoutItem.js'
import { DeviceTriggerMountedAction, PreviewWrappedAdLib } from '../input-gateway/deviceTriggerPreviews.js'
import { IngestRundownStatus } from '../ingest/rundownStatus.js'
import type {
	PeripheralDeviceExternalEvent,
	PeripheralDeviceExternalEventSubscription,
} from '../peripheralDevice/externalEvents.js'

/**
 * Ids of possible DDP subscriptions for any PeripheralDevice.
 */
export enum PeripheralDevicePubSub {
	// Common:

	/** Commands for the PeripheralDevice to execute */
	peripheralDeviceCommands = 'peripheralDeviceCommands',
	/** Properties/settings of the PeripheralDevice */
	peripheralDeviceForDevice = 'peripheralDeviceForDevice',

	// Playout gateway:

	/** Playout gateway: Rundowns in the Studio of the PeripheralDevice */
	rundownsForDevice = 'rundownsForDevice',

	/** Playout gateway: Simplified timeline mappings in the Studio of the PeripheralDevice */
	mappingsForDevice = 'mappingsForDevice',
	/** Playout gateway: Simplified timeline in the Studio of the PeripheralDevice */
	timelineForDevice = 'timelineForDevice',
	/** Playout gateway: Timeline datastore entries in the Studio of the PeripheralDevice */
	timelineDatastoreForDevice = 'timelineDatastoreForDevice',
	/** Playout gateway: ExpectedPlayoutItems in the Studio of the PeripheralDevice */
	expectedPlayoutItemsForDevice = 'expectedPlayoutItemsForDevice',

	// Input gateway:

	/** Input gateway: Calculated triggered actions */
	mountedTriggersForDevice = 'mountedTriggersForDevice',
	/** Input gateway: Calculated trigger previews */
	mountedTriggersForDevicePreview = 'mountedTriggersForDevicePreview',

	// Package manager:

	/** Package manager: Info about the active playlist in the Studio of the PeripheralDevice */
	packageManagerPlayoutContext = 'packageManagerPlayoutContext',
	/** Package manager: The package containers in the Studio of the PeripheralDevice */
	packageManagerPackageContainers = 'packageManagerPackageContainers',
	/** Package manager: The expected packages in the Studio of the PeripheralDevice */
	packageManagerExpectedPackages = 'packageManagerExpectedPackages',

	// Ingest gateway:

	/**
	 * Ingest status of rundowns for a PeripheralDevice
	 */
	ingestDeviceRundownStatus = 'ingestDeviceRundownStatus',

	// Playout gateway (external event subscriptions):

	/** External event subscriptions from blueprints for the Studio */
	externalEventSubscriptionsForDevice = 'externalEventSubscriptionsForDevice',
}

/**
 * Type definitions for DDP subscriptions to be used by any PeripheralDevice.
 */
export interface PeripheralDevicePubSubTypes {
	[PeripheralDevicePubSub.peripheralDeviceCommands]: (
		deviceId: PeripheralDeviceId,
		token?: string
	) => PeripheralDevicePubSubCollectionsNames.peripheralDeviceCommands

	// For a PeripheralDevice
	[PeripheralDevicePubSub.rundownsForDevice]: (
		deviceId: PeripheralDeviceId,
		token?: string
	) => PeripheralDevicePubSubCollectionsNames.rundowns

	// custom publications:
	[PeripheralDevicePubSub.peripheralDeviceForDevice]: (
		deviceId: PeripheralDeviceId,
		token?: string
	) => PeripheralDevicePubSubCollectionsNames.peripheralDeviceForDevice
	[PeripheralDevicePubSub.mappingsForDevice]: (
		deviceId: PeripheralDeviceId,
		token?: string
	) => PeripheralDevicePubSubCollectionsNames.studioMappings
	[PeripheralDevicePubSub.timelineForDevice]: (
		deviceId: PeripheralDeviceId,
		token?: string
	) => PeripheralDevicePubSubCollectionsNames.studioTimeline
	[PeripheralDevicePubSub.timelineDatastoreForDevice]: (
		deviceId: PeripheralDeviceId,
		token?: string
	) => PeripheralDevicePubSubCollectionsNames.timelineDatastore
	[PeripheralDevicePubSub.expectedPlayoutItemsForDevice]: (
		deviceId: PeripheralDeviceId,
		token?: string
	) => PeripheralDevicePubSubCollectionsNames.expectedPlayoutItems

	[PeripheralDevicePubSub.mountedTriggersForDevice]: (
		deviceId: PeripheralDeviceId,
		deviceIds: string[],
		token?: string
	) => PeripheralDevicePubSubCollectionsNames.mountedTriggers
	[PeripheralDevicePubSub.mountedTriggersForDevicePreview]: (
		deviceId: PeripheralDeviceId,
		token?: string
	) => PeripheralDevicePubSubCollectionsNames.mountedTriggersPreviews

	/** Custom publications for package-manager */
	[PeripheralDevicePubSub.packageManagerPlayoutContext]: (
		deviceId: PeripheralDeviceId,
		token?: string
	) => PeripheralDevicePubSubCollectionsNames.packageManagerPlayoutContext
	[PeripheralDevicePubSub.packageManagerPackageContainers]: (
		deviceId: PeripheralDeviceId,
		token?: string
	) => PeripheralDevicePubSubCollectionsNames.packageManagerPackageContainers
	[PeripheralDevicePubSub.packageManagerExpectedPackages]: (
		deviceId: PeripheralDeviceId,
		filterPlayoutDeviceIds: PeripheralDeviceId[] | undefined,
		token?: string
	) => PeripheralDevicePubSubCollectionsNames.packageManagerExpectedPackages

	[PeripheralDevicePubSub.ingestDeviceRundownStatus]: (
		deviceId: PeripheralDeviceId,
		token?: string
	) => PeripheralDevicePubSubCollectionsNames.ingestRundownStatus
	[PeripheralDevicePubSub.externalEventSubscriptionsForDevice]: (
		type: PeripheralDeviceExternalEvent['type'],
		deviceId: PeripheralDeviceId,
		token?: string
	) => PeripheralDevicePubSubCollectionsNames.externalEventSubscriptions
}

/** An individual external device event subscription, as published by the server for the playout gateway */
export type ExternalEventSubscriptionId = ProtectedString<'ExternalEventSubscriptionId'>
export type ExternalEventSubscriptionDocument = PeripheralDeviceExternalEventSubscription & {
	_id: ExternalEventSubscriptionId
}

export enum PeripheralDevicePubSubCollectionsNames {
	// Real Mongodb collections:
	peripheralDeviceCommands = 'peripheralDeviceCommands',
	rundowns = 'rundowns',
	expectedPlayoutItems = 'expectedPlayoutItems',
	timelineDatastore = 'timelineDatastore',

	// Custom collections:
	peripheralDeviceForDevice = 'peripheralDeviceForDevice',
	studioMappings = 'studioMappings',
	studioTimeline = 'studioTimeline',

	mountedTriggersPreviews = 'mountedTriggersPreviews',
	mountedTriggers = 'mountedTriggers',

	packageManagerPlayoutContext = 'packageManagerPlayoutContext',
	packageManagerPackageContainers = 'packageManagerPackageContainers',
	packageManagerExpectedPackages = 'packageManagerExpectedPackages',

	ingestRundownStatus = 'ingestRundownStatus',
	externalEventSubscriptions = 'externalEventSubscriptions',
}

export type PeripheralDevicePubSubCollections = {
	// Real Mongodb collections:
	[PeripheralDevicePubSubCollectionsNames.peripheralDeviceCommands]: PeripheralDeviceCommand
	[PeripheralDevicePubSubCollectionsNames.rundowns]: { _id: RundownId; playlistId: RundownPlaylistId }
	[PeripheralDevicePubSubCollectionsNames.expectedPlayoutItems]: ExpectedPlayoutItemPeripheralDevice
	[PeripheralDevicePubSubCollectionsNames.timelineDatastore]: DBTimelineDatastoreEntry

	// Custom collections:
	[PeripheralDevicePubSubCollectionsNames.peripheralDeviceForDevice]: PeripheralDeviceForDevice
	[PeripheralDevicePubSubCollectionsNames.studioMappings]: RoutedMappings
	[PeripheralDevicePubSubCollectionsNames.studioTimeline]: RoutedTimeline

	[PeripheralDevicePubSubCollectionsNames.mountedTriggersPreviews]: PreviewWrappedAdLib
	[PeripheralDevicePubSubCollectionsNames.mountedTriggers]: DeviceTriggerMountedAction

	[PeripheralDevicePubSubCollectionsNames.packageManagerPlayoutContext]: PackageManagerPlayoutContext
	[PeripheralDevicePubSubCollectionsNames.packageManagerPackageContainers]: PackageManagerPackageContainers
	[PeripheralDevicePubSubCollectionsNames.packageManagerExpectedPackages]: PackageManagerExpectedPackage

	[PeripheralDevicePubSubCollectionsNames.ingestRundownStatus]: IngestRundownStatus
	[PeripheralDevicePubSubCollectionsNames.externalEventSubscriptions]: ExternalEventSubscriptionDocument
}
