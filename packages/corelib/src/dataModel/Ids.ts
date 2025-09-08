import { ProtectedString } from '../protectedString.js'

/** A string, identifying an activation of a playlist */
export type ActiveInstanceId = ProtectedString<'ActiveInstanceId'>
/** A string, identifying an activation of a playlist */
export type RundownPlaylistActivationId = ProtectedString<'RundownPlaylistActivationId'>

/** An id, representing the currently running instance of this process */
export type SystemInstanceId = ProtectedString<'SystemInstanceId'>

/** A string, identifying an AdLibActionId */
export type AdLibActionId = ProtectedString<'AdLibActionId'>

/** A string, identifying a Blueprint */
export type BlueprintId = ProtectedString<'BlueprintId'>

export type BucketId = ProtectedString<'BucketId'>
export type BucketAdLibId = ProtectedString<'BucketAdLibId'>
export type BucketAdLibActionId = ProtectedString<'BucketAdLibActionId'>

/** A string, identifying a CoreSystem */
export type CoreSystemId = ProtectedString<'CoreSystemId'>

/** A string, identifying a Evaluation */
export type EvaluationId = ProtectedString<'EvaluationId'>

/** A string, identifying a Rundown */
export type ExpectedPlayoutItemId = ProtectedString<'ExpectedPlayoutItemId'>

/** A string, identifying a ExternalMessageQueueObj */
export type ExternalMessageQueueObjId = ProtectedString<'ExternalMessageQueueObjId'>

/** A string, identifying a NrcsIngestDataCacheObj */
export type NrcsIngestDataCacheObjId = ProtectedString<'NrcsIngestDataCacheObjId'>

/** A string, identifying a SofieIngestDataCacheObj */
export type SofieIngestDataCacheObjId = ProtectedString<'SofieIngestDataCacheObjId'>

/** A string, identifying a DBNotificationObj */
export type NotificationId = ProtectedString<'NotificationId'>

/** A string, identifying a Organization */
export type OrganizationId = ProtectedString<'OrganizationId'>

export type PackageInfoId = ProtectedString<'PackageInfoId'>

/** Id of a package container */
export type PackageContainerId = ProtectedString<'PackageContainerId'>

/** Id of a package container */
export type PackageContainerPackageId = ProtectedString<'PackageContainerPackageId'>

export type SegmentPlayoutId = ProtectedString<'SegmentPlayoutId'>

export type PieceInstanceInfiniteId = ProtectedString<'PieceInstanceInfiniteId'>

/** A string, identifying a Piece */
export type PieceId = ProtectedString<'PieceId'>

/** A string, identifying an RundownBaselineAdLibActionId */
export type RundownBaselineAdLibActionId = ProtectedString<'RundownBaselineAdLibActionId'>

/** A string, identifying a RundownBaselineObj */
export type RundownBaselineObjId = ProtectedString<'RundownBaselineObjId'>

/** A string, identifying a RundownLayout */
export type RundownLayoutId = ProtectedString<'RundownLayoutId'>

/** A string, identifying a Segment */
export type SegmentId = ProtectedString<'SegmentId'>

/** A string, identifying a ShowStyleVariant */
export type ShowStyleVariantId = ProtectedString<'ShowStyleVariantId'>

/** A string, identifying a Snapshot */
export type SnapshotId = ProtectedString<'SnapshotId'>

/** A string, identifying a TimelineObj */
export type TimelineObjId = ProtectedString<'TimelineObjId'>

/** A string identifying a translations bundle */
export type TranslationsBundleId = ProtectedString<'TranslationsBundleId'>
export type TranslationsBundleOriginId = ProtectedString<'TranslationsBundleOriginId'>

/** A string, identifying a UserActionsLogItem */
export type UserActionsLogItemId = ProtectedString<'UserActionsLogItemId'>

/** A string, identifying a User */
export type UserId = ProtectedString<'UserId'>

/** A string, identifying a Worker (parent) */
export type WorkerId = ProtectedString<'WorkerId'>

/** A string, identifying a WorkerThread */
export type WorkerThreadId = ProtectedString<'WorkerThreadId'>

export * from '@sofie-automation/shared-lib/dist/core/model/Ids'
