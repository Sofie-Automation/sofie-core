import type { IBlueprintSegmentRundown } from '../documents/index.js'
import type { IUserNotesContext } from './baseContext.js'
import type { IPackageInfoContext } from './packageInfoContext.js'
import type { IShowStyleContext } from './showStyleContext.js'
import type { IExecuteTSRActionsContext } from './executeTsrActionContext.js'
import type { IDataStoreMethods } from './adlibActionContext.js'

export interface IRundownContext extends IShowStyleContext {
	readonly rundownId: string
	readonly playlistId: string
	readonly rundown: Readonly<IBlueprintSegmentRundown>
}

export interface IRundownUserContext extends IUserNotesContext, IRundownContext {}

export interface IRundownActivationContext extends IRundownContext, IExecuteTSRActionsContext, IDataStoreMethods {
	/** Info about the RundownPlaylist state before the Activation / Deactivation event */
	readonly previousState: IRundownActivationContextState
	readonly currentState: IRundownActivationContextState
}

export interface ISegmentUserContext extends IUserNotesContext, IRundownContext, IPackageInfoContext {
	/** Display a notification to the user of an error */
	notifyUserError: (message: string, params?: { [key: string]: any }, partExternalId?: string) => void
	/** Display a notification to the user of an warning */
	notifyUserWarning: (message: string, params?: { [key: string]: any }, partExternalId?: string) => void
	/** Display a notification to the user of a note */
	notifyUserInfo: (message: string, params?: { [key: string]: any }, partExternalId?: string) => void
}

/** Info about the RundownPlaylist state at a point in time */
export interface IRundownActivationContextState {
	/** If the playlist was active */
	active: boolean
	/** If the playlist was in rehearsal mode */
	rehearsal: boolean
	/** Timestamp when the playlist was last reset. Used to silence a few errors upon reset.*/
	resetTime?: number
}
