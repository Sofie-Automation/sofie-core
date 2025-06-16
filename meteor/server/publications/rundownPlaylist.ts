import { meteorPublish } from './lib/lib'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { RundownPlaylists } from '../collections'
import { CorelibPubSub } from '@sofie-automation/corelib/dist/pubsub'
import { MeteorPubSub } from '@sofie-automation/meteor-lib/dist/api/pubsub'
import { RundownPlaylistId, StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { check, Match } from '../lib/check'
import { MongoQuery } from '@sofie-automation/corelib/dist/mongo'
import { triggerWriteAccessBecauseNoCheckNecessary } from '../security/securityVerify'

meteorPublish(
	CorelibPubSub.rundownPlaylists,
	async function (
		rundownPlaylistIds: RundownPlaylistId[] | null,
		studioIds: StudioId[] | null,
		_token: string | undefined
	) {
		check(rundownPlaylistIds, Match.Maybe(Array))
		check(studioIds, Match.Maybe(Array))

		triggerWriteAccessBecauseNoCheckNecessary()

		// If values were provided, they must have values
		if (rundownPlaylistIds && rundownPlaylistIds.length === 0) return null
		if (studioIds && studioIds.length === 0) return null

		// Add the requested filter
		const selector: MongoQuery<DBRundownPlaylist> = {}
		if (rundownPlaylistIds) selector._id = { $in: rundownPlaylistIds }
		if (studioIds) selector.studioId = { $in: studioIds }

		return RundownPlaylists.findWithCursor(selector)
	}
)

meteorPublish(MeteorPubSub.rundownPlaylistForStudio, async function (studioId: StudioId, isActive: boolean) {
	triggerWriteAccessBecauseNoCheckNecessary()

	const selector: MongoQuery<DBRundownPlaylist> = {
		studioId,
	}

	if (isActive) {
		selector.activationId = { $exists: true }
	} else {
		selector.activationId = { $exists: false }
	}

	return RundownPlaylists.findWithCursor(selector)
})
