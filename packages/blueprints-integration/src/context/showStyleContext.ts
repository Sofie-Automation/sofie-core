import type { IOutputLayer, ISourceLayer } from '../showStyle.js'
import type { IBlueprintRundownPlaylist } from '../documents/index.js'
import type { ICommonContext, IUserNotesContext } from './baseContext.js'
import type { IPackageInfoContext } from './packageInfoContext.js'
import type { IStudioContext } from './studioContext.js'

export interface IShowStyleContext extends ICommonContext, IStudioContext {
	/** Returns a ShowStyle blueprint config. If ShowStyleBlueprintManifest.preprocessConfig is provided, a config preprocessed by that function is returned, otherwise it is returned unprocessed */
	getShowStyleConfig: () => unknown
	/** Returns a reference to a showStyle config value, that can later be resolved in Core */
	getShowStyleConfigRef(configKey: string): string
	/** Get source layers for the ShowStyle  */
	getShowStyleSourceLayers(): Record<string, ISourceLayer | undefined>
	/** Get output layers for the ShowStyle  */
	getShowStyleOutputLayers(): Record<string, IOutputLayer | undefined>
}

export interface IShowStyleUserContext extends IUserNotesContext, IShowStyleContext, IPackageInfoContext {}

export interface IGetRundownContext extends IShowStyleUserContext {
	/** Returns a list of the Playlists in the studio */
	getPlaylists: () => Promise<Readonly<IBlueprintRundownPlaylist[]>>
	/** Returns the Playlist in which the Rundown currently is in. If it's a new Rundown, this will return undefined. */
	getCurrentPlaylist: () => Promise<Readonly<IBlueprintRundownPlaylist> | undefined>
	/** Returns a randomized string, intended to be used as ids. */
	getRandomId: () => string
}
