/**
 * This file contains some temporary re-exports of code that has been moved.
 * It should be removed entirely, but requires a bit of effort to update the hundreds of references to this file.
 */

// Legacy compatibility
// Note: These have to be named explicitly, to satisfy Vite
export type { Time, TimeDuration } from '@sofie-automation/shared-lib/dist/lib/lib'
export type { ProtectedString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
export {
	protectString,
	unprotectString,
	isProtectedString,
} from '@sofie-automation/shared-lib/dist/lib/protectedString'
export {
	stringifyObjects,
	normalizeArray,
	clone,
	assertNever,
	literal,
	applyToArray,
	omit,
	getRandomId,
	normalizeArrayToMap,
	getRandomString,
	flatten,
	groupByToMap,
	groupByToMapFunc,
	formatDurationAsTimecode,
	formatDateAsTimecode,
	generateTranslation,
} from '@sofie-automation/corelib/dist/lib'
export type { Complete } from '@sofie-automation/corelib/dist/lib'
export { LogLevel } from '@sofie-automation/meteor-lib/dist/lib'
