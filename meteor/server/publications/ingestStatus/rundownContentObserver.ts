import { RundownId, RundownPlaylistId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { logger } from '../../logging'
import {
	ContentCache,
	nrcsIngestDataCacheObjSpecifier,
	partFieldSpecifier,
	partInstanceFieldSpecifier,
	playlistFieldSpecifier,
	rundownFieldSpecifier,
	// segmentFieldSpecifier,
} from './reactiveContentCache'
import { NrcsIngestDataCache, PartInstances, Parts, RundownPlaylists, Rundowns } from '../../collections'
import _ from 'underscore'
import { reactiveObserverGroup, ReactiveObserverGroup } from '../lib/observerGroup'
import { equivalentArrays } from '@sofie-automation/shared-lib/dist/lib/lib'

const REACTIVITY_DEBOUNCE = 20

export class RundownContentObserver {
	readonly #cache: ContentCache
	readonly #signal: AbortSignal

	#playlistIds: RundownPlaylistId[] = []
	#playlistIdObserver!: ReactiveObserverGroup

	private constructor(cache: ContentCache, signal: AbortSignal) {
		this.#cache = cache
		this.#signal = signal
	}

	static async create(
		rundownIds: RundownId[],
		cache: ContentCache,
		signal: AbortSignal
	): Promise<RundownContentObserver> {
		logger.silly(`Creating RundownContentObserver for rundowns "${rundownIds.join(',')}"`)

		const observer = new RundownContentObserver(cache, signal)

		observer.#playlistIdObserver = await reactiveObserverGroup(signal, async (generationSignal) => {
			// Clear already cached data
			cache.Playlists.remove({})

			await RundownPlaylists.observe(
				{
					// We can use the `this.#playlistIds` here, as this is restarted every time that property changes
					_id: { $in: observer.#playlistIds },
				},
				{
					added: (doc) => {
						cache.Playlists.replace(doc)
					},
					changed: (doc) => {
						cache.Playlists.replace(doc)
					},
					removed: (doc) => {
						cache.Playlists.remove(doc._id)
					},
				},
				{
					projection: playlistFieldSpecifier,
					signal: generationSignal,
				}
			)
		})

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
					nonMutatingCallbacks: true,
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
					nonMutatingCallbacks: true,
					signal,
				}
			),
			PartInstances.observeChanges(
				{
					rundownId: { $in: rundownIds },
					reset: { $ne: true },
					orphaned: { $exists: false },
				},
				cache.PartInstances.link(),
				{
					projection: partInstanceFieldSpecifier,
					nonMutatingCallbacks: true,
					signal,
				}
			),
			NrcsIngestDataCache.observeChanges(
				{
					rundownId: {
						$in: rundownIds,
					},
				},
				cache.NrcsIngestData.link(),
				{
					projection: nrcsIngestDataCacheObjSpecifier,
					nonMutatingCallbacks: true,
					signal,
				}
			),
		])

		return observer
	}

	public checkPlaylistIds = _.debounce(() => {
		if (this.#signal.aborted) return

		const playlistIds = Array.from(new Set(this.#cache.Rundowns.findFetch({}).map((rundown) => rundown.playlistId)))

		if (!equivalentArrays(playlistIds, this.#playlistIds)) {
			this.#playlistIds = playlistIds
			// trigger the playlist group to restart
			this.#playlistIdObserver.restart()
		}
	}, REACTIVITY_DEBOUNCE)

	public get cache(): ContentCache {
		return this.#cache
	}
}
