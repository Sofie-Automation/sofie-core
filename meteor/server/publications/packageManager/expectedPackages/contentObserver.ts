import { PartInstanceId, StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { logger } from '../../../logging'
import {
	ExpectedPackagesContentCache,
	rundownPlaylistFieldSpecifier,
	pieceInstanceFieldsSpecifier,
} from './contentCache'
import { ExpectedPackages, PieceInstances, RundownPlaylists } from '../../../collections'
import { reactiveObserverGroup, ReactiveObserverGroup } from '../../lib/observerGroup'
import _ from 'underscore'
import { equivalentArrays } from '@sofie-automation/shared-lib/dist/lib/lib'

const REACTIVITY_DEBOUNCE = 20

export class ExpectedPackagesContentObserver {
	readonly #cache: ExpectedPackagesContentCache
	readonly #signal: AbortSignal

	#partInstanceIds: PartInstanceId[] = []
	#partInstanceIdObserver!: ReactiveObserverGroup

	private constructor(cache: ExpectedPackagesContentCache, signal: AbortSignal) {
		this.#cache = cache
		this.#signal = signal
	}

	static async create(
		studioId: StudioId,
		cache: ExpectedPackagesContentCache,
		signal: AbortSignal
	): Promise<ExpectedPackagesContentObserver> {
		logger.silly(`Creating ExpectedPackagesContentObserver for "${studioId}"`)

		const observer = new ExpectedPackagesContentObserver(cache, signal)

		// Run the PieceInstances query in a reactive observer group, so that it can be restarted whenever
		observer.#partInstanceIdObserver = await reactiveObserverGroup(signal, async (generationSignal) => {
			// Clear already cached data
			cache.PieceInstances.remove({})

			await PieceInstances.observeChanges(
				{
					// We can use the `this.#partInstanceIds` here, as this is restarted every time that property changes
					partInstanceId: { $in: observer.#partInstanceIds },
				},
				cache.PieceInstances.link(),
				{
					projection: pieceInstanceFieldsSpecifier,
					signal: generationSignal,
				}
			)
		})

		// Subscribe to the database, and pipe any updates into the cache collections
		await Promise.all([
			ExpectedPackages.observeChanges(
				{
					studioId: studioId,
				},
				cache.ExpectedPackages.link(),
				{
					signal,
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
					signal,
				}
			),
		])

		return observer
	}

	private updatePartInstanceIds = _.debounce(() => {
		if (this.#signal.aborted) return

		const newPartInstanceIdsSet = new Set<PartInstanceId>()

		this.#cache.RundownPlaylists.findFetch({}).forEach((playlist) => {
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
	}, REACTIVITY_DEBOUNCE)

	public get cache(): ExpectedPackagesContentCache {
		return this.#cache
	}
}
