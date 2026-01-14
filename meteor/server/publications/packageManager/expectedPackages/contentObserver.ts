import { Meteor } from 'meteor/meteor'
import { PartInstanceId, StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { logger } from '../../../logging'
import {
	ExpectedPackagesContentCache,
	rundownPlaylistFieldSpecifier,
	pieceInstanceFieldsSpecifier,
	expectedPackageDBFieldsSpecifier,
} from './contentCache'
import { ExpectedPackages, PieceInstances, RundownPlaylists } from '../../../collections'
import { ReactiveMongoObserverGroup, ReactiveMongoObserverGroupHandle } from '../../lib/observerGroup'
import _ from 'underscore'
import { equivalentArrays } from '@sofie-automation/shared-lib/dist/lib/lib'
import { waitForAllObserversReady } from '../../lib/lib'

const REACTIVITY_DEBOUNCE = 20

export class ExpectedPackagesContentObserver implements Meteor.LiveQueryHandle {
	#observers: Meteor.LiveQueryHandle[] = []
	#cache: ExpectedPackagesContentCache

	#partInstanceIds: PartInstanceId[] = []
	#partInstanceIdObserver!: ReactiveMongoObserverGroupHandle

	#disposed = false

	private constructor(cache: ExpectedPackagesContentCache) {
		this.#cache = cache
	}

	static async create(
		studioId: StudioId,
		cache: ExpectedPackagesContentCache
	): Promise<ExpectedPackagesContentObserver> {
		logger.silly(`Creating ExpectedPackagesContentObserver for "${studioId}"`)

		const observer = new ExpectedPackagesContentObserver(cache)

		// Run the ShowStyleBase query in a ReactiveMongoObserverGroup, so that it can be restarted whenever
		observer.#partInstanceIdObserver = await ReactiveMongoObserverGroup(async () => {
			// Clear already cached data
			cache.PieceInstances.remove({})

			return [
				PieceInstances.observeChanges(
					{
						// We can use the `this.#partInstanceIds` here, as this is restarted every time that property changes
						partInstanceId: { $in: observer.#partInstanceIds },
					},
					cache.PieceInstances.link(),
					{
						projection: pieceInstanceFieldsSpecifier,
					}
				),
			]
		})

		// Subscribe to the database, and pipe any updates into the ReactiveCacheCollections
		// This takes ownership of the #partInstanceIdObserver, and will stop it if this throws
		observer.#observers = await waitForAllObserversReady([
			ExpectedPackages.observeChanges(
				{
					studioId: studioId,
				},
				cache.ExpectedPackages.link(),
				{
					projection: expectedPackageDBFieldsSpecifier,
				}
			),

			RundownPlaylists.observeChanges(
				{
					studioId: studioId,
				},
				cache.RundownPlaylists.link(() => {
					observer.updatePartInstanceIds()
				}),
				{
					projection: rundownPlaylistFieldSpecifier,
				}
			),

			observer.#partInstanceIdObserver,
		])

		return observer
	}

	private updatePartInstanceIds = _.debounce(
		Meteor.bindEnvironment(() => {
			if (this.#disposed) return

			const newPartInstanceIdsSet = new Set<PartInstanceId>()

			this.#cache.RundownPlaylists.find({}).forEach((playlist) => {
				if (playlist.activationId) {
					if (playlist.nextPartInfo) {
						newPartInstanceIdsSet.add(playlist.nextPartInfo.partInstanceId)
					}
					if (playlist.currentPartInfo) {
						newPartInstanceIdsSet.add(playlist.currentPartInfo.partInstanceId)
					}
				}
			})

			const newPartInstanceIds = Array.from(newPartInstanceIdsSet)

			if (!equivalentArrays(newPartInstanceIds, this.#partInstanceIds)) {
				this.#partInstanceIds = newPartInstanceIds
				// trigger the rundown group to restart
				this.#partInstanceIdObserver.restart()
			}
		}),
		REACTIVITY_DEBOUNCE
	)

	public get cache(): ExpectedPackagesContentCache {
		return this.#cache
	}

	public stop = (): void => {
		this.#disposed = true

		this.#observers.forEach((observer) => observer.stop())
	}
}
