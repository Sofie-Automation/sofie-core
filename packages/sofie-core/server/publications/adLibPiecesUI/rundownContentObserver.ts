import { PartId, RundownId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { AdLibPiece } from '@sofie-automation/corelib/dist/dataModel/AdLibPiece'
import { MongoQuery } from '@sofie-automation/corelib/dist/mongo'
import { ReadonlyDeep } from 'type-fest'
import { logger } from '../../logging'
import { ContentCache, adLibPieceFieldSpecifier } from './reactiveContentCache'
import { AdLibPieces } from '../../collections'
import { waitForAllObserversReady } from '../lib/lib'
import type { LiveQueryHandleSync } from '../../lib/lib'

/**
 * The AdLibPieces to fetch. These are two rather different queries, but they feed the same collection so
 * that consumers (and any transformation of the documents) don't have to care which produced a given
 * AdLibPiece.
 */
export type UIAdLibPiecesArgs =
	| {
			readonly type: 'inRundowns'
			readonly rundownIds: RundownId[]
	  }
	| {
			readonly type: 'forPart'
			readonly partId: PartId
			readonly sourceLayerIds: string[]
	  }

function createAdLibPiecesSelector(args: ReadonlyDeep<UIAdLibPiecesArgs>): MongoQuery<AdLibPiece> {
	switch (args.type) {
		case 'inRundowns':
			return {
				rundownId: { $in: args.rundownIds as RundownId[] },
			}
		case 'forPart':
			return {
				partId: args.partId,
				sourceLayerId: { $in: args.sourceLayerIds as string[] },
			}
	}
}

export class RundownContentObserver {
	readonly #cache: ContentCache
	readonly #observers: LiveQueryHandleSync[]

	private constructor(cache: ContentCache, observers: LiveQueryHandleSync[]) {
		this.#cache = cache

		this.#observers = observers
	}

	static async create(args: ReadonlyDeep<UIAdLibPiecesArgs>, cache: ContentCache): Promise<RundownContentObserver> {
		logger.silly(`Creating RundownContentObserver for adLibPieces "${args.type}"`)

		const observers = await waitForAllObserversReady([
			AdLibPieces.observeChanges(createAdLibPiecesSelector(args), cache.AdLibPieces.link(), {
				projection: adLibPieceFieldSpecifier,
			}),
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
