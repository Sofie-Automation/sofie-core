import { Meteor } from 'meteor/meteor'
import { RundownPlaylistActivationId, ShowStyleBaseId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { RundownPlaylists, ShowStyleBases, PieceInstances, PartInstances } from '../../collections'
import { logger } from '../../logging'
import { rundownPlaylistFieldSpecifier } from './reactiveContentCache'
import {
	ContentCache,
	createReactiveContentCache,
	partInstanceFieldSpecifier,
	pieceInstanceFieldSpecifier,
} from './reactiveContentCacheForPieceInstances'
import { waitForAllObserversReady } from '../../publications/lib/lib'

const REACTIVITY_DEBOUNCE = 20

type ChangedHandler = (cache: ContentCache) => () => void

export class PieceInstancesObserver {
	#observers: Meteor.LiveQueryHandle[] = []
	#cache: ContentCache
	#cancelCache: () => void
	#cleanup: (() => void) | undefined
	#disposed = false

	constructor(onChanged: ChangedHandler) {
		const { cache, cancel: cancelCache } = createReactiveContentCache(() => {
			this.#cleanup = onChanged(cache)
			if (this.#disposed) this.#cleanup()
		}, REACTIVITY_DEBOUNCE)

		this.#cache = cache
		this.#cancelCache = cancelCache
	}

	static async create(
		activationId: RundownPlaylistActivationId,
		showStyleBaseId: ShowStyleBaseId,
		onChanged: ChangedHandler
	): Promise<PieceInstancesObserver> {
		logger.silly(`Creating PieceInstancesObserver for activationId "${activationId}"`)

		const observer = new PieceInstancesObserver(onChanged)

		await observer.initObservers(activationId, showStyleBaseId)

		return observer
	}

	private async initObservers(activationId: RundownPlaylistActivationId, showStyleBaseId: ShowStyleBaseId) {
		this.#observers = await waitForAllObserversReady([
			RundownPlaylists.observeChanges(
				{
					activationId,
				},
				this.#cache.RundownPlaylists.link(),
				{
					projection: rundownPlaylistFieldSpecifier,
				}
			),
			ShowStyleBases.observeChanges(showStyleBaseId, this.#cache.ShowStyleBases.link()),
			PieceInstances.observeChanges(
				{
					playlistActivationId: activationId,
					reset: { $ne: true },
					disabled: { $ne: true },
					reportedStoppedPlayback: { $exists: false },
					'piece.virtual': { $ne: true },
				},
				this.#cache.PieceInstances.link(),
				{
					projection: pieceInstanceFieldSpecifier,
				}
			),
			PartInstances.observeChanges(
				{
					playlistActivationId: activationId,
					reset: { $ne: true },
					'timings.reportedStoppedPlayback': { $ne: true },
				},
				this.#cache.PartInstances.link(),
				{
					projection: partInstanceFieldSpecifier,
				}
			),
		])
	}

	public get cache(): ContentCache {
		return this.#cache
	}

	public stop = (): void => {
		this.#disposed = true
		this.#cancelCache()
		this.#observers.forEach((observer) => observer.stop())
		this.#cleanup?.()
		this.#cleanup = undefined
	}
}
