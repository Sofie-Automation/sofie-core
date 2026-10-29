import { CountdownType, PartHoldMode, type RundownPlaylistTiming } from '@sofie-automation/blueprints-integration'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import {
	budget,
	clock,
	formatClock,
	formatLength,
	length,
	REFERENCE_DAY,
	REFERENCE_PLAYLIST_ID,
	REFERENCE_RUNDOWN_ID,
	referenceRundown,
	type ReferenceRundown,
	TIMING_MODES,
} from './lib/referenceRundown'

/** Each segment as 'segment rank n (part length, ...)' */
function describeSegments(rundown: ReferenceRundown): string[] {
	return rundown.segments.map((segment) => {
		const parts = rundown.parts
			.filter((part) => part.segmentId === segment._id)
			.map((part) => `${part._id} ${formatLength(part.expectedDuration ?? 0)}`)
		return `${segment._id} rank ${segment._rank} (${parts.join(', ')})`
	})
}

/** The planned length of the given parts, summed */
function sumOfLengths(rundown: ReferenceRundown, segmentId?: string): string {
	const parts = rundown.parts.filter(
		(part) => segmentId === undefined || unprotectString(part.segmentId) === segmentId
	)
	return formatLength(parts.reduce((sum, part) => sum + (part.expectedDuration ?? 0), 0))
}

describe('the reference rundown', () => {
	it('is four segments and ten parts, 2:30 in all', () => {
		const rundown = referenceRundown()

		expect(describeSegments(rundown)).toEqual([
			'A rank 0 (A1 0:10, A2 0:10, A3 0:10)',
			'B rank 1 (B1 0:20, B2 0:20)',
			'C rank 2 (C1 0:10, C2 0:20, C3 0:30)',
			'D rank 3 (D1 0:10, D2 0:10)',
		])
		expect(['A', 'B', 'C', 'D'].map((segment) => sumOfLengths(rundown, segment))).toEqual([
			'0:30',
			'0:40',
			'1:00',
			'0:20',
		])
		expect(sumOfLengths(rundown)).toBe('2:30')
	})

	it('is one rundown, with the plain keys as ids, part ranks that restart in each segment, and no transitions', () => {
		const rundown = referenceRundown()

		expect(rundown.rundowns.map((doc) => [doc._id, doc.playlistId])).toEqual([
			[REFERENCE_RUNDOWN_ID, REFERENCE_PLAYLIST_ID],
		])
		expect(rundown.parts.map((part) => `${part._id} in ${part.segmentId}, rank ${part._rank}`)).toEqual([
			'A1 in A, rank 0',
			'A2 in A, rank 1',
			'A3 in A, rank 2',
			'B1 in B, rank 0',
			'B2 in B, rank 1',
			'C1 in C, rank 0',
			'C2 in C, rank 1',
			'C3 in C, rank 2',
			'D1 in D, rank 0',
			'D2 in D, rank 1',
		])
		for (const segment of rundown.segments) expect(segment.rundownId).toBe(REFERENCE_RUNDOWN_ID)
		for (const part of rundown.parts) {
			expect(part.expectedDurationWithTransition).toBe(part.expectedDuration)
			expect(part.rundownId).toBe(REFERENCE_RUNDOWN_ID)
		}
	})

	it('changes the segments and parts a variant names, and nothing else', () => {
		const plain = referenceRundown()
		const changed = referenceRundown({
			segments: { C: budget('1:30') },
			parts: {
				B1: { holdMode: PartHoldMode.FROM },
				C2: { expectedDuration: undefined, untimed: true },
				D1: { expectedDuration: length('0:09.800'), autoNext: true },
			},
		})

		expect(changed.segments.map((segment) => segment.segmentTiming)).toEqual([
			undefined,
			undefined,
			{ budgetDuration: 90000, countdownType: CountdownType.SEGMENT_BUDGET_DURATION },
			undefined,
		])
		const byId = (rundown: ReferenceRundown, id: string) =>
			rundown.parts.find((part) => unprotectString(part._id) === id)
		expect(byId(changed, 'B1')).toEqual({ ...byId(plain, 'B1'), holdMode: PartHoldMode.FROM })
		expect(byId(changed, 'C2')).toEqual({
			...byId(plain, 'C2'),
			untimed: true,
			expectedDuration: undefined,
			expectedDurationWithTransition: undefined,
		})
		expect(byId(changed, 'D1')).toEqual({
			...byId(plain, 'D1'),
			autoNext: true,
			expectedDuration: 9800,
			expectedDurationWithTransition: 9800,
		})
		expect(changed.parts.filter((part) => !['B1', 'C2', 'D1'].includes(unprotectString(part._id)))).toEqual(
			plain.parts.filter((part) => !['B1', 'C2', 'D1'].includes(unprotectString(part._id)))
		)

		expect(budget('0:40', CountdownType.PART_EXPECTED_DURATION)).toEqual({
			segmentTiming: { budgetDuration: 40000, countdownType: CountdownType.PART_EXPECTED_DURATION },
		})
	})
})

