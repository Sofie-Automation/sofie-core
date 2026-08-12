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

export class RundownContentObserver {
	readonly #cache: ContentCache

	private constructor(cache: ContentCache) {
		this.#cache = cache
	}

	static async create(
		rundownIds: RundownId[],
		cache: ContentCache,
		signal: AbortSignal
	): Promise<RundownContentObserver> {
		logger.silly(`Creating RundownContentObserver for rundowns "${rundownIds.join(',')}"`)

		await Promise.all([
			Rundowns.observeChanges(
				{
					_id: {
						$in: rundownIds,
					},
				},
				cache.Rundowns.link(),
				{
					projection: rundownFieldSpecifier,
					signal,
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
					signal,
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
					signal,
				}
			),
			PartInstances.observeChanges(
				{
					rundownId: { $in: rundownIds },
					reset: { $ne: true },
					$or: [{ invalidReason: { $exists: true } }, { orphaned: 'deleted' }],
				},
				cache.PartInstances.link(),
				{ projection: partInstanceFieldSpecifier, signal }
			),
		])

		return new RundownContentObserver(cache)
	}

	public get cache(): ContentCache {
		return this.#cache
	}
}
