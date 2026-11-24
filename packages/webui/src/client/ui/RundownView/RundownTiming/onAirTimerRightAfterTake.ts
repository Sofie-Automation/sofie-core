import type { PartInstanceId, RundownPlaylistId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import type { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import type { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist/RundownPlaylist'
import type { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import type { TimerState } from '@sofie-automation/corelib/dist/dataModel/TimerState'
import {
	getPartTimingStateDocId,
	isPartTimingStateDoc,
	isPlaylistTimingStateDoc,
	type PartTimingStateDoc,
	type PlaylistTimingStateDoc,
	type TimingStateDoc,
} from '@sofie-automation/corelib/dist/dataModel/TimingState'
import type { MongoFieldSpecifierOnes } from '@sofie-automation/corelib/dist/mongo'
import { calculatePartInstanceExpectedDurationWithTransition } from '@sofie-automation/corelib/dist/playout/timings'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { CountdownType } from '@sofie-automation/blueprints-integration'
import { PlaylistTimingStates, UIPartInstances } from '../../Collections.js'
import { RundownPlaylists, Segments } from '../../../collections/index.js'

/** The published playlist fields read here, as the hooks project them */
type PublishedPlaylistTiming = Pick<TimingStateDoc, 'type'> & Partial<PlaylistTimingStateDoc>

type TakenPartInstance = Pick<
	DBPartInstance,
	'_id' | 'segmentId' | 'segmentPlayoutId' | 'takeCount' | 'part' | 'partPlayoutTimings' | 'timings'
>
type PublishedPartInstance = Pick<DBPartInstance, '_id' | 'segmentPlayoutId' | 'takeCount'>

/** A take that the page has, and that the published on-air timers do not describe yet */
interface TakeNotYetPublished {
	playlistId: RundownPlaylistId
	/** The part the page has just taken, and has on air */
	takenPartInstance: TakenPartInstance
	/** The part the published on-air timers describe, or undefined when they describe none */
	publishedPartInstance: PublishedPartInstance | undefined
}

/**
 * The state of an on-air timer for a part the page has just taken, while the published timers still
 * describe the part taken before it.
 *
 * Right after a take the page has the new part on air (the playlist names it, and its PartInstance has
 * arrived) a moment before the server's timing for it. For that moment this is the state the server
 * publishes for a part that has just been taken, made from the page's own copy of that part:
 *
 * - `remainingOnCurrentPart` is the part's planned length, holding until the part's planned start
 * - `remainingBudgetOnCurrentSegment` is the published budget when the part is in the same play of the
 *   same segment, since a take within a segment leaves the budget as it was; for a part in another
 *   segment it is that segment's budget, holding until the segment's start
 *
 * Once the server's timing for the part arrives it reads the same, so the shown value does not jump.
 *
 * @param publishedTiming The playlist's published timing, about some other part than `partInstanceId`
 * @param timer The timer the caller reads
 * @param partInstanceId The part the caller renders, or null when it renders none
 * @returns The state, or undefined when there is nothing to show for that moment: the page does not
 * have this part on air, the published timers do not describe an earlier part, or the timer is not one
 * of the two above
 */
export function getOnAirTimerStateRightAfterTake(
	publishedTiming: PublishedPlaylistTiming,
	timer: PropertyKey,
	partInstanceId: PartInstanceId | null
): TimerState | undefined {
	if (!isPlaylistTimingStateDoc(publishedTiming)) return undefined
	if (partInstanceId === null) return undefined

	const take = findTakeNotYetPublished(publishedTiming, partInstanceId)
	if (!take) return undefined

	switch (timer) {
		case 'remainingOnCurrentPart':
			return getRemainingOnTakenPart(take.takenPartInstance)
		case 'remainingBudgetOnCurrentSegment':
			return getRemainingBudgetOnTakenPartsSegment(publishedTiming, take)
		default:
			// The other timers are not about the on-air part, so the published value is never another
			// part's and the caller has no reason to ask for this
			return undefined
	}
}

/**
 * The take of `partInstanceId`, when the page has that part on air and the published on-air timers
 * describe a part taken before it, or no part at all.
 *
 * Both are needed: the page can render a part that is not on air (the Camera screen asks for every
 * part it shows), and the published timers can, for a moment, describe a part the page does not have
 * on air yet. Neither of those is a take that the published timing has not caught up with.
 */
function findTakeNotYetPublished(
	publishedTiming: PublishedPlaylistTiming,
	partInstanceId: PartInstanceId
): TakeNotYetPublished | undefined {
	const playlistId = publishedTiming.playlistId
	if (!playlistId) return undefined

	const playlist = RundownPlaylists.findOne(playlistId, {
		fields: { currentPartInfo: 1 } satisfies MongoFieldSpecifierOnes<DBRundownPlaylist>,
	}) as Pick<DBRundownPlaylist, 'currentPartInfo'> | undefined
	const isOnAirOnThePage = playlist?.currentPartInfo?.partInstanceId === partInstanceId
	if (!isOnAirOnThePage) return undefined

	const takenPartInstance = UIPartInstances.findOne(partInstanceId, {
		fields: {
			_id: 1,
			segmentId: 1,
			segmentPlayoutId: 1,
			takeCount: 1,
			part: 1,
			partPlayoutTimings: 1,
			timings: 1,
		} satisfies MongoFieldSpecifierOnes<DBPartInstance>,
	}) as TakenPartInstance | undefined
	if (!takenPartInstance) return undefined

	const publishedPartInstanceId = publishedTiming.currentPartInstanceId
	if (publishedPartInstanceId === undefined) {
		// The timing was published while nothing was on air, so this is the first take
		return { playlistId, takenPartInstance, publishedPartInstance: undefined }
	}

	const publishedPartInstance = UIPartInstances.findOne(publishedPartInstanceId, {
		fields: { _id: 1, segmentPlayoutId: 1, takeCount: 1 } satisfies MongoFieldSpecifierOnes<DBPartInstance>,
	}) as PublishedPartInstance | undefined
	// Without the published part there is no telling which of the two was taken first
	if (!publishedPartInstance) return undefined

	const isPublishedPartTakenEarlier = publishedPartInstance.takeCount < takenPartInstance.takeCount
	if (!isPublishedPartTakenEarlier) return undefined

	return { playlistId, takenPartInstance, publishedPartInstance }
}

/**
 * What the server publishes as the on-air part's remaining time for a part that has just been taken:
 * its planned length, holding until its planned start, from where it counts down. With one playout
 * gateway the part has no planned start until the gateway reports its start, so until then it holds.
 * In a multi-gateway studio the take plans the start a moment ahead.
 */
function getRemainingOnTakenPart(takenPartInstance: TakenPartInstance): TimerState | undefined {
	const part = takenPartInstance.part

	// A part with no length of its own in a display-duration group is as long as its share of the
	// group, which only the server works out
	const isInDisplayDurationGroup = Boolean(part.displayDurationGroup)
	const hasOwnExpectedDuration = part.expectedDuration !== undefined && part.expectedDuration !== 0
	const isLengthShareOfDisplayDurationGroup = isInDisplayDurationGroup && !hasOwnExpectedDuration
	if (isLengthShareOfDisplayDurationGroup) return undefined

	// A part just taken has no played duration yet, so its length is its expected duration with its
	// transition, and 0 for a part with none
	const plannedLength = calculatePartInstanceExpectedDurationWithTransition(takenPartInstance) ?? 0

	const plannedStart = takenPartInstance.timings?.plannedStartedPlayback
	const hasPlannedStart = typeof plannedStart === 'number'
	if (hasPlannedStart) {
		return { paused: true, duration: plannedLength, resumesAt: plannedStart }
	} else {
		return { paused: true, duration: plannedLength }
	}
}

/**
 * What the server publishes as the on-air segment's remaining budget, for a segment a part has just
 * been taken in.
 */
function getRemainingBudgetOnTakenPartsSegment(
	publishedTiming: PublishedPlaylistTiming,
	take: TakeNotYetPublished
): TimerState | undefined {
	const takenPartInstance = take.takenPartInstance

	// A take within a segment leaves its budget as it was
	const isInPublishedSegmentPlay =
		take.publishedPartInstance !== undefined &&
		take.publishedPartInstance.segmentPlayoutId === takenPartInstance.segmentPlayoutId
	if (isInPublishedSegmentPlay) return publishedTiming.remainingBudgetOnCurrentSegment

	const segment = Segments.findOne(takenPartInstance.segmentId, {
		fields: { segmentTiming: 1 } satisfies MongoFieldSpecifierOnes<DBSegment>,
	}) as Pick<DBSegment, 'segmentTiming'> | undefined
	const countsDownBudget = segment?.segmentTiming?.countdownType === CountdownType.SEGMENT_BUDGET_DURATION
	const budgetDuration = segment?.segmentTiming?.budgetDuration ?? 0
	const hasBudget = countsDownBudget && budgetDuration > 0
	if (!hasBudget) return undefined

	if (!isFollowedByAnotherSegment(take.playlistId, takenPartInstance)) return undefined

	const playlist = RundownPlaylists.findOne(take.playlistId, {
		fields: { segmentsStartedPlayback: 1 } satisfies MongoFieldSpecifierOnes<DBRundownPlaylist>,
	}) as Pick<DBRundownPlaylist, 'segmentsStartedPlayback'> | undefined
	// The segment's start is known once the playout gateway reports the start of its first part
	const segmentStart = playlist?.segmentsStartedPlayback?.[unprotectString(takenPartInstance.segmentPlayoutId)]
	const hasSegmentStarted = segmentStart !== undefined
	if (hasSegmentStarted) {
		return { paused: false, zeroTime: segmentStart + budgetDuration }
	} else {
		return { paused: true, duration: budgetDuration }
	}
}

/**
 * Whether a part of another segment follows the taken part in the playout order.
 *
 * The server counts down the on-air segment's budget only while another segment follows it, so for the
 * last segment of the playlist it publishes no budget.
 */
function isFollowedByAnotherSegment(playlistId: RundownPlaylistId, takenPartInstance: TakenPartInstance): boolean {
	const takenPartTiming = PlaylistTimingStates.findOne(getPartTimingStateDocId(takenPartInstance.part._id), {
		fields: { type: 1, rank: 1 } satisfies MongoFieldSpecifierOnes<PartTimingStateDoc>,
	}) as Pick<TimingStateDoc, 'type'> | undefined
	// Without the taken part's place in the playout order there is no telling what follows it
	if (!takenPartTiming || !isPartTimingStateDoc(takenPartTiming)) return false

	const laterPartOfAnotherSegment = PlaylistTimingStates.findOne(
		{
			type: 'part',
			playlistId,
			segmentId: { $ne: takenPartInstance.segmentId },
			rank: { $gt: takenPartTiming.rank },
		} as never,
		{ fields: { _id: 1 } }
	)
	return laterPartOfAnotherSegment !== undefined
}
