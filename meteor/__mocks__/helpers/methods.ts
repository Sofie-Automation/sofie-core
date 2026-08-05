import { MethodRegistry } from '../../server/methodRegistry'
import { registerAllApiMethods } from '../../server/methodRegistrations'

/**
 * Test helper: register all API methods on a fresh MethodRegistry and apply them to the (mock)
 * Meteor server, mirroring what `main.ts` does at startup.
 *
 * Call this in suites that exercise Meteor methods (via `MeteorCall`, `Meteor.callAsync`, or by
 * spying on `MeteorMock.mockMethods`). It is needed because the production registration now only
 * runs explicitly from `main.ts`, rather than as an import-time side effect of each API file.
 */
export function registerAllMethodsForTest(): MethodRegistry {
	const registry = new MethodRegistry()
	registerAllApiMethods(registry)
	registry.applyToMeteor()
	return registry
}
