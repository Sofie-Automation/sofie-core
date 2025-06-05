import { Meteor } from 'meteor/meteor'
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
import { waitForAllObserversReady } from '../../publications/lib/lib'

const REACTIVITY_DEBOUNCE = 20

type ChangedHandler = (cache: ContentCache) => () => void

export class RundownContentObserver {
	#observers: Meteor.LiveQueryHandle[] = []
	#cache: ContentCache
	#cancelCache: () => void
	#cleanup: (() => void) | undefined = () => {
		throw new Error('RundownContentObserver.#cleanup has not been set!')
	}
	#disposed = false

	private constructor(onChanged: ChangedHandler) {
		const { cache, cancel: cancelCache } = createReactiveContentCache(() => {
			if (this.#disposed) {
				this.#cleanup?.()
				return
			}
			this.#cleanup = onChanged(cache)
		}, REACTIVITY_DEBOUNCE)

		this.#cache = cache
		this.#cancelCache = cancelCache
	}

	static async create(
		rundownPlaylistId: RundownPlaylistId,
		showStyleBaseId: ShowStyleBaseId,
		rundownIds: RundownId[],
		onChanged: ChangedHandler
	): Promise<RundownContentObserver> {
		logger.silly(`Creating RundownContentObserver for playlist "${rundownPlaylistId}"`)

		const observer = new RundownContentObserver(onChanged)

		await observer.initObservers(rundownPlaylistId, showStyleBaseId, rundownIds)

		return observer
	}

	private async initObservers(
		rundownPlaylistId: RundownPlaylistId,
		showStyleBaseId: ShowStyleBaseId,
		rundownIds: RundownId[]
	) {
		this.#observers = await waitForAllObserversReady([
			RundownPlaylists.observeChanges(rundownPlaylistId, this.#cache.RundownPlaylists.link(), {
				projection: rundownPlaylistFieldSpecifier,
			}),
			ShowStyleBases.observeChanges(showStyleBaseId, this.#cache.ShowStyleBases.link()),
			TriggeredActions.observeChanges(
				{
					showStyleBaseId: {
						$in: [showStyleBaseId, null],
					},
				},
				this.#cache.TriggeredActions.link()
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
