import { toResolvedPieceStatus } from '../pieces/toResolvedPieceStatus.js'
import { unprotectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import { ResolvedPlaylistConversionContext } from '../context/conversionContext.js'
import type { PartExtended } from '@sofie-automation/corelib/dist/dataModel/Part'
import type { PartInvalidReason as CorePartInvalidReason } from '@sofie-automation/corelib/dist/dataModel/Part'
import {
	PartInvalidReason,
	PartRundownTiming,
	ResolvedPart,
	ResolvedPartState,
} from '@sofie-automation/live-status-gateway-api'
import type { PartTimingStateDoc, PlaylistTimingStateDoc } from '@sofie-automation/corelib/dist/dataModel/TimingState'
import {
	offsetTimerState,
	type TimerState,
	timerStateToDuration,
} from '@sofie-automation/corelib/dist/dataModel/TimerState'
import { interpollateTranslation } from '@sofie-automation/corelib/dist/TranslatableMessage'
import { toNotificationSeverity } from '../../notification/toNotificationStatus.js'

/** Converts a resolved `PartExtended` model into the gateway API `ResolvedPart` shape. */
export function toResolvedPartStatus(ctx: ResolvedPlaylistConversionContext, partExtended: PartExtended): ResolvedPart {
	const part = partExtended
	const instance = part.instance
	const basePart = instance?.part ?? {}

	const instanceId = instance?._id ? unprotectString(instance._id) : ''
	let state: ResolvedPartState | undefined
	if (ctx.playlist.currentPartInfo?.partInstanceId && instance?._id === ctx.playlist.currentPartInfo.partInstanceId) {
		state = ResolvedPartState.CURRENT
	} else if (
		ctx.playlist.nextPartInfo?.partInstanceId &&
		instance?._id === ctx.playlist.nextPartInfo.partInstanceId
	) {
		state = ResolvedPartState.NEXT
	}

	const partId = part.partId ?? basePart._id
	const partTiming = partId ? ctx.timingStates?.parts.get(partId) : undefined
	const rundownTiming = toPartRundownTiming(partTiming, ctx.timingStates?.playlist)

	const timings = instance?.timings ?? {}
	const createdByAdLib = instance?.orphaned === 'adlib-part'

	return {
		id: unprotectString(part.partId ?? basePart._id),
		instanceId,
		createdByAdLib: createdByAdLib,
		externalId: basePart.externalId ?? '',
		name: basePart.title ?? '',
		rank: basePart._rank ?? 0,
		autoNext: !!basePart.autoNext,
		invalid: !!basePart.invalid,
		floated: !!basePart.floated,
		untimed: !!basePart.untimed,
		invalidReason: basePart.invalidReason ? toApiPartInvalidReason(basePart.invalidReason) : undefined,
		state,
		publicData: basePart.publicData,
		timing: {
			startMs: part.startsAt ?? 0,
			durationMs: part.renderedDuration ?? 0,
			plannedStartedPlayback: timings.plannedStartedPlayback ?? 0,
			reportedStartedPlayback: timings.reportedStartedPlayback ?? 0,
			playOffsetMs: timings.playOffset ?? undefined,
			setAsNext: timings.setAsNext ?? 0,
			take: timings.take ?? 0,
		},
		rundownTiming,
		pieces: part.pieces?.map((piece) => toResolvedPieceStatus(piece)) ?? [],
	}
}

function toApiPartInvalidReason(invalidReason: CorePartInvalidReason): PartInvalidReason {
	const msg = invalidReason.message

	return {
		message: interpollateTranslation(msg.key, msg.args ?? {}),
		severity: invalidReason.severity ? toNotificationSeverity(invalidReason.severity) : undefined,
		color: invalidReason.color,
	}
}

/**
 * A Part's rundown timing, as Sofie resolved and published it.
 *
 * The timers are forwarded rather than evaluated: the client reads them against its own clock, so
 * the gateway sends on playout events instead of on a tick. The durations are constant states, so
 * evaluating them to plain numbers costs nothing and matches the plain-number fields around them.
 */
function toPartRundownTiming(
	timing: PartTimingStateDoc | undefined,
	playlistTiming: PlaylistTimingStateDoc | undefined
): PartRundownTiming {
	return {
		// constant states, so any instant reads the same value
		expectedDurationMs: timing?.expectedDuration ? timerStateToDuration(timing.expectedDuration, 0) : 0,
		displayDurationMs: timing?.displayDuration ? timerStateToDuration(timing.displayDuration, 0) : 0,
		isInQuickLoop: timing?.isInQuickLoop ?? false,
		countsTowardsTiming: timing?.countsTowardsTiming ?? false,
		countdown: toPartCountdown(timing, playlistTiming),
		played: timing?.played,
		duration: timing?.duration,
		liveDisplayDuration: timing?.liveDisplayDuration,
	}
}

/**
 * The countdown until the Part goes on air: the playlist's base for the Part countdowns, shifted by the Part's offset.
 * Undefined when the Part has no offset, as it will probably not be played out if the rundown is played in order, and
 * when the playlist's timing is not that of the Part's playlist: after a switch of playlist, the previous playlist's
 * document can still be held until the new subscription delivers.
 */
function toPartCountdown(
	timing: PartTimingStateDoc | undefined,
	playlistTiming: PlaylistTimingStateDoc | undefined
): TimerState | undefined {
	const countdownOffset = timing?.countdownOffset
	if (!timing || countdownOffset === undefined || !playlistTiming) return undefined

	const isOfThePartsPlaylist = playlistTiming.playlistId === timing.playlistId
	if (!isOfThePartsPlaylist) return undefined

	return offsetTimerState(playlistTiming.partCountdownBase, countdownOffset)
}
