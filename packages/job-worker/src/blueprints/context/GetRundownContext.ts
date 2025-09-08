import { IGetRundownContext, IBlueprintRundownPlaylist } from '@sofie-automation/blueprints-integration'
import { ReadonlyDeep } from 'type-fest'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { getRandomString } from '@sofie-automation/corelib/dist/lib'
import { Rundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { WatchedPackagesHelper } from './watchedPackages.js'
import { JobContext, ProcessedShowStyleCompound } from '../../jobs/index.js'
import { ReadonlyObjectDeep } from 'type-fest/source/readonly-deep'
import { ContextInfo } from './CommonContext.js'
import { ShowStyleUserContext } from './ShowStyleUserContext.js'
import { convertRundownPlaylistToBlueprints } from './lib.js'

export class GetRundownContext extends ShowStyleUserContext implements IGetRundownContext {
	private cachedPlaylistsInStudio: Promise<Readonly<IBlueprintRundownPlaylist>[]> | undefined

	constructor(
		contextInfo: ContextInfo,
		context: JobContext,
		showStyleCompound: ReadonlyDeep<ProcessedShowStyleCompound>,
		watchedPackages: WatchedPackagesHelper,
		private getPlaylistsInStudio: () => Promise<DBRundownPlaylist[]>,
		private getRundownsInStudio: () => Promise<Pick<Rundown, '_id' | 'playlistId'>[]>,
		private getExistingRundown: () => Promise<ReadonlyObjectDeep<Rundown> | undefined>
	) {
		super(contextInfo, context, showStyleCompound, watchedPackages)
	}
	private async _getPlaylistsInStudio() {
		if (!this.cachedPlaylistsInStudio) {
			this.cachedPlaylistsInStudio = Promise.resolve().then(async () => {
				const [rundownsInStudio, playlistsInStudio] = await Promise.all([
					this.getRundownsInStudio(),
					this.getPlaylistsInStudio(),
				])

				return playlistsInStudio.map((playlist) =>
					convertRundownPlaylistToBlueprints(playlist, rundownsInStudio)
				)
			})
		}
		return this.cachedPlaylistsInStudio
	}
	async getPlaylists(): Promise<Readonly<IBlueprintRundownPlaylist[]>> {
		return this._getPlaylistsInStudio()
	}
	async getCurrentPlaylist(): Promise<Readonly<IBlueprintRundownPlaylist | undefined>> {
		const existingRundown = await this.getExistingRundown()
		if (!existingRundown) return undefined

		const rundownPlaylistId = unprotectString(existingRundown.playlistId)

		const playlists = await this._getPlaylistsInStudio()
		return playlists.find((playlist) => playlist._id === rundownPlaylistId)
	}
	public getRandomId(): string {
		return getRandomString()
	}
}
