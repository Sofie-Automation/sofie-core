import { RundownId, RundownPlaylistId, ShowStyleBaseId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import {
	PartInstances,
	Parts,
	RundownBaselineAdLibActions,
	RundownBaselineAdLibPieces,
	RundownPlaylists,
	AdLibActions,
	AdLibPieces,
	Segments,
	ShowStyleBases,
	TriggeredActions,
} from '../../collections'
import { logger } from '../../logging'
import {
	adLibActionFieldSpecifier,
	adLibPieceFieldSpecifier,
	ContentCache,
	createReactiveContentCache,
	partFieldSpecifier,
	partInstanceFieldSpecifier,
	rundownPlaylistFieldSpecifier,
	segmentFieldSpecifier,
} from './reactiveContentCache'
import { runOnAbort } from '../../lib/observerLifetime'

const REACTIVITY_DEBOUNCE = 20

type ChangedHandler = (cache: ContentCache) => () => void

export class RundownContentObserver {
	#cache: ContentCache
	#cleanup: (() => void) | undefined

	private constructor(onChanged: ChangedHandler, signal: AbortSignal) {
		const { cache, cancel: cancelCache } = createReactiveContentCache(() => {
			if (signal.aborted) {
				this.#cleanup?.()
				return
			}
			this.#cleanup = onChanged(cache)
		}, REACTIVITY_DEBOUNCE)

		this.#cache = cache

		runOnAbort(signal, () => {
			cancelCache()
			this.#cleanup?.()
			this.#cleanup = undefined
		})
	}

	static async create(
		rundownPlaylistId: RundownPlaylistId,
		showStyleBaseId: ShowStyleBaseId,
		rundownIds: RundownId[],
		onChanged: ChangedHandler,
		signal: AbortSignal
	): Promise<RundownContentObserver> {
		logger.silly(`Creating RundownContentObserver for playlist "${rundownPlaylistId}"`)

		const observer = new RundownContentObserver(onChanged, signal)

		await observer.initObservers(rundownPlaylistId, showStyleBaseId, rundownIds, signal)

		return observer
	}

	private async initObservers(
		rundownPlaylistId: RundownPlaylistId,
		showStyleBaseId: ShowStyleBaseId,
		rundownIds: RundownId[],
		signal: AbortSignal
	) {
		await Promise.all([
			RundownPlaylists.observeChanges(rundownPlaylistId, this.#cache.RundownPlaylists.link(), {
				projection: rundownPlaylistFieldSpecifier,
				signal,
			}),
			ShowStyleBases.observeChanges(showStyleBaseId, this.#cache.ShowStyleBases.link(), { signal }),
			TriggeredActions.observeChanges(
				{
					showStyleBaseId: {
						$in: [showStyleBaseId, null],
					},
				},
				this.#cache.TriggeredActions.link(),
				{ signal }
			),
			Segments.observeChanges(
				{
					rundownId: {
						$in: rundownIds,
					},
				},
				this.#cache.Segments.link(),
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
				this.#cache.Parts.link(),
				{
					projection: partFieldSpecifier,
					signal,
				}
			),
			PartInstances.observeChanges(
				{
					rundownId: {
						$in: rundownIds,
					},
					reset: {
						$ne: true,
					},
				},
				this.#cache.PartInstances.link(),
				{
					projection: partInstanceFieldSpecifier,
					signal,
				}
			),
			RundownBaselineAdLibActions.observeChanges(
				{
					rundownId: {
						$in: rundownIds,
					},
				},
				this.#cache.RundownBaselineAdLibActions.link(),
				{
					projection: adLibActionFieldSpecifier,
					signal,
				}
			),
			RundownBaselineAdLibPieces.observeChanges(
				{
					rundownId: {
						$in: rundownIds,
					},
				},
				this.#cache.RundownBaselineAdLibPieces.link(),
				{
					projection: adLibPieceFieldSpecifier,
					signal,
				}
			),
			AdLibActions.observeChanges(
				{
					rundownId: {
						$in: rundownIds,
					},
				},
				this.#cache.AdLibActions.link(),
				{
					projection: adLibActionFieldSpecifier,
					signal,
				}
			),
			AdLibPieces.observeChanges(
				{
					rundownId: {
						$in: rundownIds,
					},
				},
				this.#cache.AdLibPieces.link(),
				{
					projection: adLibPieceFieldSpecifier,
					signal,
				}
			),
		])
	}

	public get cache(): ContentCache {
		return this.#cache
	}
}
