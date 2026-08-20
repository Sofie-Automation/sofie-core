import { z } from 'zod'
import { SofieError } from '@sofie-automation/corelib/dist/error'

let checkDisabled = false

/**
 * Format a zod error into a single-line, client-safe message.
 *
 * Note that zod's issue messages describe the *expected* type and the *received type* - never the received
 * value - so this is safe to send across the DDP/HTTP boundary without leaking payload contents.
 */
function formatError(error: z.ZodError): string {
	return error.issues
		.map((issue) => (issue.path.length > 0 ? `${issue.message} in field ${issue.path.join('.')}` : issue.message))
		.join('; ')
}

/**
 * Assert that a value matches a schema, throwing a client-safe `SofieError` if it does not.
 *
 * This is the replacement for Meteor's `check()`. The `Match error: ` prefix is retained from Meteor's
 * wording so that log filters and error matching keep working.
 *
 * Note: this deliberately does not narrow the type of `value`. Meteor's `check` asserted
 * `value is Match.PatternMatch<T>`, which degraded the branded `ProtectedString` id types at the call site
 * (`asserts value is string` on a `RundownPlaylistId` throws the brand away), so the assertion was stripped.
 * The same reasoning applies here.
 *
 * TODO (follow-up): these are ~670 inline calls in handler bodies, which means nothing guarantees that a
 * method or publication validates its arguments at all - it is convention, not structure. See the follow-up
 * note on `MethodApiRegistration` in ../methodRegistry.ts for moving schemas onto the registrations.
 */
export function check(value: unknown, schema: z.ZodType): void {
	if (checkDisabled) return

	const result = schema.safeParse(value)
	if (!result.success) {
		throw new SofieError(400, `Match error: ${formatError(result.error)}`)
	}
}

/**
 * A plain object with any keys, the equivalent of Meteor's `Object` pattern (which desugared to
 * `Match.ObjectIncluding({})`). Like Meteor's, this rejects arrays and `null`.
 *
 * Shared instance rather than a factory, as several of the call sites are on hot paths where allocating a
 * schema per call would be wasteful.
 */
export const zPlainObject = z.looseObject({})

/** An array with elements of any type, the equivalent of Meteor's `Array` pattern. */
export const zAnyArray = z.array(z.unknown())

/**
 * Disable all `check()` calls process-wide.
 *
 * Used only by the `securityVerify` startup audit, which invokes every registered method with junk arguments
 * to confirm each one performs an access check - argument validation has to be out of the way for that to
 * reach the access check. Note this is a global mutable flag, so it is not concurrency-safe.
 */
export function disableChecks(): void {
	checkDisabled = true
}
export function enableChecks(): void {
	checkDisabled = false
}
