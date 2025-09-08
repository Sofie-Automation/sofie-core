/**
 * This file contains or exports all of the 'client-side' mongo collections.
 * Note: This includes a re-export of some collections defined in `lib` which are used by `lib` code.
 * These are sync only and often read-only collections, for convenient use in client (minimongo) logic
 * where async is a burden and not a benefit.
 * The definitions must match the publications and server-collections (if applicable) that back them,
 * and will be stronger typed in the future.
 */

import { Blueprint } from '@sofie-automation/corelib/dist/dataModel/Blueprint'
import { BucketAdLibAction } from '@sofie-automation/corelib/dist/dataModel/BucketAdLibAction'
import { BucketAdLib } from '@sofie-automation/corelib/dist/dataModel/BucketAdLibPiece'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
import { ExpectedPackageWorkStatus } from '@sofie-automation/corelib/dist/dataModel/ExpectedPackageWorkStatuses'
import { ExternalMessageQueueObj } from '@sofie-automation/corelib/dist/dataModel/ExternalMessageQueue'
import { PackageContainerStatusDB } from '@sofie-automation/corelib/dist/dataModel/PackageContainerStatus'
import { Bucket } from '@sofie-automation/corelib/dist/dataModel/Bucket'
import { ICoreSystem, SYSTEM_ID } from '@sofie-automation/meteor-lib/dist/collections/CoreSystem'
import { Evaluation } from '@sofie-automation/meteor-lib/dist/collections/Evaluations'
import { ExpectedPackageDB } from '@sofie-automation/corelib/dist/dataModel/ExpectedPackages'
import { createSyncMongoCollection, createSyncReadOnlyMongoCollection } from './lib.js'
import { PeripheralDevice } from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'
import { RundownLayoutBase } from '@sofie-automation/meteor-lib/dist/collections/RundownLayouts'
import { DBShowStyleBase } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { DBShowStyleVariant } from '@sofie-automation/corelib/dist/dataModel/ShowStyleVariant'
import { SnapshotItem } from '@sofie-automation/meteor-lib/dist/collections/Snapshots'
import { DBStudio } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { TranslationsBundle } from '@sofie-automation/meteor-lib/dist/collections/TranslationsBundles'
import { DBTriggeredActions } from '@sofie-automation/meteor-lib/dist/collections/TriggeredActions'
import { UserActionsLogItem } from '@sofie-automation/meteor-lib/dist/collections/UserActionsLog'
import { AdLibAction } from '@sofie-automation/corelib/dist/dataModel/AdlibAction'
import { AdLibPiece } from '@sofie-automation/corelib/dist/dataModel/AdLibPiece'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { Piece } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { PieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { PartInstance } from '@sofie-automation/meteor-lib/dist/collections/PartInstances'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { RundownBaselineAdLibAction } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineAdLibAction'
import { RundownBaselineAdLibItem } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineAdLibPiece'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { DBNotificationObj } from '@sofie-automation/corelib/dist/dataModel/Notifications'

export const AdLibActions = createSyncReadOnlyMongoCollection<AdLibAction>(CollectionName.AdLibActions)

export const AdLibPieces = createSyncReadOnlyMongoCollection<AdLibPiece>(CollectionName.AdLibPieces)

export const Blueprints = createSyncMongoCollection<Blueprint>(CollectionName.Blueprints)

export const BucketAdLibActions = createSyncReadOnlyMongoCollection<BucketAdLibAction>(
	CollectionName.BucketAdLibActions
)

export const BucketAdLibs = createSyncReadOnlyMongoCollection<BucketAdLib>(CollectionName.BucketAdLibPieces)

export const Buckets = createSyncReadOnlyMongoCollection<Bucket>(CollectionName.Buckets)

export const CoreSystem = createSyncMongoCollection<ICoreSystem>(CollectionName.CoreSystem)

export const Evaluations = createSyncReadOnlyMongoCollection<Evaluation>(CollectionName.Evaluations)

export const ExpectedPackages = createSyncReadOnlyMongoCollection<ExpectedPackageDB>(CollectionName.ExpectedPackages)

export const ExpectedPackageWorkStatuses = createSyncReadOnlyMongoCollection<ExpectedPackageWorkStatus>(
	CollectionName.ExpectedPackageWorkStatuses
)

export const ExternalMessageQueue = createSyncReadOnlyMongoCollection<ExternalMessageQueueObj>(
	CollectionName.ExternalMessageQueue
)

export const Notifications = createSyncReadOnlyMongoCollection<DBNotificationObj>(CollectionName.Notifications)

export const PackageContainerStatuses = createSyncReadOnlyMongoCollection<PackageContainerStatusDB>(
	CollectionName.PackageContainerStatuses
)

export const PartInstances = createSyncReadOnlyMongoCollection<PartInstance>(CollectionName.PartInstances)

export const Parts = createSyncReadOnlyMongoCollection<DBPart>(CollectionName.Parts)

export const PeripheralDevices = createSyncMongoCollection<PeripheralDevice>(CollectionName.PeripheralDevices)

export const PieceInstances = createSyncReadOnlyMongoCollection<PieceInstance>(CollectionName.PieceInstances)

export const Pieces = createSyncReadOnlyMongoCollection<Piece>(CollectionName.Pieces)

export const RundownBaselineAdLibActions = createSyncReadOnlyMongoCollection<RundownBaselineAdLibAction>(
	CollectionName.RundownBaselineAdLibActions
)

export const RundownBaselineAdLibPieces = createSyncReadOnlyMongoCollection<RundownBaselineAdLibItem>(
	CollectionName.RundownBaselineAdLibPieces
)

export const RundownLayouts = createSyncMongoCollection<RundownLayoutBase>(CollectionName.RundownLayouts)

export const RundownPlaylists = createSyncReadOnlyMongoCollection<DBRundownPlaylist>(CollectionName.RundownPlaylists)

export const Rundowns = createSyncReadOnlyMongoCollection<DBRundown>(CollectionName.Rundowns)

export const Segments = createSyncReadOnlyMongoCollection<DBSegment>(CollectionName.Segments)

export const ShowStyleBases = createSyncMongoCollection<DBShowStyleBase>(CollectionName.ShowStyleBases)

export const ShowStyleVariants = createSyncMongoCollection<DBShowStyleVariant>(CollectionName.ShowStyleVariants)

export const Snapshots = createSyncMongoCollection<SnapshotItem>(CollectionName.Snapshots)

export const Studios = createSyncMongoCollection<DBStudio>(CollectionName.Studios)

export const TranslationsBundles = createSyncReadOnlyMongoCollection<TranslationsBundle>(
	CollectionName.TranslationsBundles
)

export const TriggeredActions = createSyncMongoCollection<DBTriggeredActions>(CollectionName.TriggeredActions)

export const UserActionsLog = createSyncReadOnlyMongoCollection<UserActionsLogItem>(CollectionName.UserActionsLog)

export function getCoreSystem(): ICoreSystem | undefined {
	return CoreSystem.findOne(SYSTEM_ID)
}
