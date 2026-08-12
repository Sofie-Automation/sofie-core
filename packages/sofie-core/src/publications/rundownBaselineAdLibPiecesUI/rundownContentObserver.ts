import { createBrandingObservers } from '../lib/branding'
import { RundownId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ReadonlyDeep } from 'type-fest'
import { logger } from '../../logging'
import { ContentCache, rundownBaselineAdLibPieceFieldSpecifier } from './reactiveContentCache'
import { RundownBaselineAdLibPieces } from '../../collections'

export interface UIRundownBaselineAdLibPiecesArgs {
	readonly rundownIds: RundownId[]
}

export class RundownContentObserver {
	readonly #cache: ContentCache

	private constructor(cache: ContentCache) {
		this.#cache = cache
	}

	static async create(
		args: ReadonlyDeep<UIRundownBaselineAdLibPiecesArgs>,
		cache: ContentCache,
		signal: AbortSignal
	): Promise<RundownContentObserver> {
		logger.silly(`Creating RundownContentObserver for rundowns "${args.rundownIds.join(',')}"`)

		await Promise.all([
			RundownBaselineAdLibPieces.observeChanges(
				{
					rundownId: { $in: args.rundownIds },
				},
				cache.RundownBaselineAdLibPieces.link(),
				{
					projection: rundownBaselineAdLibPieceFieldSpecifier,
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
