import { createBrandingObservers, getBrandingRundownIdsForPart } from '../lib/branding'
import { PartId, RundownId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { AdLibPiece } from '@sofie-automation/corelib/dist/dataModel/AdLibPiece'
import { MongoQuery } from '@sofie-automation/corelib/dist/mongo'
import { ReadonlyDeep } from 'type-fest'
import { logger } from '../../logging'
import { ContentCache, adLibPieceFieldSpecifier } from './reactiveContentCache'
import { AdLibPieces } from '../../collections'

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

	private constructor(cache: ContentCache) {
		this.#cache = cache
	}

	static async create(
		args: ReadonlyDeep<UIAdLibPiecesArgs>,
		cache: ContentCache,
		signal: AbortSignal
	): Promise<RundownContentObserver> {
		logger.silly(`Creating RundownContentObserver for adLibPieces "${args.type}"`)

		// Note: this must be resolved before any observer is created, so that a failure cannot leak one
		const brandingRundownIds =
			args.type === 'inRundowns' ? args.rundownIds : await getBrandingRundownIdsForPart(args.partId)

		await Promise.all([
			AdLibPieces.observeChanges(createAdLibPiecesSelector(args), cache.AdLibPieces.link(), {
				projection: adLibPieceFieldSpecifier,
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
