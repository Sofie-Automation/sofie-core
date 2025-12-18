import { PeripheralDevicePubSubCollectionsNames } from '@sofie-automation/shared-lib/dist/pubsub/peripheralDevice'
import { createSyncPeripheralDeviceCustomPublicationMongoCollection } from '../../collections/lib'

/**
 * These collections are not public and are for the use of the TestTools only.
 * They are defined in this file, as hot reloading them is not supported
 */

export const IngestRundownStatuses = createSyncPeripheralDeviceCustomPublicationMongoCollection(
	PeripheralDevicePubSubCollectionsNames.ingestRundownStatus
)

export const MountedTriggers = createSyncPeripheralDeviceCustomPublicationMongoCollection(
	PeripheralDevicePubSubCollectionsNames.mountedTriggers
)
export const MountedTriggersPreviews = createSyncPeripheralDeviceCustomPublicationMongoCollection(
	PeripheralDevicePubSubCollectionsNames.mountedTriggersPreviews
)

export const StudioMappings = createSyncPeripheralDeviceCustomPublicationMongoCollection(
	PeripheralDevicePubSubCollectionsNames.studioMappings
)

export const StudioTimeline = createSyncPeripheralDeviceCustomPublicationMongoCollection(
	PeripheralDevicePubSubCollectionsNames.studioTimeline
)

export const TimelineDatastore = createSyncPeripheralDeviceCustomPublicationMongoCollection(
	PeripheralDevicePubSubCollectionsNames.timelineDatastore
)
