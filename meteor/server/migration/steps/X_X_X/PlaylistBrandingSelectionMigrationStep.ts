import { MigrationStepCore } from '@sofie-automation/meteor-lib/dist/migrations'
import { PartInstances, RundownPlaylists } from '../../../collections'

/**
 * Add the Branding selection to the RundownPlaylists, and to the PartInstances which are played with it.
 * `null` is a valid selection, so every document must have the property defined.
 */
export class PlaylistBrandingSelectionMigrationStep implements Omit<MigrationStepCore, 'version'> {
	public readonly id = `RundownPlaylist add branding selection`
	public readonly canBeRunAutomatically = true

	public async validate(): Promise<boolean | string> {
		const playlistCount = await RundownPlaylists.countDocuments(this.#playlistSelector)
		if (playlistCount > 0) return `${playlistCount} RundownPlaylists are missing the branding selection`

		const partInstanceCount = await PartInstances.countDocuments(this.#partInstanceSelector)
		if (partInstanceCount > 0) return `${partInstanceCount} PartInstances are missing the branding selection`

		return false
	}

	public async migrate(): Promise<void> {
		await RundownPlaylists.mutableCollection.updateAsync(
			this.#playlistSelector,
			{ $set: { defaultBrandingId: null } },
			{ multi: true }
		)

		await PartInstances.mutableCollection.updateAsync(
			this.#partInstanceSelector,
			{ $set: { brandingId: null } },
			{ multi: true }
		)
	}

	readonly #playlistSelector = { defaultBrandingId: { $exists: false } }
	readonly #partInstanceSelector = { brandingId: { $exists: false } }
}
