import {
	TTimerPropsBase,
	TTimerClearProjectedProps,
	TTimerPauseProps,
	TTimerRestartProps,
	TTimerResumeProps,
	TTimerSetProjectedAnchorPartProps,
	TTimerSetProjectedDurationProps,
	TTimerSetProjectedTimeProps,
	TTimerStartCountdownProps,
	TTimerStartFreeRunProps,
} from '@sofie-automation/corelib/dist/worker/studio'
import { JobContext } from '../jobs/index.js'
import { runWithPlayoutModel, runWithPlaylistLock } from './lock.js'
import { recalculateTTimerProjections } from './tTimers.js'
import { runJobWithPlayoutModel } from './lock.js'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { PlaylistTTimerImpl, TTimersService } from '../blueprints/context/services/TTimersService.js'
import type { PlayoutModel } from './model/PlayoutModel.js'

async function runTTimerJob(
	context: JobContext,
	data: TTimerPropsBase,
	fcn: (playoutModel: PlayoutModel, timer: PlaylistTTimerImpl) => Promise<void> | void
): Promise<void> {
	return runJobWithPlayoutModel(context, data, null, async (playoutModel) => {
		const timersService = TTimersService.withPlayoutModel(playoutModel, context)
		const timer = timersService.getTimer(data.timerIndex) as PlaylistTTimerImpl
		return fcn(playoutModel, timer)
	})
}

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

export async function handleTTimerStartCountdown(context: JobContext, data: TTimerStartCountdownProps): Promise<void> {
	return runTTimerJob(context, data, async (_playoutModel, timer) => {
		timer.startCountdown(data.duration * 1000, {
			stopAtZero: data.stopAtZero,
			startPaused: data.startPaused,
		})
	})
}

export async function handleTTimerStartFreeRun(context: JobContext, data: TTimerStartFreeRunProps): Promise<void> {
	return runTTimerJob(context, data, async (_playoutModel, timer) => {
		timer.startFreeRun({
			startPaused: data.startPaused,
		})
	})
}

export async function handleTTimerPause(_context: JobContext, data: TTimerPauseProps): Promise<void> {
	return runTTimerJob(_context, data, async (_playoutModel, timer) => {
		timer.pause()
	})
}

export async function handleTTimerResume(context: JobContext, data: TTimerResumeProps): Promise<void> {
	return runTTimerJob(context, data, async (_playoutModel, timer) => {
		timer.resume()
	})
}

export async function handleTTimerRestart(context: JobContext, data: TTimerRestartProps): Promise<void> {
	return runTTimerJob(context, data, async (_playoutModel, timer) => {
		timer.restart()
	})
}

export async function handleTTimerClearProjected(context: JobContext, data: TTimerClearProjectedProps): Promise<void> {
	return runTTimerJob(context, data, async (_playoutModel, timer) => {
		timer.clearProjected()
	})
}

export async function handleTTimerSetProjectedAnchorPart(
	context: JobContext,
	data: TTimerSetProjectedAnchorPartProps
): Promise<void> {
	return runTTimerJob(context, data, async (playoutModel, timer) => {
		const providedPartId = data.partId ? unprotectString(data.partId) : undefined

		const part =
			(data.externalId
				? playoutModel.getAllOrderedParts().find((p) => p.externalId === data.externalId)
				: undefined) ??
			(providedPartId
				? playoutModel
						.getAllOrderedParts()
						.find((p) => unprotectString(p._id) === providedPartId || p.externalId === providedPartId)
				: undefined)

		if (!part) return

		timer.setProjectedAnchorPart(unprotectString(part._id))
	})
}

export async function handleTTimerSetProjectedTime(
	context: JobContext,
	data: TTimerSetProjectedTimeProps
): Promise<void> {
	return runTTimerJob(context, data, async (_playoutModel, timer) => {
		timer.setProjectedTime(data.time, data.paused)
	})
}

export async function handleTTimerSetProjectedDuration(
	context: JobContext,
	data: TTimerSetProjectedDurationProps
): Promise<void> {
	return runTTimerJob(context, data, async (_playoutModel, timer) => {
		timer.setProjectedDuration(data.duration, data.paused)
	})
}
