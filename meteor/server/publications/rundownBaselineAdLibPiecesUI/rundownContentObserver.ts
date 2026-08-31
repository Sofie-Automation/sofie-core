import { RundownId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ReadonlyDeep } from 'type-fest'
import { logger } from '../../logging'
import { ContentCache, rundownBaselineAdLibPieceFieldSpecifier } from './reactiveContentCache'
import { RundownBaselineAdLibPieces } from '../../collections'
import { waitForAllObserversReady } from '../lib/lib'
import type { LiveQueryHandleSync } from '../../lib/lib'

export interface UIRundownBaselineAdLibPiecesArgs {
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
		args: ReadonlyDeep<UIRundownBaselineAdLibPiecesArgs>,
		cache: ContentCache
	): Promise<RundownContentObserver> {
		logger.silly(`Creating RundownContentObserver for rundowns "${args.rundownIds.join(',')}"`)

		const observers = await waitForAllObserversReady([
			RundownBaselineAdLibPieces.observeChanges(
				{
					rundownId: { $in: args.rundownIds },
				},
				cache.RundownBaselineAdLibPieces.link(),
				{
					projection: rundownBaselineAdLibPieceFieldSpecifier,
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
