import { RundownPlaylistId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { RundownPlayoutPropsBase } from '@sofie-automation/corelib/dist/worker/studio'
import { logger } from '../logging.js'
import { ReadonlyDeep } from 'type-fest'
import { JobContext } from '../jobs/index.js'
import { PlaylistLock } from '../jobs/lock.js'
import { PlayoutModel, PlayoutModelPreInit } from './model/PlayoutModel.js'
import { createPlayoutModelfromInitModel, loadPlayoutModelPreInit } from './model/implementation/LoadPlayoutModel.js'

/**
 * Run a typical playout job
 * This means loading the playout model in stages, doing some calculations and saving the result
 */
export async function runJobWithPlayoutModel<TRes>(
	context: JobContext,
	data: RundownPlayoutPropsBase,
	preInitFcn: null | ((playoutModel: PlayoutModelPreInit) => Promise<void> | void),
	fcn: (playoutModel: PlayoutModel) => Promise<TRes> | TRes
): Promise<TRes> {
	if (!data.playlistId) {
		throw new Error(`Job is missing playlistId`)
	}

	// We can lock before checking ownership, as the locks are scoped to the studio
	return runWithPlaylistLock(context, data.playlistId, async (playlistLock) => {
		const playlist = await context.directCollections.RundownPlaylists.findOne(data.playlistId)
		if (!playlist || playlist.studioId !== context.studioId) {
			throw new Error(`Job playlist "${data.playlistId}" not found or for another studio`)
		}

		return runWithPlayoutModel(context, playlist, playlistLock, preInitFcn, fcn)
	})
}

/**
 * Run a minimal playout job
 * This avoids loading the model
 */
export async function runJobWithPlaylistLock<TRes>(
	context: JobContext,
	data: RundownPlayoutPropsBase,
	fcn: (playlist: DBRundownPlaylist | undefined, lock: PlaylistLock) => Promise<TRes>
): Promise<TRes> {
	if (!data.playlistId) {
		throw new Error(`Job is missing playlistId`)
	}

	// We can lock before checking ownership, as the locks are scoped to the studio
	return runWithPlaylistLock(context, data.playlistId, async (lock) => {
		const playlist = await context.directCollections.RundownPlaylists.findOne(data.playlistId)
		if (playlist && playlist.studioId !== context.studioId) {
			throw new Error(`Job playlist "${data.playlistId}" not found or for another studio`)
		}

		return fcn(playlist, lock)
	})
}

/**
 * Lock the playlist for a quick task without the model
 */
export async function runWithPlaylistLock<TRes>(
	context: JobContext,
	playlistId: RundownPlaylistId,
	fcn: (lock: PlaylistLock) => Promise<TRes>
): Promise<TRes> {
	const playlistLock = await context.lockPlaylist(playlistId)
	try {
		const res = await fcn(playlistLock)
		// Explicitly await fcn, before releasing the lock
		return res
	} finally {
		await playlistLock.release()
	}
}

export async function runWithPlayoutModel<TRes>(
	context: JobContext,
	playlist: ReadonlyDeep<DBRundownPlaylist>,
	lock: PlaylistLock,
	preInitFcn: null | ((playoutModel: PlayoutModelPreInit) => Promise<void> | void),
	fcn: (playoutModel: PlayoutModel) => Promise<TRes> | TRes
): Promise<TRes> {
	const initPlayoutModel = await loadPlayoutModelPreInit(context, lock, playlist, false)

	if (preInitFcn) {
		await preInitFcn(initPlayoutModel)
	}

	const fullPlayoutModel = await createPlayoutModelfromInitModel(context, initPlayoutModel)

	try {
		const res = await fcn(fullPlayoutModel)
		logger.silly('runWithPlayoutModel: saveAllToDatabase')
		await fullPlayoutModel.saveAllToDatabase()

		return res
	} catch (err) {
		fullPlayoutModel.dispose()
		throw err
	}
}
