import {
	TTimerPauseProps,
	TTimerRestartProps,
	TTimerResumeProps,
	TTimerStartCountdownProps,
	TTimerStartFreeRunProps,
} from '@sofie-automation/corelib/dist/worker/studio'
import { JobContext } from '../jobs/index.js'
import { runWithPlayoutModel, runWithPlaylistLock } from './lock.js'
import {
	createCountdownTTimer,
	createFreeRunTTimer,
	pauseTTimer,
	recalculateTTimerProjections,
	restartTTimer,
	resumeTTimer,
	validateTTimerIndex,
} from './tTimers.js'
import { runJobWithPlayoutModel } from './lock.js'

/**
 * Handle RecalculateTTimerProjections job
 * This is called after setNext, takes, and ingest changes to update T-Timer projections
 * Since this job doesn't take a playlistId parameter, it finds the active playlist in the studio
 */
export async function handleRecalculateTTimerProjections(context: JobContext): Promise<void> {
	// Find active playlists in this studio (projection to just get IDs)
	const activePlaylistIds = await context.directCollections.RundownPlaylists.findFetch(
		{
			studioId: context.studioId,
			activationId: { $exists: true },
		},
		{
			projection: {
				_id: 1,
			},
		}
	)

	if (activePlaylistIds.length === 0) {
		// No active playlist, nothing to do
		return
	}

	// Process each active playlist (typically there's only one)
	for (const playlistRef of activePlaylistIds) {
		await runWithPlaylistLock(context, playlistRef._id, async (lock) => {
			// Fetch the full playlist object
			const playlist = await context.directCollections.RundownPlaylists.findOne(playlistRef._id)
			if (!playlist) {
				// Playlist was removed between query and lock
				return
			}

			await runWithPlayoutModel(context, playlist, lock, null, async (playoutModel) => {
				recalculateTTimerProjections(context, playoutModel)
			})
		})
	}
}

export async function handleTTimerStartCountdown(_context: JobContext, data: TTimerStartCountdownProps): Promise<void> {
	return runJobWithPlayoutModel(_context, data, null, async (playoutModel) => {
		validateTTimerIndex(data.timerIndex)

		const timer = createCountdownTTimer(data.duration * 1000, {
			stopAtZero: data.stopAtZero,
			startPaused: data.startPaused,
		})

		const currentTimer = playoutModel.playlist.tTimers[data.timerIndex - 1]
		playoutModel.updateTTimer({
			...currentTimer,
			...timer,
		})
	})
}

export async function handleTTimerStartFreeRun(_context: JobContext, data: TTimerStartFreeRunProps): Promise<void> {
	return runJobWithPlayoutModel(_context, data, null, async (playoutModel) => {
		validateTTimerIndex(data.timerIndex)

		const timer = createFreeRunTTimer({
			startPaused: data.startPaused,
		})

		const currentTimer = playoutModel.playlist.tTimers[data.timerIndex - 1]
		playoutModel.updateTTimer({
			...currentTimer,
			...timer,
		})
	})
}

export async function handleTTimerPause(_context: JobContext, data: TTimerPauseProps): Promise<void> {
	return runJobWithPlayoutModel(_context, data, null, async (playoutModel) => {
		validateTTimerIndex(data.timerIndex)

		const timerIndex = data.timerIndex - 1
		const currentTimer = playoutModel.playlist.tTimers[timerIndex]
		if (!currentTimer.mode) return

		const newTimer = pauseTTimer(currentTimer)
		if (newTimer) {
			playoutModel.updateTTimer(newTimer)
		}
	})
}

export async function handleTTimerResume(_context: JobContext, data: TTimerResumeProps): Promise<void> {
	return runJobWithPlayoutModel(_context, data, null, async (playoutModel) => {
		validateTTimerIndex(data.timerIndex)

		const timerIndex = data.timerIndex - 1
		const currentTimer = playoutModel.playlist.tTimers[timerIndex]
		if (!currentTimer.mode) return

		const newTimer = resumeTTimer(currentTimer)
		if (newTimer) {
			playoutModel.updateTTimer(newTimer)
		}
	})
}

export async function handleTTimerRestart(_context: JobContext, data: TTimerRestartProps): Promise<void> {
	return runJobWithPlayoutModel(_context, data, null, async (playoutModel) => {
		validateTTimerIndex(data.timerIndex)

		const timerIndex = data.timerIndex - 1
		const currentTimer = playoutModel.playlist.tTimers[timerIndex]
		if (!currentTimer.mode) return

		const newTimer = restartTTimer(currentTimer)
		if (newTimer) {
			playoutModel.updateTTimer(newTimer)
		}
	})
}
