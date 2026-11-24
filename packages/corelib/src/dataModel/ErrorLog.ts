import type { ErrorLogItemId, RundownPlaylistId, StudioId, UserActionsLogItemId, UserId } from './Ids.js'
import type { ITranslatableMessage } from '../TranslatableMessage.js'
import type { UserErrorMessage } from '../error.js'

/**
 * An error returned to a client (UI or REST API), kept so that all clients can see recent errors.
 * Only the newest N items are kept; older ones are removed on insert.
 */
export interface DBErrorLogItem {
	_id: ErrorLogItemId

	/** Unix timestamp of when the error was returned */
	timestamp: number

	/** Studio the operation targeted, or null for system-level operations */
	studioId: StudioId | null
	playlistId?: RundownPlaylistId

	/** Method name (UI) or "METHOD /route" (REST) */
	operation: string
	/** UI event ("click: button#take") or REST origin */
	context?: string

	userId: UserId | null
	/** Link to the full audit entry, when the operation was a logged user action */
	userActionsLogId?: UserActionsLogItemId

	/** HTTP-style status code from the UserError */
	errorCode: number
	error: {
		key: UserErrorMessage
		message: ITranslatableMessage
	}
}
