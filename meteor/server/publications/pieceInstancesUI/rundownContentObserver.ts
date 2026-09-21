import { PartInstanceId, RundownId, RundownPlaylistActivationId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { PieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { MongoQuery } from '@sofie-automation/corelib/dist/mongo'
import { ReadonlyDeep } from 'type-fest'
import { logger } from '../../logging'
import { ContentCache, pieceInstanceFieldSpecifier, pieceInstanceSimpleFieldSpecifier } from './reactiveContentCache'
import { PieceInstances } from '../../collections'
import { waitForAllObserversReady } from '../lib/lib'
import type { LiveQueryHandleSync } from '../../lib/lib'

export interface UIPieceInstancesArgs {
	readonly rundownIds: RundownId[]
	/** PartInstanceIds to limit the result to, or null for all */
	readonly partInstanceIds: PartInstanceId[] | null
	/** RundownPlaylistActivationId to limit the result to, or null for any */
	readonly playlistActivationId: RundownPlaylistActivationId | null
	/** Only include PieceInstances which are playing as an adlib, or with tags */
	readonly onlyPlayingAdlibsOrWithTags: boolean
	/** Omit any timing information from the PieceInstances, to reduce data churn */
	readonly omitTimings: boolean
}

function createPieceInstancesSelector(args: ReadonlyDeep<UIPieceInstancesArgs>): MongoQuery<PieceInstance> {
	const selector: MongoQuery<PieceInstance> = {
		rundownId: { $in: args.rundownIds },

		// Enforce only not-reset
		reset: { $ne: true },
	}
	if (args.partInstanceIds) selector.partInstanceId = { $in: args.partInstanceIds }
	if (args.playlistActivationId) selector.playlistActivationId = args.playlistActivationId

	if (args.onlyPlayingAdlibsOrWithTags) {
		selector.plannedStartedPlayback = {
			$exists: true,
		}
		selector.$and = [
			{
				$or: [
					{
						adLibSourceId: {
							$exists: true,
						},
					},
					{
						'piece.tags': {
							$exists: true,
						},
					},
				],
			},
			{
				$or: [
					{
						plannedStoppedPlayback: {
							$eq: 0,
						},
					},
					{
						plannedStoppedPlayback: {
							$exists: false,
						},
					},
				],
			},
		]
	}

	return selector
}

export class RundownContentObserver {
	readonly #cache: ContentCache
	readonly #observers: LiveQueryHandleSync[]

	private constructor(cache: ContentCache, observers: LiveQueryHandleSync[]) {
		this.#cache = cache

		this.#observers = observers
	}

	static async create(
		args: ReadonlyDeep<UIPieceInstancesArgs>,
		cache: ContentCache
	): Promise<RundownContentObserver> {
		logger.silly(`Creating RundownContentObserver for rundowns "${args.rundownIds.join(',')}"`)

		const observers = await waitForAllObserversReady([
			PieceInstances.observeChanges(createPieceInstancesSelector(args), cache.PieceInstances.link(), {
				projection: args.omitTimings ? pieceInstanceSimpleFieldSpecifier : pieceInstanceFieldSpecifier,
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
