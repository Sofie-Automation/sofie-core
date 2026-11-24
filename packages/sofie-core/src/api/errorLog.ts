import { DBErrorLogItem } from '@sofie-automation/corelib/dist/dataModel/ErrorLog'
import {
	ErrorLogItemId,
	RundownPlaylistId,
	StudioId,
	UserActionsLogItemId,
	UserId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { UserError } from '@sofie-automation/corelib/dist/error'
import { getRandomId } from '@sofie-automation/corelib/dist/lib'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'
import { applyAndValidateOverrides } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { DEFAULT_ERROR_LOG_MAX_ITEMS } from '@sofie-automation/shared-lib/dist/core/constants'
import { ErrorLog } from '../collections'
import { getCoreSystemAsync } from '../coreSystem/collection'
import { getCurrentTime } from '../lib/lib'
import { logger } from '../logging'

/**
 * How many errors to keep, from the system settings. Older ones are removed when a new one is recorded.
 * Falls back to the default for a misconfigured value, so that a bad setting can't remove all errors.
 */
export async function getErrorLogMaxItems(): Promise<number> {
	const coreSystem = await getCoreSystemAsync()
	const configured = coreSystem && applyAndValidateOverrides(coreSystem.settingsWithOverrides).obj.errorLogMaxItems

	return typeof configured === 'number' && Number.isInteger(configured) && configured > 0
		? configured
		: DEFAULT_ERROR_LOG_MAX_ITEMS
}

/** Where an error came from */
export interface ErrorLogOrigin {
	/** User action method name (e.g. "worker.takeNextPart"), or "ingest.<jobName>" */
	operation: string
	/** UI event string or REST request description, for user actions */
	context?: string
	studioId?: StudioId | null
	playlistId?: RundownPlaylistId
	userId?: UserId | null
	userActionsLogId?: UserActionsLogItemId
}

/**
 * Errors that have already been recorded, so nested capture points don't record them twice.
 * Maps the error object to the id of its ErrorLog item, so that every capture point returns the same id.
 */
const recordedErrors = new WeakMap<object, ErrorLogItemId>()

/**
 * Record an error that is being returned to a client.
 * This should never throw and never block the caller: failures to record are only logged.
 * @returns The id of the ErrorLog item. This is generated up front, so it is returned before the item is stored.
 */
export function recordError(err: unknown, origin: ErrorLogOrigin): ErrorLogItemId {
	const isObject = typeof err === 'object' && err !== null
	if (isObject) {
		const existingId = recordedErrors.get(err)
		if (existingId) return existingId
	}

	const id = getRandomId<ErrorLogItemId>()
	if (isObject) recordedErrors.set(err, id)

	const userError = UserError.fromUnknown(err)

	const doc: DBErrorLogItem = {
		_id: id,
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

	return id
}

/**
 * Get the id of the ErrorLog item for an error that has already been recorded.
 * This allows a layer that sees the same error object after it has been recorded (eg the REST API) to report the id
 */
export function getRecordedErrorId(err: unknown): ErrorLogItemId | undefined {
	if (typeof err !== 'object' || err === null) return undefined
	return recordedErrors.get(err)
}

async function insertAndTrim(doc: DBErrorLogItem): Promise<void> {
	await ErrorLog.insertAsync(doc)

	// Find everything beyond the newest N, and remove it
	const excess = await ErrorLog.findFetchAsync(
		{},
		{
			sort: { timestamp: -1 },
			skip: await getErrorLogMaxItems(),
			projection: { _id: 1 },
		}
	)
	if (excess.length > 0) {
		await ErrorLog.removeAsync({ _id: { $in: excess.map((d) => d._id) } })
	}
}
