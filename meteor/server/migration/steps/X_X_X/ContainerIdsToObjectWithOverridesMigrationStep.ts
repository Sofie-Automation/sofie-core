import { MigrationStepCore } from '@sofie-automation/blueprints-integration'
import { Studios } from '../../../collections'
import {
	convertObjectIntoOverrides,
	ObjectWithOverrides,
} from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
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

			const newPackageContainers = convertObjectIntoOverrides({
				previewContainerIds: oldPreviewContainerIds ?? [],
				thumbnailContainerIds: oldThumbnailContainerIds ?? [],
			} satisfies StudioPackageContainerSettings) as ObjectWithOverrides<StudioPackageContainerSettings>

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
