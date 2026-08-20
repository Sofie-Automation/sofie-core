import { PublicationRegistry } from '../publicationRegistry'
import { registerAllPublications } from '../publicationRegistrations'
import { AllPubSubNames } from '@sofie-automation/meteor-lib/dist/api/pubsub'

describe('PublicationRegistry', () => {
	test('registers all publications without error', () => {
		const registry = new PublicationRegistry()
		// publishUnsafe throws on a duplicate name, so this is itself an assertion that no two
		// publications register under the same wire name.
		expect(() => registerAllPublications(registry)).not.toThrow()
	})

	test('registered names are unique and only use known publication names', () => {
		const registry = new PublicationRegistry()
		registerAllPublications(registry)
		const names = registry.getAllPublicationNames()

		// No duplicate registrations across all publication modules
		expect(new Set(names).size).toBe(names.length)

		// Every registered name must be a known PubSub name.
		const knownNames = new Set<string>(AllPubSubNames)
		for (const name of names) {
			expect(knownNames.has(name)).toBe(true)
		}

		// Conversely, every known PubSub name must be registered (the historical dev-mode check).
		for (const pubName of AllPubSubNames) {
			expect(names).toContain(pubName)
		}
	})

	test('the full set of registered publication names is stable (drift guard)', () => {
		const registry = new PublicationRegistry()
		registerAllPublications(registry)
		// If this snapshot changes, a publication's wire name was added, removed or renamed. That must
		// be a deliberate change reviewed against the clients that depend on these exact names.
		expect([...registry.getAllPublicationNames()].sort()).toMatchSnapshot()
	})
})
