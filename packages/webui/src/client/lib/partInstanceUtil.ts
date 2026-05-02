import type { DBPart, PartInvalidReason } from '@sofie-automation/corelib/dist/dataModel/Part'

/**
 * Minimal interface for a PartInstance containing the properties needed for invalidReason checks.
 */
export interface PartInstanceLike {
	part: Pick<DBPart, 'invalid' | 'invalidReason'>
	invalidReason?: PartInvalidReason
}

export interface PartInvalidReasonExt extends PartInvalidReason {
	/**
	 * If this invalid reason came from the instance (playout) rather than the part (ingest)
	 */
	isInstanceInvalid: boolean
}

/**
 * Get the effective invalidReason for a PartInstance.
 *
 * If the Part has a planned invalidReason (from ingest), it takes precedence.
 * Otherwise, returns the runtime invalidReason from the PartInstance (from playout).
 *
 * This distinction matters because:
 * - Part.invalidReason is planned/static (set during ingest, shouldn't create real PartInstance)
 * - PartInstance.invalidReason is runtime/dynamic (set during playout, can be fixed)
 *
 * @param partInstance The PartInstance object
 * @returns The effective invalidReason to display, or undefined if none
 */
export function getEffectiveInvalidReason(partInstance: PartInstanceLike): PartInvalidReasonExt | undefined {
	// Planned invalidReason (from Part/ingest) takes precedence
	// It shouldn't be possible to create a real PartInstance of an invalid Part
	if (partInstance.part.invalidReason) {
		return {
			...partInstance.part.invalidReason,
			isInstanceInvalid: false,
		}
	}

	// Runtime invalidReason (from PartInstance/playout)
	if (partInstance.invalidReason) {
		return {
			...partInstance.invalidReason,
			isInstanceInvalid: true,
		}
	}

	return undefined
}

/**
 * Check if the effective state is "invalid" for a PartInstance.
 *
 * A PartInstance is considered invalid if either:
 * - The Part has `invalid: true` (planned invalid, may not have an invalidReason)
 * - The PartInstance has a runtime invalidReason (runtime invalid)
 *
 * Note: This is separate from getEffectiveInvalidReason because part.invalid can be true
 * without an invalidReason being set (legacy behavior).
 *
 * @param partInstance The PartInstance object
 * @returns true if the part should be shown as invalid
 */
export function isPartInstanceInvalid(partInstance: PartInstanceLike): boolean {
	return !!partInstance.part.invalid || !!partInstance.invalidReason
}
