import { ExpectedPackageId, PackageContainerPackageId, StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { PackageContainerPackageStatusDB } from '@sofie-automation/corelib/dist/dataModel/PackageContainerPackageStatus'
import { PackageInfoDB } from '@sofie-automation/corelib/dist/dataModel/PackageInfos'
import { MongoFieldSpecifierOnesStrict } from '@sofie-automation/corelib/dist/mongo'
import { ProtectedString } from '@sofie-automation/corelib/dist/protectedString'
import { applyAndValidateOverrides } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { MediaObject } from '@sofie-automation/shared-lib/dist/core/model/MediaObjects'
import { ReadonlyDeep } from 'type-fest'
import { DBStudio } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { Studios } from '../../collections'
import { PieceContentStatusStudio } from './checkPieceContentStatus'

export type StudioFields =
	| '_id'
	| 'settingsWithOverrides'
	| 'packageContainersWithOverrides'
	| 'previewContainerIds'
	| 'thumbnailContainerIds'
	| 'mappingsWithOverrides'
	| 'routeSetsWithOverrides'
export const studioFieldSpecifier = literal<MongoFieldSpecifierOnesStrict<Pick<DBStudio, StudioFields>>>({
	_id: 1,
	settingsWithOverrides: 1,
	packageContainersWithOverrides: 1,
	previewContainerIds: 1,
	thumbnailContainerIds: 1,
	mappingsWithOverrides: 1,
	routeSetsWithOverrides: 1,
})

export type PackageContainerPackageStatusLight = Pick<PackageContainerPackageStatusDB, '_id' | 'studioId' | 'status'>
export const packageContainerPackageStatusesFieldSpecifier = literal<
	MongoFieldSpecifierOnesStrict<PackageContainerPackageStatusLight>
>({
	_id: 1,
	studioId: 1,
	status: 1,
})

export type PackageInfoLight = Pick<PackageInfoDB, '_id' | 'studioId' | 'packageId' | 'type' | 'payload'>
export const packageInfoFieldSpecifier = literal<MongoFieldSpecifierOnesStrict<PackageInfoLight>>({
	_id: 1,
	studioId: 1,
	packageId: 1,
	type: 1,
	payload: 1,
})

export type MediaObjectLight = Pick<MediaObject, '_id' | 'studioId' | 'mediaId' | 'mediainfo' | 'previewPath'>
export const mediaObjectFieldSpecifier = literal<MongoFieldSpecifierOnesStrict<MediaObjectLight>>({
	_id: 1,
	studioId: 1,
	mediaId: 1,
	mediainfo: 1,
	previewPath: 1,
})

export interface IContentStatusesUpdatePropsBase {
	invalidateAll: boolean
	invalidateStudio: StudioId

	invalidateMediaObjectMediaId: string[]
	invalidateExpectedPackageId: ExpectedPackageId[]
	invalidatePackageContainerPackageStatusesId: PackageContainerPackageId[]
}

export interface PieceDependencies {
	mediaObjects: string[]
	packageInfos: ExpectedPackageId[]
	packageContainerPackageStatuses: PackageContainerPackageId[]
}

export function addItemsWithDependenciesChangesToChangedSet<T extends ProtectedString<any>>(
	updateProps: Partial<ReadonlyDeep<IContentStatusesUpdatePropsBase>> | undefined,
	regeneratePieceIds: Set<T>,
	dependenciesMap: Map<T, PieceDependencies>
): void {
	if (
		updateProps &&
		(updateProps.invalidateExpectedPackageId?.length ||
			updateProps.invalidateMediaObjectMediaId?.length ||
			updateProps.invalidatePackageContainerPackageStatusesId?.length)
	) {
		const changedMediaObjects = new Set(updateProps.invalidateMediaObjectMediaId)
		const changedExpectedPackages = new Set(updateProps.invalidateExpectedPackageId)
		const changedPackageContainerPackages = new Set(updateProps.invalidatePackageContainerPackageStatusesId)

		for (const [pieceId, pieceDependencies] of dependenciesMap.entries()) {
			if (regeneratePieceIds.has(pieceId)) continue // skip if we already know the piece has changed

			const pieceChanged =
				pieceDependencies.mediaObjects.find((mediaId) => changedMediaObjects.has(mediaId)) ||
				pieceDependencies.packageInfos.find((pkgId) => changedExpectedPackages.has(pkgId)) ||
				pieceDependencies.packageContainerPackageStatuses.find((pkgId) =>
					changedPackageContainerPackages.has(pkgId)
				)

			if (pieceChanged) regeneratePieceIds.add(pieceId)
		}
	}
}

export async function fetchStudio(studioId: StudioId): Promise<PieceContentStatusStudio | undefined> {
	const studio = (await Studios.findOneAsync(studioId, {
		projection: studioFieldSpecifier,
	})) as Pick<DBStudio, StudioFields> | undefined

	if (!studio) {
		return undefined
	}

	return {
		_id: studio._id,
		settings: applyAndValidateOverrides(studio.settingsWithOverrides).obj,
		previewContainerIds: studio.previewContainerIds,
		thumbnailContainerIds: studio.thumbnailContainerIds,
		mappings: applyAndValidateOverrides(studio.mappingsWithOverrides).obj,
		routeSets: applyAndValidateOverrides(studio.routeSetsWithOverrides).obj,
		packageContainers: applyAndValidateOverrides(studio.packageContainersWithOverrides).obj,
	}
}
