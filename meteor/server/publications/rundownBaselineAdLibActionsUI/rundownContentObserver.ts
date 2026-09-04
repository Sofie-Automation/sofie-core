import { RundownId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ReadonlyDeep } from 'type-fest'
import { logger } from '../../logging'
import { ContentCache, rundownBaselineAdLibActionFieldSpecifier } from './reactiveContentCache'
import { RundownBaselineAdLibActions } from '../../collections'
import { waitForAllObserversReady } from '../lib/lib'
import type { LiveQueryHandleSync } from '../../lib/lib'

export interface UIRundownBaselineAdLibActionsArgs {
	readonly rundownIds: RundownId[]
}

export class RundownContentObserver {
	readonly #cache: ContentCache
	readonly #observers: LiveQueryHandleSync[]

	private constructor(cache: ContentCache, observers: LiveQueryHandleSync[]) {
		this.#cache = cache

		this.#observers = observers
	}

	static async create(
		args: ReadonlyDeep<UIRundownBaselineAdLibActionsArgs>,
		cache: ContentCache
	): Promise<RundownContentObserver> {
		logger.silly(`Creating RundownContentObserver for rundowns "${args.rundownIds.join(',')}"`)

		const observers = await waitForAllObserversReady([
			RundownBaselineAdLibActions.observeChanges(
				{
					rundownId: { $in: args.rundownIds as RundownId[] },
				},
				cache.RundownBaselineAdLibActions.link(),
				{
					projection: rundownBaselineAdLibActionFieldSpecifier,
				}
			),
		])

		return new RundownContentObserver(cache, observers)
	}

	public get cache(): ContentCache {
		return this.#cache
	}

	public dispose = (): void => {
		this.#observers.forEach((observer) => observer.stop())
	}
}
