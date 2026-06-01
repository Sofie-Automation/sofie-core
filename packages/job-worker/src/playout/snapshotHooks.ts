import { IBlueprintPlaylistSnapshotInfo, IBlueprintSystemSnapshotInfo } from '@sofie-automation/blueprints-integration'
import {
	OnSystemSnapshotCreatedProps,
	GeneratePlaylistSnapshotProps,
} from '@sofie-automation/corelib/dist/worker/studio'
import { SnapshotId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist/RundownPlaylist'
import { CoreRundownPlaylistSnapshot } from '@sofie-automation/corelib/dist/snapshots'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { ReadonlyDeep } from 'type-fest'
import { PlaylistSnapshotCreatedContext } from '../blueprints/context/PlaylistSnapshotCreatedContext.js'
import { SystemSnapshotCreatedContext } from '../blueprints/context/SystemSnapshotCreatedContext.js'
import { JobContext } from '../jobs/index.js'
import { logger } from '../logging.js'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'

/**
 * Invokes {@link ShowStyleBlueprintManifest.onPlaylistSnapshotCreated} if defined.
 *
 * Called from {@link handleGeneratePlaylistSnapshot} after the playlist lock is released.
 * Blueprint resolution and hook errors are caught and logged; they do not abort snapshot generation.
 */
export async function invokeOnPlaylistSnapshotCreated(
	context: JobContext,
	props: GeneratePlaylistSnapshotProps,
	snapshot: CoreRundownPlaylistSnapshot,
	snapshotId: SnapshotId
): Promise<void> {
	const playlist = snapshot.playlist
	const rundown = pickRundownForPlaylistSnapshot(playlist, snapshot)
	if (!rundown) {
		logger.info(`Skipping onPlaylistSnapshotCreated for playlist "${playlist._id}": no rundown found in playlist`)
		return
	}

	try {
		const showStyle = await context.getShowStyleCompound(rundown.showStyleVariantId, rundown.showStyleBaseId)
		const blueprint = await context.getShowStyleBlueprint(showStyle._id)
		if (!blueprint.blueprint.onPlaylistSnapshotCreated) return

		const info: IBlueprintPlaylistSnapshotInfo = {
			snapshotId: unprotectString(snapshotId),
			playlistId: unprotectString(playlist._id),
			reason: props.reason ?? '',
			options: {
				full: props.full,
				withTimeline: props.withTimeline,
			},
			playlist: {
				name: playlist.name,
				active: !!playlist.activationId,
				rehearsal: !!playlist.rehearsal,
			},
		}

		const blueprintContext = new PlaylistSnapshotCreatedContext(
			context,
			{
				name: 'onPlaylistSnapshotCreated',
				identifier: `studioId=${context.studioId},playlistId=${playlist._id},snapshotId=${snapshotId}`,
			},
			context.studio,
			context.getStudioBlueprintConfig(),
			showStyle,
			context.getShowStyleBlueprintConfig(showStyle)
		)
		await blueprint.blueprint.onPlaylistSnapshotCreated(blueprintContext, info)
	} catch (err) {
		logger.error(
			`Error in showStyleBlueprint.onPlaylistSnapshotCreated (rundownId=${rundown._id}, showStyleBaseId=${rundown.showStyleBaseId}, showStyleVariantId=${rundown.showStyleVariantId}): ${stringifyError(err)}`
		)
	}
}

/**
 * Chooses which rundown (and thus show-style blueprint) to use for a playlist snapshot hook.
 *
 * Priority: current part → next part (from playlist part info, then part instances in the snapshot),
 * otherwise the first rundown sorted by name. Matches presenter-style resolution (`current` before `next`).
 */
export function pickRundownForPlaylistSnapshot(
	playlist: ReadonlyDeep<DBRundownPlaylist>,
	snapshot: CoreRundownPlaylistSnapshot
): ReadonlyDeep<DBRundown> | undefined {
	const rundowns = [...snapshot.rundowns].sort((a, b) => a.name.localeCompare(b.name))
	if (rundowns.length === 0) return undefined

	const partInstanceById = new Map(snapshot.partInstances.map((p) => [p._id, p]))

	const currentPartInfo = playlist.currentPartInfo
	if (currentPartInfo) {
		if (currentPartInfo.rundownId) {
			const rundown = rundowns.find((r) => r._id === currentPartInfo.rundownId)
			if (rundown) return rundown
		}
		const currentPartInstanceId = currentPartInfo.partInstanceId
		if (currentPartInstanceId) {
			const currentPartInstance = partInstanceById.get(currentPartInstanceId)
			if (currentPartInstance) {
				const rundown = rundowns.find((r) => r._id === currentPartInstance.rundownId)
				if (rundown) return rundown
			}
		}
	}

	const nextPartInfo = playlist.nextPartInfo
	if (nextPartInfo) {
		if (nextPartInfo.rundownId) {
			const rundown = rundowns.find((r) => r._id === nextPartInfo.rundownId)
			if (rundown) return rundown
		}
		const nextPartInstanceId = nextPartInfo.partInstanceId
		if (nextPartInstanceId) {
			const nextPartInstance = partInstanceById.get(nextPartInstanceId)
			if (nextPartInstance) {
				const rundown = rundowns.find((r) => r._id === nextPartInstance.rundownId)
				if (rundown) return rundown
			}
		}
	}

	return rundowns[0]
}

/**
 * Worker job handler for {@link StudioJobs.OnSystemSnapshotCreated}.
 *
 * Invokes {@link StudioBlueprintManifest.onSystemSnapshotCreated} for the studio of the worker job.
 * Queued from Meteor after a system or debug snapshot has been stored.
 */
export async function handleOnSystemSnapshotCreated(
	context: JobContext,
	props: OnSystemSnapshotCreatedProps
): Promise<void> {
	if (!context.studioBlueprint.blueprint.onSystemSnapshotCreated) return

	const info: IBlueprintSystemSnapshotInfo = {
		snapshotId: unprotectString(props.snapshotId),
		reason: props.reason,
		type: props.type,
		options: {
			studioId: props.options.studioId ? unprotectString(props.options.studioId) : undefined,
			withDeviceSnapshots: props.options.withDeviceSnapshots,
			fullSystem: props.options.fullSystem,
		},
	}

	try {
		const blueprintContext = new SystemSnapshotCreatedContext(
			context,
			{
				name: 'onSystemSnapshotCreated',
				identifier: `studioId=${context.studioId},snapshotId=${props.snapshotId}`,
			},
			context.studio,
			context.getStudioBlueprintConfig()
		)
		await context.studioBlueprint.blueprint.onSystemSnapshotCreated(blueprintContext, info)
	} catch (err) {
		logger.error(`Error in studioBlueprint.onSystemSnapshotCreated: ${stringifyError(err)}`)
	}
}
