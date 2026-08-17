import { PublicationRegistry } from '../../server/publicationRegistry'
import { registerAllPublications } from '../../server/publicationRegistrations'

/**
 * Test helper: register all DDP publications on a fresh PublicationRegistry and apply them to the
 * (mock) Meteor server, mirroring what `main.ts` does at startup.
 *
 * Call this in suites that exercise Meteor subscriptions. It is needed because the production
 * registration now only runs explicitly from `main.ts`, rather than as an import-time side effect of
 * each publication file.
 */
export function registerAllPublicationsForTest(): PublicationRegistry {
	const registry = new PublicationRegistry()
	registerAllPublications(registry)
	registry.applyToMeteor()
	return registry
}
