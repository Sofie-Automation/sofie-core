import type { RundownPlaylistTiming, SegmentTimingInfo } from '@sofie-automation/blueprints-integration'
import type { PartId, RundownId, RundownPlaylistId, SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import type { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import type { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import type { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import type { MockJobContext } from './context.js'
import { defaultRundown, defaultRundownPlaylist } from './defaultCollectionObjects.js'
import { setupMockShowStyleCompound } from './presetCollections.js'

/**
 * The reference rundown for the timing tests: four segments, ten parts, 2:30 in all.
 *
 *   A Open     A1 0:10  A2 0:10  A3 0:10
 *   B News     B1 0:20  B2 0:20
 *   C Feature  C1 0:10  C2 0:20  C3 0:30
 *   D Close    D1 0:10  D2 0:10
 *
 * The timing publication's tests in sofie-core keep their own copy of this table, with the same clock helpers, in
 * packages/sofie-core/src/publications/playlistTimingState/__tests__/timing/lib/referenceRundown.ts. Test code is
 * not built into any package, so neither copy can import the other. Change both together.
 *
 * The rundown is one rundown in one playlist. The ids are the plain keys: segment 'A', part 'A1'. Part ranks
 * restart at 0 in each segment. The parts have no pieces, so the expected duration with transition equals the
 * expected duration.
 */

/** Midnight UTC on the day every reference show runs. Clock times are printed in UTC */
export const REFERENCE_DAY = Date.UTC(2026, 0, 5)

const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/** A time of day on the reference day, in UTC: '12:00:10' or '12:00:10.200' */
export function clock(text: string): number {
	const match = /^(\d\d):(\d\d):(\d\d)(?:\.(\d\d\d))?$/.exec(text)
	if (!match) throw new Error(`"${text}" is not a clock time like 12:00:10 or 12:00:10.200`)
	const [, hours, minutes, seconds, milliseconds] = match
	return (
		REFERENCE_DAY +
		Number(hours) * HOUR +
		Number(minutes) * MINUTE +
		Number(seconds) * SECOND +
		Number(milliseconds ?? 0)
	)
}

/** A length of time: '2:30' or '0:09.800' */
export function length(text: string): number {
	const match = /^(\d+):(\d\d)(?:\.(\d\d\d))?$/.exec(text)
	if (!match) throw new Error(`"${text}" is not a length like 2:30 or 0:09.800`)
	const [, minutes, seconds, milliseconds] = match
	return Number(minutes) * MINUTE + Number(seconds) * SECOND + Number(milliseconds ?? 0)
}

function twoDigits(value: number): string {
	return String(value).padStart(2, '0')
}
function threeDigits(value: number): string {
	return String(value).padStart(3, '0')
}

/**
 * A time as a UTC clock time on the reference day, with milliseconds only when they are not zero: '12:00:05',
 * '12:00:05.030'. A time on any other day is printed in full, as '2026-01-04T23:59:59.999Z'
 */
export function formatClock(time: number): string {
	if (!Number.isInteger(time)) throw new Error(`Time ${time} is not a whole number of milliseconds`)

	const sinceMidnight = time - REFERENCE_DAY
	if (sinceMidnight < 0 || sinceMidnight >= DAY) return new Date(time).toISOString()

	const hours = Math.floor(sinceMidnight / HOUR)
	const minutes = Math.floor(sinceMidnight / MINUTE) % 60
	const seconds = Math.floor(sinceMidnight / SECOND) % 60
	const milliseconds = sinceMidnight % SECOND

	const text = `${twoDigits(hours)}:${twoDigits(minutes)}:${twoDigits(seconds)}`
	return milliseconds === 0 ? text : `${text}.${threeDigits(milliseconds)}`
}

/**
 * A length of time as m:ss, or h:mm:ss from one hour, with milliseconds only when they are not zero: '2:30',
 * '-0:09.800', '1:01:01'. A negative length has a leading '-'; zero never has one
 */
export function formatLength(duration: number): string {
	if (!Number.isInteger(duration)) throw new Error(`Length ${duration} is not a whole number of milliseconds`)

	const sign = duration < 0 ? '-' : ''
	const size = Math.abs(duration)
	const hours = Math.floor(size / HOUR)
	const minutes = Math.floor(size / MINUTE) % 60
	const seconds = Math.floor(size / SECOND) % 60
	const milliseconds = size % SECOND

	const text =
		hours === 0 ? `${minutes}:${twoDigits(seconds)}` : `${hours}:${twoDigits(minutes)}:${twoDigits(seconds)}`
	return milliseconds === 0 ? `${sign}${text}` : `${sign}${text}.${threeDigits(milliseconds)}`
}

export type SegmentKey = 'A' | 'B' | 'C' | 'D'
export type PartKey = 'A1' | 'A2' | 'A3' | 'B1' | 'B2' | 'C1' | 'C2' | 'C3' | 'D1' | 'D2'

interface ReferenceSegment {
	segment: SegmentKey
	name: string
	/** Each part with its planned length in seconds */
	parts: ReadonlyArray<readonly [PartKey, number]>
}

export const REFERENCE_RUNDOWN: ReadonlyArray<ReferenceSegment> = [
	{
		segment: 'A',
		name: 'A Open',
		parts: [
			['A1', 10],
			['A2', 10],
			['A3', 10],
		],
	},
	{
		segment: 'B',
		name: 'B News',
		parts: [
			['B1', 20],
			['B2', 20],
		],
	},
	{
		segment: 'C',
		name: 'C Feature',
		parts: [
			['C1', 10],
			['C2', 20],
			['C3', 30],
		],
	},
	{
		segment: 'D',
		name: 'D Close',
		parts: [
			['D1', 10],
			['D2', 10],
		],
	},
]

/** The part attributes a variant can change */
export type PartAttributes = Partial<
	Pick<
		DBPart,
		| 'expectedDuration'
		| 'untimed'
		| 'autoNext'
		| 'autoNextOverlap'
		| 'displayDurationGroup'
		| 'displayDuration'
		| 'holdMode'
	>
>

/** Changes to the reference rundown that a test needs, named by segment and part key */
export interface RundownVariant {
	segments?: Partial<Record<SegmentKey, { segmentTiming?: SegmentTimingInfo }>>
	parts?: Partial<Record<PartKey, PartAttributes>>
}

export const REFERENCE_PLAYLIST_ID = protectString<RundownPlaylistId>('referencePlaylist')
export const REFERENCE_RUNDOWN_ID = protectString<RundownId>('referenceRundown')

/** Insert the reference rundown, with the changes a variant names, into the mock collections */
export async function setupReferenceRundown(
	context: MockJobContext,
	options: { timing: RundownPlaylistTiming; variant?: RundownVariant }
): Promise<void> {
	const showStyle = await setupMockShowStyleCompound(context)

	await context.mockCollections.RundownPlaylists.insertOne({
		...defaultRundownPlaylist(REFERENCE_PLAYLIST_ID, context.studioId),
		name: 'Reference playlist',
		timing: options.timing,
		rundownIdsInOrder: [REFERENCE_RUNDOWN_ID],
	})

	const rundown: DBRundown = {
		...defaultRundown(
			'referenceRundown',
			context.studioId,
			null,
			REFERENCE_PLAYLIST_ID,
			showStyle._id,
			showStyle.showStyleVariantId
		),
		_id: REFERENCE_RUNDOWN_ID,
		name: 'Reference rundown',
	}
	await context.mockCollections.Rundowns.insertOne(rundown)

	for (const [segmentRank, segmentRow] of REFERENCE_RUNDOWN.entries()) {
		const segmentId = protectString<SegmentId>(segmentRow.segment)
		const segment: DBSegment = {
			_id: segmentId,
			_rank: segmentRank,
			externalId: segmentRow.segment,
			rundownId: rundown._id,
			name: segmentRow.name,
			...options.variant?.segments?.[segmentRow.segment],
		}
		await context.mockCollections.Segments.insertOne(segment)

		for (const [partRank, [partKey, seconds]] of segmentRow.parts.entries()) {
			const partChanges = options.variant?.parts?.[partKey]
			const expectedDuration =
				partChanges && 'expectedDuration' in partChanges ? partChanges.expectedDuration : seconds * SECOND
			const part: DBPart = {
				_id: protectString<PartId>(partKey),
				rundownId: rundown._id,
				segmentId,
				_rank: partRank,
				externalId: partKey,
				title: partKey,
				...partChanges,
				expectedDuration,
				// No pieces, so no transition changes the length
				expectedDurationWithTransition: expectedDuration,
			}
			await context.mockCollections.Parts.insertOne(part)
		}
	}
}
