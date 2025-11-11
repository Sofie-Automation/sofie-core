import { Meteor } from 'meteor/meteor'
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
import { waitForAllObserversReady } from '../lib/lib'
import _ from 'underscore'
import { ReactiveMongoObserverGroup, ReactiveMongoObserverGroupHandle } from '../lib/observerGroup'
import { equivalentArrays } from '@sofie-automation/shared-lib/dist/lib/lib'

const REACTIVITY_DEBOUNCE = 20

export class RundownContentObserver {
	#observers: Meteor.LiveQueryHandle[] = []
	readonly #cache: ContentCache

	#playlistIds: RundownPlaylistId[] = []
	#playlistIdObserver!: ReactiveMongoObserverGroupHandle

	#disposed = false

	private constructor(cache: ContentCache) {
		this.#cache = cache
	}

	static async create(rundownIds: RundownId[], cache: ContentCache): Promise<RundownContentObserver> {
		logger.silly(`Creating RundownContentObserver for rundowns "${rundownIds.join(',')}"`)

		const observer = new RundownContentObserver(cache)

		observer.#playlistIdObserver = await ReactiveMongoObserverGroup(async () => {
			// Clear already cached data
			cache.Playlists.remove({})

			return [
				RundownPlaylists.observe(
					{
						// We can use the `this.#playlistIds` here, as this is restarted every time that property changes
						_id: { $in: observer.#playlistIds },
					},
					{
						added: (doc) => {
							cache.Playlists.upsert(doc._id, doc)
						},
						changed: (doc) => {
							cache.Playlists.upsert(doc._id, doc)
						},
						removed: (doc) => {
							cache.Playlists.remove(doc._id)
						},
					},
					{
						projection: playlistFieldSpecifier,
					}
				),
			]
		})

		observer.#observers = await waitForAllObserversReady([
			Rundowns.observeChanges(
				{
					_id: {
						$in: rundownIds,
					},
				},
				cache.Rundowns.link(),
				{
					projection: rundownFieldSpecifier,
				},
				{
					nonMutatingCallbacks: true,
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
				},
				{
					nonMutatingCallbacks: true,
				}
			),
			PartInstances.observeChanges(
				{
					rundownId: { $in: rundownIds },
					reset: { $ne: true },
					orphaned: { $exists: false },
				},
				cache.PartInstances.link(),
				{ projection: partInstanceFieldSpecifier },
				{
					nonMutatingCallbacks: true,
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
				},
				{
					nonMutatingCallbacks: true,
				}
			),

			observer.#playlistIdObserver,
		])

		return observer
	}

	public checkPlaylistIds = _.debounce(
		Meteor.bindEnvironment(() => {
			if (this.#disposed) return

			const playlistIds = Array.from(new Set(this.#cache.Rundowns.find({}).map((rundown) => rundown.playlistId)))

			if (!equivalentArrays(playlistIds, this.#playlistIds)) {
				this.#playlistIds = playlistIds
				// trigger the playlist group to restart
				this.#playlistIdObserver.restart()
			}
		}),
		REACTIVITY_DEBOUNCE
	)

	public get cache(): ContentCache {
		return this.#cache
	}

	public dispose = (): void => {
		this.#disposed = true

		this.#observers.forEach((observer) => observer.stop())
	}
}
