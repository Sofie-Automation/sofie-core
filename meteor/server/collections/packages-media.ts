import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
import { ExpectedPackageDB } from '@sofie-automation/corelib/dist/dataModel/ExpectedPackages'
import { ExpectedPackageWorkStatus } from '@sofie-automation/corelib/dist/dataModel/ExpectedPackageWorkStatuses'
import { ExpectedPlayoutItem } from '@sofie-automation/corelib/dist/dataModel/ExpectedPlayoutItem'
import { PackageContainerPackageStatusDB } from '@sofie-automation/corelib/dist/dataModel/PackageContainerPackageStatus'
import { PackageContainerStatusDB } from '@sofie-automation/corelib/dist/dataModel/PackageContainerStatus'
import { PackageInfoDB } from '@sofie-automation/corelib/dist/dataModel/PackageInfos'
import { MediaObject } from '@sofie-automation/shared-lib/dist/core/model/MediaObjects'
import { createAsyncOnlyMongoCollection, createAsyncOnlyReadOnlyMongoCollection } from './collection'
import { registerIndex } from './indices'

export const ExpectedPackages = createAsyncOnlyReadOnlyMongoCollection<ExpectedPackageDB>(
	CollectionName.ExpectedPackages
)
registerIndex(ExpectedPackages, {
	studioId: 1,
	fromPieceType: 1,
})
registerIndex(ExpectedPackages, {
	studioId: 1,
	pieceId: 1,
})
registerIndex(ExpectedPackages, {
	rundownId: 1,
	pieceId: 1,
})

export const ExpectedPackageWorkStatuses = createAsyncOnlyMongoCollection<ExpectedPackageWorkStatus>(
	CollectionName.ExpectedPackageWorkStatuses,
	false
)
registerIndex(ExpectedPackageWorkStatuses, {
	studioId: 1,
	// fromPackages: 1,
})
// registerIndex(ExpectedPackageWorkStatuses, {
// 	deviceId: 1,
// })

export const ExpectedPlayoutItems = createAsyncOnlyReadOnlyMongoCollection<ExpectedPlayoutItem>(
	CollectionName.ExpectedPlayoutItems
)
registerIndex(ExpectedPlayoutItems, {
	studioId: 1,
})
registerIndex(ExpectedPlayoutItems, {
	rundownId: 1,
})
registerIndex(ExpectedPlayoutItems, {
	studioId: 1,
	baseline: 1,
})

export const MediaObjects = createAsyncOnlyMongoCollection<MediaObject>(CollectionName.MediaObjects, false)
registerIndex(MediaObjects, {
	studioId: 1,
	collectionId: 1,
	objId: 1,
	mediaId: 1,
})
registerIndex(MediaObjects, {
	studioId: 1,
	mediaId: 1,
})

export const PackageContainerPackageStatuses = createAsyncOnlyMongoCollection<PackageContainerPackageStatusDB>(
	CollectionName.PackageContainerPackageStatuses,
	false
)
registerIndex(PackageContainerPackageStatuses, {
	studioId: 1,
	containerId: 1,
	packageId: 1,
})
registerIndex(PackageContainerPackageStatuses, {
	deviceId: 1,
})

export const PackageContainerStatuses = createAsyncOnlyMongoCollection<PackageContainerStatusDB>(
	CollectionName.PackageContainerStatuses,
	false
)
registerIndex(PackageContainerStatuses, {
	studioId: 1,
	containerId: 1,
})
registerIndex(PackageContainerStatuses, {
	deviceId: 1,
})

export const PackageInfos = createAsyncOnlyMongoCollection<PackageInfoDB>(CollectionName.PackageInfos, false)
registerIndex(PackageInfos, {
	studioId: 1,
	packageId: 1,
})
