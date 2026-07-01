/**
 * Detect whether a publication handler returned a Mongo cursor (rather than a custom publication that
 * drives the context directly and returns void/null).
 * Matches Sofie's `MinimalMongoCursor` (`observeChangesAsync`).
 */
export function isCursorLike(value: unknown): boolean {
	if (!value || typeof value !== 'object') return false
	const candidate = value as { observeChangesAsync?: unknown }
	return typeof candidate.observeChangesAsync === 'function'
}
