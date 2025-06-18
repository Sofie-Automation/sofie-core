import { Meteor } from 'meteor/meteor'
import { logger } from '../../logging'
import {
	blueprintFieldSpecifier,
	ContentCache,
	coreSystemFieldsSpecifier,
	showStyleFieldSpecifier,
	studioFieldSpecifier,
} from './reactiveContentCache'
import { Blueprints, CoreSystem, ShowStyleBases, Studios } from '../../collections'
import { waitForAllObserversReady } from '../lib/lib'

export class UpgradesContentObserver {
	readonly #cache: ContentCache
	readonly #observers: Meteor.LiveQueryHandle[]

	constructor(cache: ContentCache, observers: Meteor.LiveQueryHandle[]) {
		this.#cache = cache
		this.#observers = observers
	}

	static async create(cache: ContentCache): Promise<UpgradesContentObserver> {
		logger.silly(`Creating UpgradesContentObserver`)

		const observers = await waitForAllObserversReady([
			CoreSystem.observeChanges({}, cache.CoreSystem.link(), {
				projection: coreSystemFieldsSpecifier,
			}),
			Studios.observeChanges({}, cache.Studios.link(), {
				projection: studioFieldSpecifier,
			}),
			ShowStyleBases.observeChanges({}, cache.ShowStyleBases.link(), {
				projection: showStyleFieldSpecifier,
			}),
			Blueprints.observeChanges({}, cache.Blueprints.link(), {
				projection: blueprintFieldSpecifier,
			}),
		])

		return new UpgradesContentObserver(cache, observers)
	}

	public get cache(): ContentCache {
		return this.#cache
	}

	public stop = (): void => {
		this.#observers.forEach((observer) => observer.stop())
	}
}
