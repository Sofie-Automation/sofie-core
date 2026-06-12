import { MigrationStepCore } from '@sofie-automation/meteor-lib/dist/migrations'
import { Studios } from '../../../collections'
import { flatObjectToOverrides } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { StudioPackageContainerSettings } from '@sofie-automation/shared-lib/dist/core/model/PackageContainer'

export class ContainerIdsToObjectWithOverridesMigrationStep implements Omit<MigrationStepCore, 'version'> {
	public readonly id = `convert previewContainerIds to ObjectWithOverrides`
	public readonly canBeRunAutomatically = true

	public async validate(): Promise<boolean | string> {
		const studios = await this.findStudiosToMigrate()

		if (studios.length) {
			return 'previewContainerIds and thumbnailContainerIds must be converted to an ObjectWithOverrides'
		}

		return false
	}

	public async migrate(): Promise<void> {
		const studios = await this.findStudiosToMigrate()

		for (const studio of studios) {
			// @ts-expect-error previewContainerIds is typed as string[]
			const oldPreviewContainerIds = studio.previewContainerIds
			// @ts-expect-error thumbnailContainerIds is typed as string[]
			const oldThumbnailContainerIds = studio.thumbnailContainerIds

			const changedValues: Partial<StudioPackageContainerSettings> = {}
			if (oldPreviewContainerIds && oldPreviewContainerIds.length > 0) {
				changedValues.previewContainerIds = oldPreviewContainerIds
			}
			if (oldThumbnailContainerIds && oldThumbnailContainerIds.length > 0) {
				changedValues.thumbnailContainerIds = oldThumbnailContainerIds
			}

			const newPackageContainers = flatObjectToOverrides<StudioPackageContainerSettings>(
				{
					previewContainerIds: [],
					thumbnailContainerIds: [],
				},
				changedValues
			)

			await Studios.updateAsync(studio._id, {
				$set: {
					packageContainerSettingsWithOverrides: newPackageContainers,
				},
				$unset: {
					previewContainerIds: 1,
					thumbnailContainerIds: 1,
				},
			})
		}
	}

	private async findStudiosToMigrate() {
		return Studios.findFetchAsync({
			packageContainerSettingsWithOverrides: { $exists: false },
		})
	}
}
