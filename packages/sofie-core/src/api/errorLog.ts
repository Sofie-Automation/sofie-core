import { DBErrorLogItem } from '@sofie-automation/corelib/dist/dataModel/ErrorLog'
import {
	RundownPlaylistId,
	UserId,
	UserActionsLogItemId,
	ErrorLogItemId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { UserError } from '@sofie-automation/corelib/dist/error'
import { getRandomId } from '@sofie-automation/corelib/dist/lib'
import { StudioId, stringifyError } from '@sofie-automation/server-core-integration'
import { logger } from 'elastic-apm-node'
import { ErrorLog } from 'src/collections'
import { getCurrentTime } from 'src/lib/lib'

// TODO: make the max error log items configurable

/** How many errors to keep. Older ones are removed when a new one is recorded */
export const MAX_ERROR_LOG_ITEMS = 100

/** Where an error came from */
export interface ErrorLogOrigin {
	/** Method name (UI) or "METHOD /route" (REST) */
	operation: string
	/** UI event string, or REST origin */
	context?: string
	studioId?: StudioId | null
	playlistId?: RundownPlaylistId
	userId?: UserId | null
	userActionsLogId?: UserActionsLogItemId
}

/**
 * Record an error that is being returned to a client.
 * This should never throw and never block the caller: failures to record are only logged.
 */
export function recordError(userError: UserError, origin: ErrorLogOrigin): void {
	const doc: DBErrorLogItem = {
		_id: getRandomId<ErrorLogItemId>(),
		timestamp: getCurrentTime(),

		studioId: origin.studioId ?? null,
		playlistId: origin.playlistId,

		operation: origin.operation,
		context: origin.context,

		userId: origin.userId ?? null,
		userActionsLogId: origin.userActionsLogId,

		errorCode: userError.errorCode,
		error: {
			key: userError.key,
			message: userError.userMessage,
		},
	}

	insertAndTrim(doc).catch((e) => {
		logger.warn(`Failed to record error in ErrorLog: ${stringifyError(e)}`)
	})
}

async function insertAndTrim(doc: DBErrorLogItem): Promise<void> {
	await ErrorLog.insertAsync(doc)

	// Find everything beyond the newest N, and remove it
	const excess = await ErrorLog.findFetchAsync(
		{},
		{
			sort: { timestamp: -1 },
			skip: MAX_ERROR_LOG_ITEMS,
			projection: { _id: 1 },
		}
	)
	if (excess.length > 0) {
		await ErrorLog.removeAsync({ _id: { $in: excess.map((d) => d._id) } })
	}
}
