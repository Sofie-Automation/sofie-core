import type { IExecuteTSRActionsContext } from './executeTsrActionContext.js'
import type { IShowStyleContext } from './showStyleContext.js'
import type { IStudioContext } from './studioContext.js'

/**
 * How the system snapshot hook was triggered.
 * - `system` — system snapshot (settings, REST, automatic snapshot before migration)
 * - `debug` — debug snapshot capture from the rundown UI
 */
export type BlueprintSnapshotType = 'system' | 'debug'

/** Options that were used when the system snapshot was created. */
export interface IBlueprintSystemSnapshotOptions {
	/** Studio this hook invocation runs for (same as context; use `fullSystem` for snapshot scope). */
	studioId?: string
	/** Whether peripheral device state snapshots were included in the stored snapshot file. */
	withDeviceSnapshots?: boolean
	/**
	 * `true` when the stored snapshot is a full-system snapshot (all studios).
	 * `false` when the snapshot was filtered to a single studio.
	 */
	fullSystem?: boolean
}

/**
 * Metadata passed to {@link StudioBlueprintManifest.onSystemSnapshotCreated}.
 * Does not include the snapshot file contents.
 */
export interface IBlueprintSystemSnapshotInfo {
	/** Id of the stored snapshot (same value for every studio when `fullSystem` is true). */
	snapshotId: string
	/** Human-readable reason provided when the snapshot was requested (e.g. UI label, cron message). */
	reason: string
	type: BlueprintSnapshotType
	/** Snapshot creation options relevant to this hook invocation. */
	options: IBlueprintSystemSnapshotOptions
}

/**
 * Context for {@link StudioBlueprintManifest.onSystemSnapshotCreated}.
 * Provides studio config, mappings, and TSR device actions for the studio worker job.
 */
export interface ISystemSnapshotCreatedContext extends IStudioContext, IExecuteTSRActionsContext {}

/** Options that were used when the playlist snapshot was generated. */
export interface IBlueprintPlaylistSnapshotOptions {
	/** When true, all part/piece instances are included; when false, only recent/non-reset instances. */
	full: boolean
	/** When true and the playlist is activated, the timeline is included in the snapshot data. */
	withTimeline: boolean
}

/** Minimal playlist state exposed to the blueprint (not the full DB document). */
export interface IBlueprintPlaylistSnapshotPlaylistInfo {
	/** Playlist display name. */
	name: string
	/** Whether the playlist had an active activation at snapshot time. */
	active: boolean
	/** Whether the playlist was in rehearsal mode at snapshot time. */
	rehearsal: boolean
}

/**
 * Metadata passed to {@link ShowStyleBlueprintManifest.onPlaylistSnapshotCreated}.
 * Does not include the snapshot file contents.
 */
export interface IBlueprintPlaylistSnapshotInfo {
	/** Id assigned to this snapshot before generation completes. */
	snapshotId: string
	/** Id of the rundown playlist that was snapshotted. */
	playlistId: string
	/** Human-readable reason provided when the snapshot was requested. */
	reason: string
	/** Snapshot generation options. */
	options: IBlueprintPlaylistSnapshotOptions
	/** Summary of playlist state at snapshot time. */
	playlist: IBlueprintPlaylistSnapshotPlaylistInfo
}

/**
 * Context for {@link ShowStyleBlueprintManifest.onPlaylistSnapshotCreated}.
 * Provides show-style and studio config, and TSR device actions.
 *
 * For playlists with multiple rundowns/show styles, only one show-style blueprint is invoked per snapshot.
 * Rundown selection order: current part, then next part, then first rundown by name (see job-worker
 * `pickRundownForPlaylistSnapshot`).
 */
export interface IPlaylistSnapshotCreatedContext extends IShowStyleContext, IExecuteTSRActionsContext {}
