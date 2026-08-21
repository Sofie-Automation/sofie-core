import { MigrationStepCore } from '@sofie-automation/meteor-lib/dist/migrations'
import { RundownPlaylists } from '../../../collections'
import { SelectedPartInstance } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist/RundownPlaylist'

export class PreviousPartInfoToArrayMigrationStep implements Omit<MigrationStepCore, 'version'> {
	public readonly id = `RundownPlaylist convert previousPartInfo to previousPartsInfo`
	public readonly canBeRunAutomatically = true

	public async validate(): Promise<boolean | string> {
		const playlists = await this.findPlaylistsToMigrate()

		if (playlists.length) {
			return 'previousPartInfo must be converted to the previousPartsInfo array'
		}

		return false
	}

	public async migrate(): Promise<void> {
		const playlists = await this.findPlaylistsToMigrate()

		for (const playlist of playlists) {
			// @ts-expect-error previousPartInfo has been replaced by previousPartsInfo
			const oldPreviousPartInfo = playlist.previousPartInfo as SelectedPartInstance | null | undefined

			await RundownPlaylists.mutableCollection.updateAsync(playlist._id, {
				$set: playlist.previousPartsInfo
					? undefined
					: { previousPartsInfo: oldPreviousPartInfo ? [oldPreviousPartInfo] : [] },
				$unset: {
					previousPartInfo: 1,
				},
			})
		}
	}

	/** Playlists that are missing the array, plus already migrated ones still carrying the legacy field */
	private async findPlaylistsToMigrate() {
		return RundownPlaylists.findFetchAsync({
			$or: [{ previousPartsInfo: { $exists: false } }, { previousPartInfo: { $exists: true } }],
		})
	}
}
