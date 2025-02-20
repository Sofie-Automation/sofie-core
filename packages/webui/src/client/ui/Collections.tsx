import { CustomCollectionName } from '@sofie-automation/meteor-lib/dist/api/pubsub'
import { CustomCollectionName as CustomCorelibCollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
import {
	createSyncCorelibCustomPublicationMongoCollection,
	createSyncCustomPublicationMongoCollection,
} from '../collections/lib'

/**
 * A playout UI version of ShowStyleBases.
 * This has been stripped back to only useful properties, with any ObjectWithOverrides<T> pre-flattened
 */
export const UIShowStyleBases = createSyncCustomPublicationMongoCollection(CustomCollectionName.UIShowStyleBase)

/**
 * A playout UI version of Studios.
 * This has been stripped back to only useful properties, with any ObjectWithOverrides<T> pre-flattened
 */
export const UIStudios = createSyncCustomPublicationMongoCollection(CustomCollectionName.UIStudio)

/**
 * A playout UI version of TriggeredActions.
 * This has been stripped back to only useful properties, with any ObjectWithOverrides<T> pre-flattened
 */
export const UITriggeredActions = createSyncCustomPublicationMongoCollection(CustomCollectionName.UITriggeredActions)

/**
 * A preview of the latest issued device triggers for a given Studio
 */
export const DeviceTriggersPreviews = createSyncCustomPublicationMongoCollection(
	CustomCollectionName.UIDeviceTriggerPreviews
)

/**
 * Pre-generated notes to be converted into notificiations.
 */
export const UISegmentPartNotes = createSyncCustomPublicationMongoCollection(CustomCollectionName.UISegmentPartNotes)

/**
 * Pre-processed MediaObjectIssue for Pieces in the Rundowns
 */
export const UIPieceContentStatuses = createSyncCorelibCustomPublicationMongoCollection(
	CustomCorelibCollectionName.UIPieceContentStatuses
)

/**
 * A playout UI version of Parts.
 */
export const UIParts = createSyncCustomPublicationMongoCollection(CustomCollectionName.UIParts)

/**
 * A playout UI version of PartInstances.
 */
export const UIPartInstances = createSyncCustomPublicationMongoCollection(CustomCollectionName.UIPartInstances)

/**
 * Pre-processed MediaObjectIssue for Adlibbs in a Bucket
 */
export const UIBucketContentStatuses = createSyncCustomPublicationMongoCollection(
	CustomCollectionName.UIBucketContentStatuses
)

/**
 * Pre-processed Blueprint Upgrade statuses
 */
export const UIBlueprintUpgradeStatuses = createSyncCustomPublicationMongoCollection(
	CustomCollectionName.UIBlueprintUpgradeStatuses
)
