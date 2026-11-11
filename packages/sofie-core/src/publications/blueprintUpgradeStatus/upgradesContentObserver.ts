import { logger } from '../../logging'
import {
	blueprintFieldSpecifier,
	ContentCache,
	coreSystemFieldsSpecifier,
	showStyleFieldSpecifier,
	studioFieldSpecifier,
} from './reactiveContentCache'
import { Blueprints, CoreSystem, ShowStyleBases, Studios } from '../../collections'

export class UpgradesContentObserver {
	readonly #cache: ContentCache

	private constructor(cache: ContentCache) {
		this.#cache = cache
	}

	static async create(cache: ContentCache, signal: AbortSignal): Promise<UpgradesContentObserver> {
		logger.silly(`Creating UpgradesContentObserver`)

		await Promise.all([
			CoreSystem.observeChanges({}, cache.CoreSystem.link(), {
				projection: coreSystemFieldsSpecifier,
				signal,
			}),
			Studios.observeChanges({}, cache.Studios.link(), {
				projection: studioFieldSpecifier,
				signal,
			}),
			ShowStyleBases.observeChanges({}, cache.ShowStyleBases.link(), {
				projection: showStyleFieldSpecifier,
				signal,
			}),
			Blueprints.observeChanges({}, cache.Blueprints.link(), {
				projection: blueprintFieldSpecifier,
				signal,
			}),
		])

		return new UpgradesContentObserver(cache)
	}

	public get cache(): ContentCache {
		return this.#cache
	}
}
