import { createBrandingObservers } from '../lib/branding'
import { PartId, RundownId, SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { Piece } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { PieceLifespan } from '@sofie-automation/blueprints-integration'
import { MongoQuery } from '@sofie-automation/corelib/dist/mongo'
import { ReadonlyDeep } from 'type-fest'
import { logger } from '../../logging'
import { ContentCache, pieceFieldSpecifier } from './reactiveContentCache'
import { Pieces } from '../../collections'
import { waitForAllObserversReady } from '../lib/lib'
import type { LiveQueryHandleSync } from '../../lib/lib'

/**
 * The Pieces to fetch. These are two rather different queries, but they feed the same collection so that
 * consumers (and any transformation of the documents) don't have to care which produced a given Piece.
 */
export type UIPiecesArgs =
	| {
			readonly type: 'inParts'
			readonly rundownIds: RundownId[]
			/** PartIds to limit the result to, or null for all */
			readonly partIds: PartId[] | null
	  }
	| {
			readonly type: 'infinitesStartingBefore'
			readonly thisRundownId: RundownId
			readonly segmentIdsBefore: SegmentId[]
			readonly rundownIdsBefore: RundownId[]
	  }

function createPiecesSelector(args: ReadonlyDeep<UIPiecesArgs>): MongoQuery<Piece> {
	switch (args.type) {
		case 'inParts': {
			const selector: MongoQuery<Piece> = {
				startRundownId: { $in: args.rundownIds as RundownId[] },
			}
			if (args.partIds) selector.startPartId = { $in: args.partIds as PartId[] }
			return selector
		}
		case 'infinitesStartingBefore':
			return {
				invalid: {
					$ne: true,
				},
				$or: [
					// same rundown, and previous segment
					{
						startRundownId: args.thisRundownId,
						startSegmentId: { $in: args.segmentIdsBefore as SegmentId[] },
						lifespan: {
							$in: [
								PieceLifespan.OutOnRundownEnd,
								PieceLifespan.OutOnRundownChange,
								PieceLifespan.OutOnShowStyleEnd,
							],
						},
					},
					// Previous rundown
					{
						startRundownId: { $in: args.rundownIdsBefore as RundownId[] },
						lifespan: {
							$in: [PieceLifespan.OutOnShowStyleEnd],
						},
					},
				],
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

	static async create(args: ReadonlyDeep<UIPiecesArgs>, cache: ContentCache): Promise<RundownContentObserver> {
		logger.silly(`Creating RundownContentObserver for pieces "${args.type}"`)

		const brandingRundownIds = args.type === 'inParts' ? args.rundownIds : [args.thisRundownId]

		const observers = await waitForAllObserversReady([
			Pieces.observeChanges(createPiecesSelector(args), cache.Pieces.link(), {
				projection: pieceFieldSpecifier,
			}),
			...createBrandingObservers(brandingRundownIds, cache),
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
