import { CountdownType, PlaylistTimingType } from '@sofie-automation/blueprints-integration'
import type { PartId, SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import type { TimingStateDoc } from '@sofie-automation/corelib/dist/dataModel/TimingState'
import { protectString, unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { calculateTimingDocuments, type Gateway, type PlayoutScript, playoutScript } from './lib/playoutScript'
import { clock, formatClock, type ReferenceRundown, referenceRundown } from './lib/referenceRundown'

/**
 * How many of the publication's documents a take changes. Every changed document is sent to every subscriber, so this
 * is what a take costs on the wire, and in each browser that holds the documents.
 *
 * Each part's countdown is published as the playlist's base for the part countdowns, shifted by an offset in the
 * part's own document. A take, its playback confirmation and the clock move the base, and leave most offsets as they
 * are, so the documents a take changes are the playlist, the segments it is about, and the parts it is about: the part
 * taken, the one before it, and the new Next. The lists below are the same on a rundown of 300 parts as on one of 40.
 *
 * The rundowns are of the reference form, with segments S01, S02, ... of ten 10 s parts each, S01P01 to S01P10 and so
 * on. The show is activated at 11:59:00, and every part is taken in turn, every 10 s from 12:00:00: S02P04 at 12:01:40,
 * and S03P01 at 12:03:20. A single playout gateway confirms each start 120 ms after the take.
 */

const PARTS_PER_SEGMENT = 10
const PART_LENGTH = 10000
const SHOW_START = clock('12:00:00')
const ACTIVATION = '11:59:00'
const GATEWAY_CONFIRMING_AFTER_120_MS: Gateway = { kind: 'single gateway', confirmsAfterMs: 120 }
const CONFIRMATION_DELAY = 120
const MULTI_GATEWAY_2_S_AHEAD: Gateway = { kind: 'multi gateway', latencyMs: 2000 }

function twoDigits(value: number): string {
	return String(value).padStart(2, '0')
}

/** A rundown of the reference form: segments S01, S02, ... of ten 10 s parts, S01P01 ... S01P10, ... */
function generatedRundown(segmentCount: number, budgets: Record<string, number> = {}): ReferenceRundown {
	const [rundownDoc] = referenceRundown().rundowns
	const rundown: ReferenceRundown = { rundowns: [rundownDoc], segments: [], parts: [] }

	for (let segmentIndex = 0; segmentIndex < segmentCount; segmentIndex++) {
		const segmentKey = `S${twoDigits(segmentIndex + 1)}`
		const segmentId = protectString<SegmentId>(segmentKey)
		const budgetDuration = budgets[segmentKey]
		rundown.segments.push({
			_id: segmentId,
			_rank: segmentIndex,
			externalId: segmentKey,
			rundownId: rundownDoc._id,
			name: segmentKey,
			segmentTiming:
				budgetDuration === undefined
					? undefined
					: { budgetDuration, countdownType: CountdownType.SEGMENT_BUDGET_DURATION },
		})

		for (let partIndex = 0; partIndex < PARTS_PER_SEGMENT; partIndex++) {
			const partKey = `${segmentKey}P${twoDigits(partIndex + 1)}`
			rundown.parts.push({
				_id: protectString<PartId>(partKey),
				rundownId: rundownDoc._id,
				segmentId,
				_rank: partIndex,
				externalId: partKey,
				title: partKey,
				expectedDuration: PART_LENGTH,
				// no pieces, so no transition changes the length
				expectedDurationWithTransition: PART_LENGTH,
			})
		}
	}

	return rundown
}

/** When a part is taken: every part in turn, every 10 s from the start of the show */
function takeTimeOf(rundown: ReferenceRundown, partKey: string): number {
	const index = rundown.parts.findIndex((part) => part._id === protectString(partKey))
	if (index === -1) throw new Error(`Part ${partKey} is not in the rundown`)
	return SHOW_START + index * PART_LENGTH
}

/** The show, activated, with every part taken in turn up to and including the part */
function showTakingEachPartUpTo(rundown: ReferenceRundown, gateway: Gateway, lastPartKey: string): PlayoutScript {
	let script = playoutScript({ rundown, timing: { type: PlaylistTimingType.None }, gateway }).activate(ACTIVATION)
	for (const part of rundown.parts) {
		script = script.take(formatClock(takeTimeOf(rundown, unprotectString(part._id))))
		if (part._id === protectString(lastPartKey)) break
	}
	return script
}

/** The documents the publication calculates from what it holds at the instant, at a time */
function documentsAt(script: PlayoutScript, instant: number, calculatedAt: number = instant): TimingStateDoc[] {
	const inputs = script.inputsAt(formatClock(instant))
	return calculateTimingDocuments(inputs, inputs.playlist.timing, calculatedAt)
}

/** The documents a subscriber holds just before the instant: those calculated at the last change before it */
function documentsJustBefore(script: PlayoutScript, instant: number): TimingStateDoc[] {
	const justBefore = formatClock(instant - 1)
	const calculatedAt = script.lastCalculationAt(justBefore)
	if (calculatedAt === undefined) throw new Error(`Nothing has been calculated before ${formatClock(instant)}`)
	const inputs = script.inputsAt(justBefore)
	return calculateTimingDocuments(inputs, inputs.playlist.timing, calculatedAt)
}

/** The ids of the documents that differ between the two, as the publication finds them and sends them on */
function changedDocumentIds(before: TimingStateDoc[], after: TimingStateDoc[]): string[] {
	const beforeById = new Map(before.map((doc) => [unprotectString(doc._id), JSON.stringify(doc)]))
	const afterById = new Map(after.map((doc) => [unprotectString(doc._id), JSON.stringify(doc)]))
	const ids = new Set([...beforeById.keys(), ...afterById.keys()])
	return Array.from(ids)
		.filter((id) => beforeById.get(id) !== afterById.get(id))
		.sort()
}

describe.each([{ partCount: 300 }, { partCount: 40 }])('on a rundown of $partCount parts', ({ partCount }) => {
	const segmentCount = partCount / PARTS_PER_SEGMENT
	const rundown = generatedRundown(segmentCount)

	describe('with one playout gateway', () => {
		const show = showTakingEachPartUpTo(rundown, GATEWAY_CONFIRMING_AFTER_120_MS, 'S03P01')

		it('a take within a segment changes the playlist, the segment, and the parts taken, left and next', () => {
			const take = takeTimeOf(rundown, 'S02P04')

			expect(changedDocumentIds(documentsJustBefore(show, take), documentsAt(show, take))).toEqual([
				'part_S02P03',
				'part_S02P04',
				'part_S02P05',
				'playlist_referencePlaylist',
				'segment_S02',
			])
		})

		it('its playback confirmation changes the playlist, the segment, and the parts started and stopped', () => {
			const confirmation = takeTimeOf(rundown, 'S02P04') + CONFIRMATION_DELAY

			expect(
				changedDocumentIds(documentsJustBefore(show, confirmation), documentsAt(show, confirmation))
			).toEqual(['part_S02P03', 'part_S02P04', 'playlist_referencePlaylist', 'segment_S02'])
		})

		it('a take into the next segment changes the segment it leaves, and its confirmation both segments', () => {
			const take = takeTimeOf(rundown, 'S03P01')

			expect(changedDocumentIds(documentsJustBefore(show, take), documentsAt(show, take))).toEqual([
				'part_S02P10',
				'part_S03P01',
				'part_S03P02',
				'playlist_referencePlaylist',
				'segment_S02',
			])
			expect(changedDocumentIds(documentsAt(show, take), documentsAt(show, take + CONFIRMATION_DELAY))).toEqual([
				'part_S02P10',
				'part_S03P01',
				'playlist_referencePlaylist',
				'segment_S02',
				'segment_S03',
			])
		})

		it('the clock changes nothing, also once the on-air part overruns', () => {
			const confirmation = takeTimeOf(rundown, 'S03P01') + CONFIRMATION_DELAY

			expect(
				changedDocumentIds(
					documentsAt(show, confirmation),
					documentsAt(show, confirmation, confirmation + 60000)
				)
			).toEqual(['playlist_referencePlaylist'])
		})
	})

	describe('with a segment budget', () => {
		// S03 is planned for 100 s, and has a budget of 60 s
		const budgetedRundown = generatedRundown(segmentCount, { S03: 60000 })
		const show = showTakingEachPartUpTo(budgetedRundown, GATEWAY_CONFIRMING_AFTER_120_MS, 'S03P02')

		it('a take into the segment changes, at the confirmation, the parts of the segment that waited for its budget', () => {
			const take = takeTimeOf(budgetedRundown, 'S03P01')

			expect(changedDocumentIds(documentsJustBefore(show, take), documentsAt(show, take))).toEqual([
				'part_S02P10',
				'part_S03P01',
				'part_S03P02',
				'playlist_referencePlaylist',
				'segment_S02',
			])
			// Until the start of S03P01 is confirmed, S03P02 to S03P06 wait for what is left of the budget after the
			// parts before them. From the start on, the budget counts down by itself, and they wait for none of it
			expect(changedDocumentIds(documentsAt(show, take), documentsAt(show, take + CONFIRMATION_DELAY))).toEqual([
				'part_S02P10',
				'part_S03P01',
				'part_S03P02',
				'part_S03P03',
				'part_S03P04',
				'part_S03P05',
				'part_S03P06',
				'playlist_referencePlaylist',
				'segment_S02',
				'segment_S03',
			])
		})

		it('a take within the segment changes no more than elsewhere', () => {
			const take = takeTimeOf(budgetedRundown, 'S03P02')

			// the segment's budget counts down by itself, so its document stays as it was, at the take and at the
			// confirmation
			expect(changedDocumentIds(documentsJustBefore(show, take), documentsAt(show, take))).toEqual([
				'part_S03P01',
				'part_S03P02',
				'part_S03P03',
				'playlist_referencePlaylist',
			])
			expect(changedDocumentIds(documentsAt(show, take), documentsAt(show, take + CONFIRMATION_DELAY))).toEqual([
				'part_S03P01',
				'part_S03P02',
				'playlist_referencePlaylist',
			])
		})
	})

	describe('in multi-gateway mode', () => {
		const show = showTakingEachPartUpTo(rundown, MULTI_GATEWAY_2_S_AHEAD, 'S02P04')
		const take = takeTimeOf(rundown, 'S02P04')
		const plannedStart = take + 2000

		it('a take changes the playlist, the segment, and the parts taken, left and next', () => {
			expect(changedDocumentIds(documentsJustBefore(show, take), documentsAt(show, take))).toEqual([
				'part_S02P03',
				'part_S02P04',
				'part_S02P05',
				'playlist_referencePlaylist',
				'segment_S02',
			])
		})

		it('a calculation once the planned start has passed changes the playlist and the segment', () => {
			expect(changedDocumentIds(documentsAt(show, take), documentsAt(show, take, plannedStart + 500))).toEqual([
				'playlist_referencePlaylist',
				'segment_S02',
			])
		})
	})
})
