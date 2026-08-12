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
import { runOnAbort } from '../../lib/observerLifetime'

const REACTIVITY_DEBOUNCE = 20

type ChangedHandler = (cache: ContentCache) => () => void

export class PieceInstancesObserver {
	#cache: ContentCache
	#cleanup: (() => void) | undefined

	constructor(onChanged: ChangedHandler, signal: AbortSignal) {
		const { cache, cancel: cancelCache } = createReactiveContentCache(() => {
			this.#cleanup = onChanged(cache)
			if (signal.aborted) this.#cleanup()
		}, REACTIVITY_DEBOUNCE)

		this.#cache = cache

		runOnAbort(signal, () => {
			cancelCache()
			this.#cleanup?.()
			this.#cleanup = undefined
		})
	}

	static async create(
		activationId: RundownPlaylistActivationId,
		showStyleBaseId: ShowStyleBaseId,
		onChanged: ChangedHandler,
		signal: AbortSignal
	): Promise<PieceInstancesObserver> {
		logger.silly(`Creating PieceInstancesObserver for activationId "${activationId}"`)

		const observer = new PieceInstancesObserver(onChanged, signal)

		await observer.initObservers(activationId, showStyleBaseId, signal)

		return observer
	}

	private async initObservers(
		activationId: RundownPlaylistActivationId,
		showStyleBaseId: ShowStyleBaseId,
		signal: AbortSignal
	) {
		await Promise.all([
			RundownPlaylists.observeChanges(
				{
					activationId,
				},
				this.#cache.RundownPlaylists.link(),
				{
					projection: rundownPlaylistFieldSpecifier,
					signal,
				}
			),
			ShowStyleBases.observeChanges(showStyleBaseId, this.#cache.ShowStyleBases.link(), { signal }),
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
					signal,
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
					signal,
				}
			),
		])
	}

	public get cache(): ContentCache {
		return this.#cache
	}
}
