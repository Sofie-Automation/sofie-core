import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { UserError, UserErrorMessage } from '@sofie-automation/corelib/dist/error'
import {
	ActivateRundownPlaylistProps,
	DeactivateRundownPlaylistProps,
	PrepareRundownForBroadcastProps,
	ResetRundownPlaylistProps,
} from '@sofie-automation/corelib/dist/worker/studio'
import { JobContext } from '../jobs/index.js'
import { runJobWithPlayoutModel } from './lock.js'
import { resetRundownPlaylist } from './lib.js'
import { updateTimeline } from './timeline/generate.js'
import { getActiveRundownPlaylistsInStudioFromDb } from '../studio/lib.js'
import {
	activateRundownPlaylist,
	deactivateRundownPlaylist,
	deactivateRundownPlaylistInner,
} from './activePlaylistActions.js'
import { ReadonlyDeep } from 'type-fest'

async function checkNoOtherPlaylistsActive(
	context: JobContext,
	playlist: ReadonlyDeep<DBRundownPlaylist>
): Promise<void> {
	const anyOtherActiveRundownPlaylists = await getActiveRundownPlaylistsInStudioFromDb(
		context,
		playlist.studioId,
		playlist._id
	)
	if (anyOtherActiveRundownPlaylists.length) {
		// logger.warn('Only one rundown can be active at the same time. Active rundowns: ' + _.map(anyOtherActiveRundowns, rundown => rundown._id))
		throw UserError.create(UserErrorMessage.RundownAlreadyActiveNames, {
			names: anyOtherActiveRundownPlaylists.map((pl) => pl.name).join(', '),
		})
	}
}

/**
 * Prepare the rundown for transmission
 * To be triggered well before the broadcast, since it may take time and cause outputs to flicker
 */
export async function handlePrepareRundownPlaylistForBroadcast(
	context: JobContext,
	data: PrepareRundownForBroadcastProps
): Promise<void> {
	return runJobWithPlayoutModel(
		context,
		data,
		async (playoutModel) => {
			const playlist = playoutModel.playlist
			if (playlist.activationId) throw UserError.create(UserErrorMessage.RundownAlreadyActive)

			await checkNoOtherPlaylistsActive(context, playlist)
		},
		async (playoutModel) => {
			await resetRundownPlaylist(context, playoutModel)

			await activateRundownPlaylist(context, playoutModel, true) // Activate rundownPlaylist (rehearsal)
		}
	)
}

/**
 * Reset the rundown.
 * The User might have run through the rundown and wants to start over and try again.
 * Optionally activate the rundown at the end.
 */
export async function handleResetRundownPlaylist(context: JobContext, data: ResetRundownPlaylistProps): Promise<void> {
	return runJobWithPlayoutModel(
		context,
		data,
		async (playoutModel) => {
			const playlist = playoutModel.playlist
			if (playlist.activationId && !playlist.rehearsal && !context.studio.settings.allowRundownResetOnAir) {
				throw UserError.create(UserErrorMessage.RundownResetWhileActive)
			}

			if (data.activate) {
				if (data.forceActivate) {
					const anyOtherActivePlaylists = await getActiveRundownPlaylistsInStudioFromDb(
						context,
						playlist.studioId,
						playlist._id
					)
					if (anyOtherActivePlaylists.length > 0) {
						const errors: any[] = []
						// Try deactivating everything in parallel, although there should only ever be one active
						await Promise.allSettled(
							anyOtherActivePlaylists.map(async (otherRundownPlaylist) =>
								runJobWithPlayoutModel(
									context,
									// 'forceResetAndActivateRundownPlaylist',
									{ playlistId: otherRundownPlaylist._id },
									null,
									async (otherPlayoutModel) => {
										await deactivateRundownPlaylistInner(context, otherPlayoutModel)
									}
								).catch((e) => errors.push(e))
							)
						)
						if (errors.length > 0) {
							// Ok, something went wrong, but check if the active rundowns where deactivated?
							await checkNoOtherPlaylistsActive(context, playlist)
						}
					}
				} else {
					// Check if any other playlists are active, as we will be activating this one
					await checkNoOtherPlaylistsActive(context, playlist)
				}
			}
		},
		async (playoutModel) => {
			await resetRundownPlaylist(context, playoutModel)

			if (data.activate) {
				// Do the activation
				await activateRundownPlaylist(context, playoutModel, data.activate !== 'active') // Activate rundown
			} else if (playoutModel.playlist.activationId) {
				// Only update the timeline if this is the active playlist
				await updateTimeline(context, playoutModel)
			}
		}
	)
}

/**
 * Only activate the rundown, don't reset anything
 */
export async function handleActivateRundownPlaylist(
	context: JobContext,
	data: ActivateRundownPlaylistProps
): Promise<void> {
	return runJobWithPlayoutModel(
		context,
		// 'activateRundownPlaylist',
		data,
		async (playoutModel) => {
			const playlist = playoutModel.playlist
			await checkNoOtherPlaylistsActive(context, playlist)
		},
		async (playoutModel) => {
			await activateRundownPlaylist(context, playoutModel, data.rehearsal)
		}
	)
}

/**
 * Deactivate the rundown
 */
export async function handleDeactivateRundownPlaylist(
	context: JobContext,
	data: DeactivateRundownPlaylistProps
): Promise<void> {
	return runJobWithPlayoutModel(
		context,
		// 'deactivateRundownPlaylist',
		data,
		null,
		async (playoutModel) => {
			await deactivateRundownPlaylist(context, playoutModel)
		}
	)
}
