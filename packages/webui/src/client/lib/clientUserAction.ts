import * as i18next from 'i18next'
import _ from 'underscore'
import { NotificationCenter, Notification, NoticeLevel } from './notifications/notifications'
import { ClientAPI } from '@sofie-automation/meteor-lib/dist/api/client'
import { Meteor } from 'meteor/meteor'
import { logger } from './logging'
import { assertNever, Time } from './tempLib'
import { getCurrentTime, systemTime } from './systemTime'
import { UserAction } from '@sofie-automation/meteor-lib/dist/userAction'
import { translateMessage } from '@sofie-automation/corelib/dist/TranslatableMessage'

export { UserAction }

function userActionToLabel(userAction: UserAction, t: i18next.TFunction) {
	switch (userAction) {
		case UserAction.SAVE_EVALUATION:
			return t('Saving Evaluation')
		case UserAction.DEACTIVATE_RUNDOWN_PLAYLIST:
			return t('Deactivating Rundown Playlist')
		case UserAction.CREATE_SNAPSHOT_FOR_DEBUG:
			return t('Creating Snapshot for debugging')
		case UserAction.REMOVE_RUNDOWN_PLAYLIST:
			return t('Removing Rundown Playlist')
		case UserAction.RESYNC_RUNDOWN_PLAYLIST:
			return t('Re-Syncing Rundown Playlist')
		case UserAction.RESYNC_RUNDOWN:
			return t('Re-Syncing Rundown')
		case UserAction.DISABLE_NEXT_PIECE:
			return t('Disabling next Piece')
		case UserAction.TAKE:
			return t('Take')
		case UserAction.MOVE_NEXT:
			return t('Moving Next')
		case UserAction.ACTIVATE_HOLD:
			return t('Activating Hold')
		case UserAction.DEACTIVATE_OTHER_RUNDOWN_PLAYLIST:
			return t('Deactivating other Rundown Playlist, and activating this one')
		case UserAction.ACTIVATE_RUNDOWN_PLAYLIST:
			return t('Activating Rundown Playlist')
		case UserAction.RESET_AND_ACTIVATE_RUNDOWN_PLAYLIST:
			return t('Resetting and activating Rundown Playlist')
		case UserAction.PREPARE_FOR_BROADCAST:
			return t('Preparing for broadcast')
		case UserAction.RESET_RUNDOWN_PLAYLIST:
			return t('Resetting Rundown Playlist')
		case UserAction.RELOAD_RUNDOWN_PLAYLIST_DATA:
			return t('Reloading Rundown Playlist Data')
		case UserAction.SET_NEXT:
			return t('Setting Next')
		case UserAction.SET_NEXT_SEGMENT:
			return t('Setting Next Segment')
		case UserAction.QUEUE_NEXT_SEGMENT:
			return t('Queueing next Segment')
		case UserAction.TAKE_PIECE:
			return t('Taking Piece')
		case UserAction.UNSYNC_RUNDOWN:
			return t('Unsyncing Rundown')
		case UserAction.REMOVE_RUNDOWN:
			return t('Removing Rundown')
		case UserAction.SET_IN_OUT_POINTS:
			return t('Set In & Out points')
		case UserAction.START_ADLIB:
			return t('Starting AdLib')
		case UserAction.START_GLOBAL_ADLIB:
			return t('Starting Global AdLib')
		case UserAction.START_STICKY_PIECE:
			return t('Starting Sticky Piece')
		case UserAction.CLEAR_SOURCELAYER:
			return t('Clearing SourceLayer')
		case UserAction.RESTART_MEDIA_WORKFLOW:
			return t('Restarting Media Workflow')
		case UserAction.ABORT_MEDIA_WORKFLOW:
			return t('Aborting Media Workflow')
		case UserAction.PRIORITIZE_MEDIA_WORKFLOW:
			return t('Prioritizing Media Workflow')
		case UserAction.ABORT_ALL_MEDIA_WORKFLOWS:
			return t('Aborting all Media Workflows')
		case UserAction.PACKAGE_MANAGER_RESTART_WORK:
			return t('Package Manager: Restart work')
		case UserAction.PACKAGE_MANAGER_RESTART_PACKAGE_CONTAINER:
			return t('Package Manager: Restart Package Container')
		case UserAction.GENERATE_RESTART_TOKEN:
			return t('Generating restart token')
		case UserAction.RESTART_CORE:
			return t('Restarting Sofie Core')
		case UserAction.USER_LOG_PLAYER_METHOD:
			return t('Method ${method}')
		case UserAction.CREATE_BUCKET:
			return t('Creating a new Bucket')
		case UserAction.EMPTY_BUCKET:
			return t('Emptying Bucket')
		case UserAction.INGEST_BUCKET_ADLIB:
			return t('Importing an AdLib to the Bucket')
		case UserAction.MODIFY_BUCKET:
			return t('Modifying Bucket')
		case UserAction.MODIFY_BUCKET_ADLIB:
			return t('Modifying Bucket AdLib')
		case UserAction.REMOVE_BUCKET:
			return t('Removing Bucket')
		case UserAction.REMOVE_BUCKET_ADLIB:
			return t('Removing Bucket AdLib')
		case UserAction.START_BUCKET_ADLIB:
			return t('Starting Bucket AdLib')
		case UserAction.SWITCH_ROUTE_SET:
			return t('Switching routing')
		case UserAction.SAVE_TO_BUCKET:
			return t('Saving AdLib to Bucket')
		case UserAction.UNKNOWN_ACTION:
			return t('Unknown action')
		case UserAction.RUNDOWN_ORDER_MOVE:
			return t('Reording Rundowns in Playlist')
		case UserAction.RUNDOWN_ORDER_RESET:
			return t('Resetting Playlist to default order')
		case UserAction.PERIPHERAL_DEVICE_REFRESH_DEBUG_STATES:
			return t('Refreshing debug states')
		case UserAction.EXECUTE_USER_OPERATION:
			return t('Execute User Operation')
		case UserAction.ACTIVATE_ADLIB_TESTING:
			return t('AdLib Testing')
		case UserAction.CREATE_ADLIB_TESTING_RUNDOWN:
			return t('Creating Adlib Testing Rundown')
		case UserAction.SET_QUICK_LOOP_START:
			return t('Setting as QuickLoop Start')
		case UserAction.SET_QUICK_LOOP_END:
			return t('Setting as QuickLoop End')
		case UserAction.CLEAR_QUICK_LOOP:
			return t('Clear QuickLoop')
		default:
			assertNever(userAction)
	}
}

