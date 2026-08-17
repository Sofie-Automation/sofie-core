import { MethodApiRegistration, MethodRegistry } from '../methodRegistry'
import { METHOD_REGISTRATIONS, registerAllApiMethods } from '../methodRegistrations'

describe('MethodRegistry', () => {
	test('registers all API methods without error', () => {
		const registry = new MethodRegistry()
		// registerApi throws if a class method has no matching wire name, so this is itself an assertion
		// that every implemented method maps to an enum entry (the historical behaviour).
		expect(() => registerAllApiMethods(registry)).not.toThrow()
	})

	test('registered names are unique and only use known wire names', () => {
		const registry = new MethodRegistry()
		registerAllApiMethods(registry)
		const names = registry.getAllMethodNames()

		// No duplicate registrations across all APIs
		expect(new Set(names).size).toBe(names.length)

		// Every non-debug registered name must be a value from one of the method-name enums.
		// (Debug methods are not enum-backed and are checked separately.)
		const enumWireNames = new Set<string>()
		for (const reg of Object.values<MethodApiRegistration<any>>(METHOD_REGISTRATIONS)) {
			for (const wireName of Object.values<string>(reg.methods)) enumWireNames.add(wireName)
		}
		for (const name of names) {
			if (registry.isDebugMethod(name)) continue
			expect(enumWireNames.has(name)).toBe(true)
		}

		// A handful of representative names must be present, guarding against an API silently
		// dropping out of the registry.
		expect(names).toEqual(
			expect.arrayContaining([
				'userAction.take',
				'playout.updateStudioBaseline',
				'peripheralDevice.initialize',
				'system.cleanupIndexes',
			])
		)
	})

	test('the full set of registered method names is stable (drift guard)', () => {
		const registry = new MethodRegistry()
		registerAllApiMethods(registry)
		// If this snapshot changes, a method's wire name was added, removed or renamed. That must be a
		// deliberate change reviewed against the clients that depend on these exact names.
		expect([...registry.getAllMethodNames()].sort()).toMatchSnapshot()
	})
})
