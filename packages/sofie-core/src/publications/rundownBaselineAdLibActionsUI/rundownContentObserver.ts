import { createBrandingObservers } from '../lib/branding'
import { RundownId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ReadonlyDeep } from 'type-fest'
import { logger } from '../../logging'
import { ContentCache, rundownBaselineAdLibActionFieldSpecifier } from './reactiveContentCache'
import { RundownBaselineAdLibActions } from '../../collections'

export interface UIRundownBaselineAdLibActionsArgs {
	readonly rundownIds: RundownId[]
}

export class RundownContentObserver {
	readonly #cache: ContentCache

	private constructor(cache: ContentCache) {
		this.#cache = cache
	}

	static async create(
		args: ReadonlyDeep<UIRundownBaselineAdLibActionsArgs>,
		cache: ContentCache,
		signal: AbortSignal
	): Promise<RundownContentObserver> {
		logger.silly(`Creating RundownContentObserver for rundowns "${args.rundownIds.join(',')}"`)

		await Promise.all([
			RundownBaselineAdLibActions.observeChanges(
				{
					rundownId: { $in: args.rundownIds as RundownId[] },
				},
				cache.RundownBaselineAdLibActions.link(),
				{
					projection: rundownBaselineAdLibActionFieldSpecifier,
					signal,
				}
			),
			...createBrandingObservers(args.rundownIds, cache, signal),
		])

		return new RundownContentObserver(cache)
	}

	public get cache(): ContentCache {
		return this.#cache
	}
}
