import type { Logger } from 'winston'
import { unprotectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import { literal } from '@sofie-automation/shared-lib/dist/lib/lib'
import {
	PlaylistActivationStatus,
	ResolvedPlaylistTimingType,
	type ResolvedPlaylistEvent,
} from '@sofie-automation/live-status-gateway-api'
import { createResolvedPlaylistConversionContext, ToResolvedPlaylistStatusProps } from '../context/conversionContext.js'
import { toResolvedRundownStatus } from '../rundowns/toResolvedRundownStatus.js'
import { toTTimers } from '../../activePlaylistConversion/timers/toTTimers.js'
import { toQuickLoopStatus } from '../../activePlaylistConversion/quickLoop/toQuickLoopStatus.js'
import { PlaylistTimingType } from '@sofie-automation/blueprints-integration'
import { PlaylistTiming } from '@sofie-automation/corelib/dist/playout/rundownTiming'

/** Converts playlist-scoped collection snapshots into the `resolvedPlaylist` websocket event shape. */
export function toResolvedPlaylistStatus({
	playlistState,
	rundownsState,
	showStyleBaseExtState,
	segmentsState,
	partsState,
	partInstancesInPlaylistState,
	piecesInPlaylistState,
	pieceInstancesInPlaylistState,
	logger,
}: ToResolvedPlaylistStatusProps & { logger?: Logger }): ResolvedPlaylistEvent {
	// Keep payload shape stable before all dependencies are available.
	if (!playlistState || !showStyleBaseExtState) {
		return literal<ResolvedPlaylistEvent>({
			event: 'resolvedPlaylist' as const,
			id: '',
			externalId: '',
			name: '',
			activationStatus: PlaylistActivationStatus.DEACTIVATED,
			currentPartInstanceId: null,
			nextPartInstanceId: null,
			timing: {
				type: ResolvedPlaylistTimingType.FORWARD,
				startedPlayback: null,
				expectedDurationMs: null,
				expectedEnd: null,
			},
			tTimers: toTTimers(null),
			quickLoop: null,
			rundowns: [],
		})
	}

	const ctx = createResolvedPlaylistConversionContext({
		playlistState,
		rundownsState,
		showStyleBaseExtState,
		segmentsState,
		partsState,
		partInstancesInPlaylistState,
		piecesInPlaylistState,
		pieceInstancesInPlaylistState,
	})

	let activationStatus: PlaylistActivationStatus =
		ctx.playlist.activationId === undefined
			? PlaylistActivationStatus.DEACTIVATED
			: PlaylistActivationStatus.ACTIVATED
	if (ctx.playlist.activationId && ctx.playlist.rehearsal) activationStatus = PlaylistActivationStatus.REHEARSAL

	const currentPartInstanceId = ctx.playlist.currentPartInfo?.partInstanceId
		? unprotectString(ctx.playlist.currentPartInfo.partInstanceId)
		: null
	const nextPartInstanceId = ctx.playlist.nextPartInfo?.partInstanceId
		? unprotectString(ctx.playlist.nextPartInfo.partInstanceId)
		: null

	const segmentsById = Object.fromEntries(
		(segmentsState ?? []).map((s) => [unprotectString(s._id), { rundownId: s.rundownId }])
	) as Record<string, { rundownId?: (typeof segmentsState)[number]['rundownId'] } | undefined>
	const partsById = Object.fromEntries(
		(partsState ?? []).map((p) => [unprotectString(p._id), { rundownId: p.rundownId, segmentId: p.segmentId }])
	) as Record<
		string,
		| { rundownId?: (typeof partsState)[number]['rundownId']; segmentId?: (typeof partsState)[number]['segmentId'] }
		| undefined
	>

	const timingState = ctx.playlist.timing
	const expectedDurationMs: number | null = timingState?.expectedDuration ?? null
	const timingType =
		timingState?.type === PlaylistTimingType.BackTime
			? ResolvedPlaylistTimingType.BACK
			: ResolvedPlaylistTimingType.FORWARD
	const expectedEnd: number | null = timingState
		? (PlaylistTiming.getExpectedEnd(timingState, ctx.playlist.startedPlayback) ?? null)
		: null

	const playoutState = ctx.playlist.publicPlayoutPersistentState
	const publicData = ctx.playlist.publicData

	return literal<ResolvedPlaylistEvent>({
		event: 'resolvedPlaylist' as const,
		id: unprotectString(ctx.playlist._id),
		externalId: ctx.playlist.externalId,
		name: ctx.playlist.name,
		activationStatus,
		currentPartInstanceId,
		nextPartInstanceId,
		...(playoutState !== undefined ? { playoutState } : {}),
		...(publicData !== undefined ? { publicData } : {}),
		timing: {
			type: timingType,
			startedPlayback: ctx.playlist.startedPlayback ?? null,
			expectedDurationMs,
			expectedEnd,
		},
		tTimers: toTTimers(ctx.playlist.tTimers ?? null),
		quickLoop: toQuickLoopStatus({
			quickLoop: ctx.playlist.quickLoop,
			segmentsById,
			partsById,
			logger,
		}),
		rundowns: ctx.orderedRundownIds.map((rundownId) => toResolvedRundownStatus(ctx, rundownId)),
	})
}
