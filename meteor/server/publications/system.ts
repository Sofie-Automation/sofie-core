import { meteorPublish } from './lib/lib'
import { MeteorPubSub } from '@sofie-automation/meteor-lib/dist/api/pubsub'
import { CoreSystem, Notifications } from '../collections'
import { RundownId, RundownPlaylistId, StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { check } from 'meteor/check'
import { SYSTEM_ID } from '@sofie-automation/meteor-lib/dist/collections/CoreSystem'
import { triggerWriteAccessBecauseNoCheckNecessary } from '../security/securityVerify'
import { CorelibPubSub } from '@sofie-automation/corelib/dist/pubsub'

meteorPublish(MeteorPubSub.coreSystem, async function (_token: string | undefined) {
	triggerWriteAccessBecauseNoCheckNecessary()

	return CoreSystem.findWithCursor(SYSTEM_ID, {
		projection: {
			// Include only specific fields in the result documents:
			_id: 1,
			systemInfo: 1,
			apm: 1,
			name: 1,
			logLevel: 1,
			serviceMessages: 1,
			blueprintId: 1,
			logo: 1,
			settingsWithOverrides: 1,
			enableMonitorBlockedThread: 1,
		},
	})
})

meteorPublish(CorelibPubSub.notificationsForRundown, async function (studioId: StudioId, rundownId: RundownId) {
	// HACK: This should do real auth
	triggerWriteAccessBecauseNoCheckNecessary()

	check(studioId, String)
	check(rundownId, String)

	return Notifications.findWithCursor({
		// Loosely match any notifications related to this rundown
		'relatedTo.studioId': studioId,
		'relatedTo.rundownId': rundownId,
	})
})

meteorPublish(
	CorelibPubSub.notificationsForRundownPlaylist,
	async function (studioId: StudioId, playlistId: RundownPlaylistId) {
		// HACK: This should do real auth
		triggerWriteAccessBecauseNoCheckNecessary()

		check(studioId, String)
		check(playlistId, String)

		return Notifications.findWithCursor({
			// Loosely match any notifications related to this playlist
			'relatedTo.studioId': studioId,
			'relatedTo.playlistId': playlistId,
		})
	}
)
