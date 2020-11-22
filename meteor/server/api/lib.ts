import { Meteor } from 'meteor/meteor'
import { MethodContext } from '../../lib/api/methods'
import { RundownPlaylistId, RundownPlaylist } from '../../lib/collections/RundownPlaylists'
import { Rundown, RundownId } from '../../lib/collections/Rundowns'
import { RundownPlaylistContentWriteAccess } from '../security/rundownPlaylist'

export function checkAccessAndGetPlaylist(context: MethodContext, playlistId: RundownPlaylistId): RundownPlaylist {
	const access = RundownPlaylistContentWriteAccess.playout(context, playlistId)
	const playlist = access.playlist
	if (!playlist) throw new Meteor.Error(404, `Rundown Playlist "${playlistId}" not found!`)
	return playlist
}

export function checkAccessAndGetRundown(context: MethodContext, rundownId: RundownId): Rundown {
	const access = RundownPlaylistContentWriteAccess.rundown(context, rundownId)
	const rundown = access.rundown
	if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)
	return rundown
}