describe('clock times and lengths', () => {
	it('reads clock times on the reference day, and prints them back', () => {
		expect(clock('00:00:00')).toBe(REFERENCE_DAY)
		expect(clock('12:00:10.200') - clock('12:00:10')).toBe(200)
		expect(formatClock(clock('12:00:05'))).toBe('12:00:05')
		expect(formatClock(clock('12:00:05.030'))).toBe('12:00:05.030')
		expect(formatClock(clock('23:59:59.999'))).toBe('23:59:59.999')
	})

	it('prints a time on any other day in full', () => {
		expect(formatClock(REFERENCE_DAY - 1)).toBe('2026-01-04T23:59:59.999Z')
		expect(formatClock(REFERENCE_DAY + 24 * 60 * 60 * 1000)).toBe('2026-01-06T00:00:00.000Z')
		expect(formatClock(0)).toBe('1970-01-01T00:00:00.000Z')
	})

	it('reads lengths, and prints them back with a sign and from one hour with hours', () => {
		expect(length('2:30')).toBe(150000)
		expect(length('0:09.800')).toBe(9800)
		expect(formatLength(length('2:30'))).toBe('2:30')
		expect(formatLength(-length('0:09.800'))).toBe('-0:09.800')
		expect(formatLength(length('61:01'))).toBe('1:01:01')
		expect(formatLength(0)).toBe('0:00')
		expect(formatLength(-0)).toBe('0:00')
	})

	it('refuses text it cannot read, and values that are not whole milliseconds', () => {
		expect(() => clock('12:00')).toThrow('"12:00" is not a clock time like 12:00:10 or 12:00:10.200')
		expect(() => clock('12:00:10.2')).toThrow()
		expect(() => length('2:3')).toThrow('"2:3" is not a length like 2:30 or 0:09.800')
		expect(() => length('-0:05')).toThrow()
		expect(() => formatClock(clock('12:00:00') + 0.5)).toThrow('is not a whole number of milliseconds')
		expect(() => formatLength(0.5)).toThrow('Length 0.5 is not a whole number of milliseconds')
	})
})

describe('the timing modes', () => {
	/** A playlist timing as 'type  start ..  duration ..  end ..', with only the fields it has */
	function describeTiming(timing: RundownPlaylistTiming): string {
		const fields: string[] = [timing.type]
		if ('expectedStart' in timing && timing.expectedStart !== undefined) {
			fields.push(`start ${formatClock(timing.expectedStart)}`)
		}
		if (timing.expectedDuration !== undefined) fields.push(`duration ${formatLength(timing.expectedDuration)}`)
		if ('expectedEnd' in timing && timing.expectedEnd !== undefined) {
			fields.push(`end ${formatClock(timing.expectedEnd)}`)
		}
		return fields.join('  ')
	}

	it('are the twelve playlist timings the tests compare', () => {
		expect(TIMING_MODES.map((mode) => `${mode.name}: ${describeTiming(mode.timing)}`)).toEqual([
			'none: none',
			'none 2:30: none  duration 2:30',
			'none 3:00: none  duration 3:00',
			'none 2:00: none  duration 2:00',
			'forward start: forward-time  start 12:00:00',
			'forward start+duration: forward-time  start 12:00:00  duration 2:30',
			'forward start+end: forward-time  start 12:00:00  end 12:02:30',
			'back end: back-time  end 12:02:30',
			'back end+duration: back-time  duration 2:30  end 12:02:30',
			'back start+end: back-time  start 12:00:00  end 12:02:30',
			'duration 2:30: duration  duration 2:30',
			'duration start+duration: duration  start 12:00:00  duration 2:30',
		])
	})
})
