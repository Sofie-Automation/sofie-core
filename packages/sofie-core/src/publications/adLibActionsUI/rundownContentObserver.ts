import { createBrandingObservers, getBrandingRundownIdsForPart } from '../lib/branding'
import { PartId, RundownId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { AdLibAction } from '@sofie-automation/corelib/dist/dataModel/AdlibAction'
import { MongoQuery } from '@sofie-automation/corelib/dist/mongo'
import { ReadonlyDeep } from 'type-fest'
import { logger } from '../../logging'
import { ContentCache, adLibActionFieldSpecifier } from './reactiveContentCache'
import { AdLibActions } from '../../collections'

/**
 * The AdLibActions to fetch. These are two rather different queries, but they feed the same collection so
 * that consumers (and any transformation of the documents) don't have to care which produced a given
 * AdLibAction.
 */
export type UIAdLibActionsArgs =
	| {
			readonly type: 'inRundowns'
			readonly rundownIds: RundownId[]
	  }
	| {
			readonly type: 'forPart'
			readonly partId: PartId
			readonly sourceLayerIds: string[]
	  }

function createAdLibActionsSelector(args: ReadonlyDeep<UIAdLibActionsArgs>): MongoQuery<AdLibAction> {
	switch (args.type) {
		case 'inRundowns':
			return {
				rundownId: { $in: args.rundownIds as RundownId[] },
			}
		case 'forPart':
			return {
				partId: args.partId,
				'display.sourceLayerId': { $in: args.sourceLayerIds as string[] },
			}
	}
}

export class RundownContentObserver {
	readonly #cache: ContentCache

	private constructor(cache: ContentCache) {
		this.#cache = cache
	}

	static async create(
		args: ReadonlyDeep<UIAdLibActionsArgs>,
		cache: ContentCache,
		signal: AbortSignal
	): Promise<RundownContentObserver> {
		logger.silly(`Creating RundownContentObserver for adLibActions "${args.type}"`)

		// Note: this must be resolved before any observer is created, so that a failure cannot leak one
		const brandingRundownIds =
			args.type === 'inRundowns' ? args.rundownIds : await getBrandingRundownIdsForPart(args.partId)

		await Promise.all([
			AdLibActions.observeChanges(createAdLibActionsSelector(args), cache.AdLibActions.link(), {
				projection: adLibActionFieldSpecifier,
				signal,
			}),
			...createBrandingObservers(brandingRundownIds, cache, signal),
		])

		return new RundownContentObserver(cache)
	}

	public get cache(): ContentCache {
		return this.#cache
	}
}
