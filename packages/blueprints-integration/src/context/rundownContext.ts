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

export interface IRundownActivationContext extends IRundownContext, IExecuteTSRActionsContext, IDataStoreMethods {}

export interface ISegmentUserContext extends IUserNotesContext, IRundownContext, IPackageInfoContext {
	/** Display a notification to the user of an error */
	notifyUserError: (message: string, params?: { [key: string]: any }, partExternalId?: string) => void
	/** Display a notification to the user of an warning */
	notifyUserWarning: (message: string, params?: { [key: string]: any }, partExternalId?: string) => void
	/** Display a notification to the user of a note */
	notifyUserInfo: (message: string, params?: { [key: string]: any }, partExternalId?: string) => void
}
