import type { IBlueprintSegmentRundown } from '../documents'
import type { IUserNotesContext } from './baseContext'
import type { IPackageInfoContext } from './packageInfoContext'
import type { IShowStyleContext } from './showStyleContext'
import type { IExecuteTSRActionsContext } from './executeTsrActionContext'
import type { IDataStoreMethods } from './adlibActionContext'

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
