import { Rundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { unprotectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import { doModalDialog } from '../../lib/ModalDialog.js'
import { doUserAction, UserAction } from '../../lib/clientUserAction.js'
import { MeteorCall } from '../../lib/meteorApi.js'
import { TFunction } from 'i18next'
import { handleRundownReloadResponse } from '../RundownView/RundownHeader/RundownReloadResponse.js'
import {
	RundownId,
	RundownLayoutId,
	RundownPlaylistId,
	ShowStyleBaseId,
	StudioId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { UserPermissions } from '../UserPermissions.js'

export function getRundownPlaylistLink(rundownPlaylistId: RundownPlaylistId): string {
	// double encoding so that "/" are handled correctly
	const encodedId = encodeURIComponent(encodeURIComponent(unprotectString(rundownPlaylistId)))

	return `/rundown/${encodedId}`
}

export function getStudioLink(studioId: StudioId): string {
	// double encoding so that "/" are handled correctly
	const encodedId = encodeURIComponent(encodeURIComponent(unprotectString(studioId)))

	return `/settings/studio/${encodedId}`
}

export function getShowStyleBaseLink(showStyleBaseId: ShowStyleBaseId): string {
	// double encoding so that "/" are handled correctly
	const encodedId = encodeURIComponent(encodeURIComponent(unprotectString(showStyleBaseId)))

	return `/settings/showStyleBase/${encodedId}`
}

export function getShelfLink(rundownId: RundownId | RundownPlaylistId, layoutId: RundownLayoutId): string {
	// double encoding so that "/" are handled correctly
	const encodedRundownId = encodeURIComponent(encodeURIComponent(unprotectString(rundownId)))
	const encodedLayoutId = encodeURIComponent(encodeURIComponent(unprotectString(layoutId)))

	return `/rundown/${encodedRundownId}/shelf/?shelfLayout=${encodedLayoutId}`
}

export function getRundownWithShelfLayoutLink(
	rundownId: RundownId | RundownPlaylistId,
	layoutId: RundownLayoutId
): string {
	// double encoding so that "/" are handled correctly
	const encodedRundownId = encodeURIComponent(encodeURIComponent(unprotectString(rundownId)))
	const encodedLayoutId = encodeURIComponent(encodeURIComponent(unprotectString(layoutId)))

	return `/rundown/${encodedRundownId}?rundownViewLayout=${encodedLayoutId}`
}

export function confirmDeleteRundown(rundown: Rundown, t: TFunction): void {
	doModalDialog({
		title: t('Delete rundown?'),
		yes: t('Delete'),
		no: t('Cancel'),
		onAccept: (e) => {
			doUserAction(t, e, UserAction.REMOVE_RUNDOWN, async (e, ts) =>
				MeteorCall.userAction.removeRundown(e, ts, rundown._id)
			)
		},
		message:
			t('Are you sure you want to delete the "{{name}}" rundown?', { name: rundown.name }) +
			'\n' +
			t('Please note: This action is irreversible!'),
	})
}

export function confirmReSyncRundown(userPermissions: Readonly<UserPermissions>, rundown: Rundown, t: TFunction): void {
	doModalDialog({
		title: t('Re-Sync rundown?'),
		yes: t('Re-Sync'),
		no: t('Cancel'),
		onAccept: (e) => {
			doUserAction(
				t,
				e,
				UserAction.RESYNC_RUNDOWN,
				async (e, ts) => MeteorCall.userAction.resyncRundown(e, ts, rundown._id),
				(err, res) => {
					if (!err && res) {
						return handleRundownReloadResponse(t, userPermissions, rundown._id, res)
					}
				}
			)
		},
		message: t('Are you sure you want to re-sync the "{{name}}" rundown?', {
			name: rundown.name,
		}),
	})
}
