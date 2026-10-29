import {
	CountdownType,
	PlaylistTimingType,
	type RundownPlaylistTiming,
	type SegmentTimingInfo,
} from '@sofie-automation/blueprints-integration'
import type {
	PartId,
	RundownId,
	RundownPlaylistId,
	SegmentId,
	ShowStyleBaseId,
	ShowStyleVariantId,
	StudioId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import type { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import type { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import type { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { protectString, unprotectString } from '@sofie-automation/corelib/dist/protectedString'

/**
 * The reference rundown for the timing tests: four segments, ten parts, 2:30 in all.
 *
 *   A Open     A1 0:10  A2 0:10  A3 0:10
 *   B News     B1 0:20  B2 0:20
 *   C Feature  C1 0:10  C2 0:20  C3 0:30
 *   D Close    D1 0:10  D2 0:10
 *
 * Test code is not built into any package, so the tests of another package cannot import this file. A package
 * whose tests need the same rundown keeps its own copy of this table, and the copies are changed together.
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

/** A segment budget, as a variant writes it: `{ segments: { C: budget('1:30') } }` */
export function budget(
	budgetLength: string,
	countdownType: CountdownType = CountdownType.SEGMENT_BUDGET_DURATION
): { segmentTiming: SegmentTimingInfo } {
	return { segmentTiming: { budgetDuration: length(budgetLength), countdownType } }
}

export const REFERENCE_STUDIO_ID = protectString<StudioId>('referenceStudio')
export const REFERENCE_PLAYLIST_ID = protectString<RundownPlaylistId>('referencePlaylist')
export const REFERENCE_RUNDOWN_ID = protectString<RundownId>('referenceRundown')

/** The reference rundown as the documents playout and the publication read */
export interface ReferenceRundown {
	/** The rundowns of the playlist, in playlist order: only the reference rundown */
	rundowns: DBRundown[]
	/** The segments, in playlist order */
	segments: DBSegment[]
	/** The parts, in playlist order */
	parts: DBPart[]
}

/** Build the reference rundown, with the changes a variant names */
export function referenceRundown(variant?: RundownVariant): ReferenceRundown {
	const rundown: DBRundown = {
		_id: REFERENCE_RUNDOWN_ID,
		externalId: unprotectString(REFERENCE_RUNDOWN_ID),
		name: 'Reference rundown',
		studioId: REFERENCE_STUDIO_ID,
		showStyleBaseId: protectString<ShowStyleBaseId>('referenceShowStyle'),
		showStyleVariantId: protectString<ShowStyleVariantId>('referenceShowStyleVariant'),
		playlistId: REFERENCE_PLAYLIST_ID,
		source: { type: 'http' },
		created: REFERENCE_DAY,
		modified: REFERENCE_DAY,
		importVersions: { studio: '', showStyleBase: '', showStyleVariant: '', blueprint: '', core: '' },
		// The playlist's timing is what the timing tests set; the rundown's own is not read
		timing: { type: PlaylistTimingType.None },
	}
	const result: ReferenceRundown = { rundowns: [rundown], segments: [], parts: [] }

	for (const [segmentRank, segmentRow] of REFERENCE_RUNDOWN.entries()) {
		const segmentId = protectString<SegmentId>(segmentRow.segment)
		result.segments.push({
			_id: segmentId,
			_rank: segmentRank,
			externalId: segmentRow.segment,
			rundownId: rundown._id,
			name: segmentRow.name,
			...variant?.segments?.[segmentRow.segment],
		})

		for (const [partRank, [partKey, seconds]] of segmentRow.parts.entries()) {
			const partChanges = variant?.parts?.[partKey]
			const expectedDuration =
				partChanges && 'expectedDuration' in partChanges ? partChanges.expectedDuration : seconds * SECOND
			result.parts.push({
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
			})
		}
	}

	return result
}

const PLANNED_START = clock('12:00:00')
const PLANNED_END = clock('12:02:30')
const PLANNED_DURATION = length('2:30')

/**
 * The playlist timings the timing tests compare, each named the way the tests name it. Every planned start is
 * 12:00:00, every planned end 12:02:30 and every planned duration 2:30, unless the name says otherwise
 */
export const TIMING_MODES = [
	{ name: 'none', timing: { type: PlaylistTimingType.None } },
	{ name: 'none 2:30', timing: { type: PlaylistTimingType.None, expectedDuration: PLANNED_DURATION } },
	{ name: 'none 3:00', timing: { type: PlaylistTimingType.None, expectedDuration: length('3:00') } },
	{ name: 'none 2:00', timing: { type: PlaylistTimingType.None, expectedDuration: length('2:00') } },
	{ name: 'forward start', timing: { type: PlaylistTimingType.ForwardTime, expectedStart: PLANNED_START } },
	{
		name: 'forward start+duration',
		timing: {
			type: PlaylistTimingType.ForwardTime,
			expectedStart: PLANNED_START,
			expectedDuration: PLANNED_DURATION,
		},
	},
	{
		name: 'forward start+end',
		timing: { type: PlaylistTimingType.ForwardTime, expectedStart: PLANNED_START, expectedEnd: PLANNED_END },
	},
	{ name: 'back end', timing: { type: PlaylistTimingType.BackTime, expectedEnd: PLANNED_END } },
	{
		name: 'back end+duration',
		timing: { type: PlaylistTimingType.BackTime, expectedEnd: PLANNED_END, expectedDuration: PLANNED_DURATION },
	},
	{
		name: 'back start+end',
		timing: { type: PlaylistTimingType.BackTime, expectedStart: PLANNED_START, expectedEnd: PLANNED_END },
	},
	{ name: 'duration 2:30', timing: { type: PlaylistTimingType.Duration, expectedDuration: PLANNED_DURATION } },
	{
		name: 'duration start+duration',
		timing: {
			type: PlaylistTimingType.Duration,
			expectedStart: PLANNED_START,
			expectedDuration: PLANNED_DURATION,
		},
	},
] as const satisfies ReadonlyArray<{ name: string; timing: RundownPlaylistTiming }>

export type TimingModeName = (typeof TIMING_MODES)[number]['name']
