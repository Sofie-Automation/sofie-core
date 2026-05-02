import { Meteor } from 'meteor/meteor'
import { RundownId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { logger } from '../../logging'
import {
	ContentCache,
	partFieldSpecifier,
	partInstanceFieldSpecifier,
	rundownFieldSpecifier,
	segmentFieldSpecifier,
} from './reactiveContentCache'
import { PartInstances, Parts, Rundowns, Segments } from '../../collections'
import { waitForAllObserversReady } from '../lib/lib'

export class RundownContentObserver {
	readonly #observers: Meteor.LiveQueryHandle[]
	readonly #cache: ContentCache

	private constructor(cache: ContentCache, observers: Meteor.LiveQueryHandle[]) {
		this.#cache = cache
		this.#observers = observers
	}

	static async create(rundownIds: RundownId[], cache: ContentCache): Promise<RundownContentObserver> {
		logger.silly(`Creating RundownContentObserver for rundowns "${rundownIds.join(',')}"`)

		const observers = await waitForAllObserversReady([
			Rundowns.observeChanges(
				{
					_id: {
						$in: rundownIds,
					},
				},
				cache.Rundowns.link(),
				{
					projection: rundownFieldSpecifier,
				}
			),
			Segments.observeChanges(
				{
					rundownId: {
						$in: rundownIds,
					},
				},
				cache.Segments.link(),
				{
					projection: segmentFieldSpecifier,
				}
			),
			Parts.observeChanges(
				{
					rundownId: {
						$in: rundownIds,
					},
				},
				cache.Parts.link(),
				{
					projection: partFieldSpecifier,
				}
			),
			PartInstances.observeChanges(
				{
					rundownId: { $in: rundownIds },
					reset: { $ne: true },
					$or: [{ invalidReason: { $exists: true } }, { orphaned: 'deleted' }],
				},
				cache.PartInstances.link(),
				{ projection: partInstanceFieldSpecifier }
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