/**
 * Handle a the experience arround a back-end method call - display a "Waiting for action" message, when the call takes
 * long to return a result/error and show an error message when the call fails.
 *
 * @export
 * @template Result
 * @param {i18next.TFunction} t A translation function
 * @param {*} userEvent An `Event` which has triggered the method call. This will be transformed into a string and
 * 		fed into the `fcn` function.
 * @param {UserAction} action This is the "user-facing" action type, which is used to display the "label" for the method
 * 		call in the UI (what is being done).
 * @param {(event: any) => Promise<ClientAPI.ClientResponse<Result>>} fcn The function that is being wrapped/handled,
 *		generally a call to `MeteorCall` API.
 * @param {((err: any, res?: Result) => void | boolean)} [callback] An optional function that can handle the result
 * 		returned by the method. If this function returns `false`, the default handling for the method result will be
 * 		disabled (showing a "success" or "error message")
 * @param {string} [okMessage] An optional "success" message to be shown in the notification, once the method call
 * 		returns. If not provided, a default, generic message will be shown instead. The message will not be shown if
 * 		the method returns quickly.
 */
export function doUserAction<Result>(
	t: i18next.TFunction,
	// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
	userEvent: any,
	action: UserAction,
	fcn: (event: string, timeStamp: Time) => Promise<ClientAPI.ClientResponse<Result>>,
	callback?: (err: any, res?: Result) => void | boolean,
	okMessage?: string
): void {
	const actionName = userActionToLabel(action, t)

	// Display a progress message, if the method takes a long time to execute:
	let timeoutMessage: Notification | null = null
	const timeout = Meteor.setTimeout(() => {
		timeoutMessage = new Notification(
			undefined,
			NoticeLevel.NOTIFICATION,
			t('Waiting for action: {{actionName}}...', { actionName: actionName }),
			'userAction'
		)
		NotificationCenter.push(timeoutMessage)
	}, 2000)

	const clearMethodTimeout = () => {
		if (!timeoutMessage) {
			// cancel progress message:
			Meteor.clearTimeout(timeout)
		} else {
			try {
				timeoutMessage.drop()
			} catch (e) {
				// message was already dropped, that's fine
			}
		}
	}

	const actionContext = eventContextForLog(userEvent)
	fcn(actionContext[0], actionContext[1])
		.then((res: ClientAPI.ClientResponse<Result>) => {
			clearMethodTimeout()

			if (ClientAPI.isClientResponseError(res)) {
				let doDefault: boolean | void = true
				if (callback) {
					doDefault = callback(res)
				}
				if (doDefault !== false) {
					NotificationCenter.push(
						new Notification(
							undefined,
							NoticeLevel.CRITICAL,
							t('Action {{actionName}} failed: {{error}}', {
								error: translateMessage(res.error.message || res.error, t),
								actionName: actionName,
							}),
							'userAction'
						)
					)
					navigator.vibrate([400, 300, 400, 300, 400])
				}
			} else {
				let doDefault: boolean | void = true
				// all good
				if (callback) {
					doDefault = callback(undefined, res.result)
				}
				if (timeoutMessage && doDefault !== false) {
					NotificationCenter.push(
						new Notification(
							undefined,
							NoticeLevel.NOTIFICATION,
							okMessage || t('Action {{actionName}} done!', { actionName: actionName }),
							'userAction',
							undefined,
							false,
							undefined,
							undefined,
							2000
						)
					)
				}
			}
		})
		.catch((err) => {
			clearMethodTimeout()
			let doDefault: boolean | void = true
			if (callback) {
				doDefault = callback(err)
			} else {
				// If no callback has been defined, we should at least trace the error to console
				logger.error('doUserAction, no callback', err)
			}
			if (doDefault !== false) {
				NotificationCenter.push(
					new Notification(
						undefined,
						NoticeLevel.CRITICAL,
						t('{{actionName}} failed! More information can be found in the system log.', {
							actionName: actionName,
						}),
						'userAction'
					)
				)
				navigator.vibrate([400, 300, 400, 300, 400])
			}
		})
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function eventContextForLog(e: any): [string, Time] {
	const timeStamp = getEventTimestamp(e)
	if (!e) return ['', timeStamp]
	let str = ''
	if (_.isString(e)) {
		return [e, timeStamp]
	} else if (e.currentTarget && e.currentTarget.localName && !e.key && !e.code) {
		let contents = ''
		if (e.currentTarget.localName !== 'body' && e.currentTarget.innerText) {
			contents = ` "${e.currentTarget.innerText}"`
		}
		str =
			e.type + ': ' + e.currentTarget.localName + (e.currentTarget.id ? '#' + e.currentTarget.id : '') + contents
	} else if (e.key && e.code) {
		str = e.type + ': ' + keyboardEventToShortcut(e as KeyboardEvent)
	} else {
		str = e.type
	}
	if (!str) {
		logger.warn(
			`Could not create context in eventContextForLog, because provided event had no identifiable type: ${JSON.stringify(
				e
			)}, stack: ${new Error().stack}`
		)
		str = 'N/A'
	}

	return [str, timeStamp]
}

function keyboardEventToShortcut(e: KeyboardEvent): string {
	const combo = _.compact([
		e.ctrlKey ? 'Control' : undefined,
		e.shiftKey ? 'Shift' : undefined,
		e.altKey ? 'Alt' : undefined,
		e.metaKey ? 'Meta' : undefined,
		e.code,
	])
	return combo.join('+')
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function getEventTimestamp(e: any): Time {
	return e.timeStamp ? performance.timeOrigin + e.timeStamp + systemTime.timeOriginDiff : getCurrentTime()
}
