import { RundownPlaylists, Rundowns } from '../../../collections'
import {
	ReloadRundownPlaylistResponse,
	TriggerReloadDataResponse,
} from '@sofie-automation/meteor-lib/dist/api/userActions'
import _ from 'underscore'
import { RundownPlaylistCollectionUtil } from '../../../collections/rundownPlaylistUtil'
import * as i18next from 'i18next'
import { UserPermissions } from '../../UserPermissions'
import { NoticeLevel, Notification, NotificationCenter } from '../../../lib/notifications/notifications'
import { RundownId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { getRundownNrcsName } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { UserAction } from '@sofie-automation/meteor-lib/dist/userAction'
import { Tracker } from 'meteor/tracker'
import { doUserAction } from '../../../lib/clientUserAction'
import { MeteorCall } from '../../../lib/meteorApi'
import { doModalDialog } from '../../../lib/ModalDialog'

export function handleRundownPlaylistReloadResponse(
	t: i18next.TFunction,
	userPermissions: Readonly<UserPermissions>,
	result: ReloadRundownPlaylistResponse
): boolean {
	const rundownsInNeedOfHandling = result.rundownsResponses.filter(
		(r) => r.response === TriggerReloadDataResponse.MISSING
	)
	const firstRundownId = _.first(rundownsInNeedOfHandling)?.rundownId
	let allRundownsAffected = false

	if (firstRundownId) {
		const firstRundown = Rundowns.findOne(firstRundownId)
		const playlist = RundownPlaylists.findOne(firstRundown?.playlistId)
		const allRundownIds = playlist ? RundownPlaylistCollectionUtil.getRundownUnorderedIDs(playlist) : []
		if (
			allRundownIds.length > 0 &&
			_.difference(
				allRundownIds,
				rundownsInNeedOfHandling.map((r) => r.rundownId)
			).length === 0
		) {
			allRundownsAffected = true
		}
	}

	const actionsTaken: RundownReloadResponseUserAction[] = []
	function onActionTaken(action: RundownReloadResponseUserAction): void {
		actionsTaken.push(action)
		if (actionsTaken.length === rundownsInNeedOfHandling.length) {
			// the user has taken action on all of the missing rundowns
			if (allRundownsAffected && actionsTaken.filter((actionTaken) => actionTaken !== 'removed').length === 0) {
				// all rundowns in the playlist were affected and all of them were removed
				// we redirect to the Lobby
				window.location.assign('/')
			}
		}
	}

	const handled = rundownsInNeedOfHandling.map((r) =>
		handleRundownReloadResponse(t, userPermissions, r.rundownId, r.response, onActionTaken)
	)
	return handled.reduce((previousValue, value) => previousValue || value, false)
}

export type RundownReloadResponseUserAction = 'removed' | 'unsynced' | 'error'

export function handleRundownReloadResponse(
	t: i18next.TFunction,
	userPermissions: Readonly<UserPermissions>,
	rundownId: RundownId,
	result: TriggerReloadDataResponse,
	clb?: (action: RundownReloadResponseUserAction) => void
): boolean {
	let hasDoneSomething = false

	if (result === TriggerReloadDataResponse.MISSING) {
		const rundown = Rundowns.findOne(rundownId)
		const playlist = RundownPlaylists.findOne(rundown?.playlistId)

		hasDoneSomething = true
		const notification = new Notification(
			undefined,
			NoticeLevel.CRITICAL,
			t(
				'Rundown {{rundownName}} in Playlist {{playlistName}} is missing in the data from {{nrcsName}}. You can either leave it in Sofie and mark it as Unsynced or remove the rundown from Sofie. What do you want to do?',
				{
					nrcsName: getRundownNrcsName(rundown),
					rundownName: rundown?.name || t('(Unknown rundown)'),
					playlistName: playlist?.name || t('(Unknown playlist)'),
				}
			),
			'userAction',
			undefined,
			true,
			[
				// actions:
				{
					label: t('Leave Unsynced'),
					type: 'default',
					disabled: !userPermissions.studio,
					action: () => {
						doUserAction(
							t,
							'Missing rundown action',
							UserAction.UNSYNC_RUNDOWN,
							async (e, ts) => MeteorCall.userAction.unsyncRundown(e, ts, rundownId),
							(err) => {
								if (!err) {
									notificationHandle.stop()
									clb?.('unsynced')
								} else {
									clb?.('error')
								}
							}
						)
					},
				},
				{
					label: t('Remove'),
					type: 'default',
					action: () => {
						doModalDialog({
							title: t('Remove rundown'),
							message: t(
								'Do you really want to remove just the rundown "{{rundownName}}" in the playlist {{playlistName}} from Sofie? \n\nThis cannot be undone!',
								{
									rundownName: rundown?.name || 'N/A',
									playlistName: playlist?.name || 'N/A',
								}
							),
							onAccept: () => {
								// nothing
								doUserAction(
									t,
									'Missing rundown action',
									UserAction.REMOVE_RUNDOWN,
									async (e, ts) => MeteorCall.userAction.removeRundown(e, ts, rundownId),
									(err) => {
										if (!err) {
											notificationHandle.stop()
											clb?.('removed')
										} else {
											clb?.('error')
										}
									}
								)
							},
						})
					},
				},
			]
		)
		const notificationHandle = NotificationCenter.push(notification)

		if (rundown) {
			// This allows the semi-modal dialog above to be closed automatically, once the rundown stops existing
			// for whatever reason
			const comp = Tracker.autorun(() => {
				const rundown = Rundowns.findOne(rundownId, {
					fields: {
						_id: 1,
						orphaned: 1,
					},
				})
				// we should hide the message
				if (!rundown || !rundown.orphaned) {
					notificationHandle.stop()
				}
			})
			notification.on('dropped', () => {
				// clean up the reactive computation above when the notification is closed. Will be also executed by
				// the notificationHandle.stop() above, so the Tracker.autorun will clean up after itself as well.
				comp.stop()
			})
		}
	}
	return hasDoneSomething
}
