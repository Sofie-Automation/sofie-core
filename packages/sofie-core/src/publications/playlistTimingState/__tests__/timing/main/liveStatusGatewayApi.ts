/**
 * The types of the live status gateway's API that main's gateway timing helpers return, frozen for the comparison
 * with main: three of the type declarations of packages/live-status-gateway-api/src/generated/schema.ts at main
 * d40ae733fefdd831ce614792b65e8434778b2757, CurrentPartTiming, SegmentCountdownType and SegmentTiming, copied
 * unchanged but for the export keyword: the schema declares them without it and exports them in one list at its end.
 * They are copied as the server does not depend on the gateway's API package.
 */

/**
 * Timing information about the current part
 */
export interface CurrentPartTiming {
	/**
	 * Expected duration of the part (milliseconds)
	 */
	expectedDurationMs: number
	/**
	 * Unix timestamp of when the part started (milliseconds)
	 */
	startTime: number
	/**
	 * Unix timestamp of when the part is projected to end (milliseconds). A sum of `startTime` and `expectedDurationMs`.
	 */
	projectedEndTime: number
	additionalProperties?: Record<string, any>
}

/**
 * Countdown type within the segment. Default: `part_expected_duration`
 */
export enum SegmentCountdownType {
	PART_EXPECTED_DURATION = 'part_expected_duration',
	SEGMENT_BUDGET_DURATION = 'segment_budget_duration',
}

export interface SegmentTiming {
	/**
	 * Expected duration of the segment (milliseconds)
	 */
	expectedDurationMs: number
	/**
	 * Budget duration of the segment (milliseconds)
	 */
	budgetDurationMs?: number
	/**
	 * Countdown type within the segment. Default: `part_expected_duration`
	 */
	countdownType?: SegmentCountdownType
	additionalProperties?: Record<string, any>
}
