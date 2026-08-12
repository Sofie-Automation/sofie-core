import {
	RundownId,
	RundownPlaylistActivationId,
	RundownPlaylistId,
	ShowStyleBaseId,
	StudioId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { MongoFieldSpecifierOnesStrict } from '@sofie-automation/corelib/dist/mongo'
import EventEmitter from 'events'
import _ from 'underscore'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist/RundownPlaylist'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { DBShowStyleBase } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { logger } from '../../logging'
import { observerChain } from '../../publications/lib/observerChain'
import { ContentCache } from './reactiveContentCache'
import { ContentCache as PieceInstancesContentCache } from './reactiveContentCacheForPieceInstances'
import { RundownContentObserver } from './RundownContentObserver'
import { RundownsObserver } from './RundownsObserver'
import { RundownPlaylists, Rundowns, ShowStyleBases } from '../../collections'
import { PromiseDebounce } from '../../publications/lib/PromiseDebounce'
import { PieceInstancesObserver } from './PieceInstancesObserver'
import { MinimalMongoCursor } from '../../collections/collection'
import { AbortScope, createChildAbort, runOnAbort } from '../../lib/observerLifetime'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'

export interface StudioObserverHandlers {
	/** The rundown content for `showStyleBaseId` has changed */
	onRundownContentChanged: (showStyleBaseId: ShowStyleBaseId, cache: ContentCache) => void
	/** The rundown content observed above has gone away, and whatever was derived from it is now stale */
	onRundownContentGone: () => void
	/** The piece instances for `showStyleBaseId` have changed */
	onPieceInstancesChanged: (showStyleBaseId: ShowStyleBaseId, cache: PieceInstancesContentCache) => void
}

const REACTIVITY_DEBOUNCE = 20

type RundownPlaylistFields = '_id' | 'nextPartInfo' | 'currentPartInfo' | 'activationId' | 'rehearsal' | 'studioId'
const rundownPlaylistFieldSpecifier = literal<
	MongoFieldSpecifierOnesStrict<Pick<DBRundownPlaylist, RundownPlaylistFields>>
>({
	_id: 1,
	activationId: 1,
	currentPartInfo: 1,
	nextPartInfo: 1,
	rehearsal: 1,
	studioId: 1,
})

type RundownFields = '_id' | 'showStyleBaseId'
const rundownFieldSpecifier = literal<MongoFieldSpecifierOnesStrict<Pick<DBRundown, RundownFields>>>({
	_id: 1,
	showStyleBaseId: 1,
})

type ShowStyleBaseFields = '_id' | 'sourceLayersWithOverrides' | 'outputLayersWithOverrides' | 'hotkeyLegend'
const showStyleBaseFieldSpecifier = literal<MongoFieldSpecifierOnesStrict<Pick<DBShowStyleBase, ShowStyleBaseFields>>>({
	_id: 1,
	sourceLayersWithOverrides: 1,
	outputLayersWithOverrides: 1,
	hotkeyLegend: 1,
})

interface StudioObserverProps {
	activePlaylistId: RundownPlaylistId
	activationId: RundownPlaylistActivationId
	currentRundownId: RundownId
}

export class StudioObserver extends EventEmitter {
	/** The lifetime of this observer as a whole */
	readonly #abort = new AbortController()
	/** The lifetime of the observers for the current showStyle; superseded on each change */
	#showStyleScope: AbortScope | undefined
	/** The lifetime of the chain watching which showStyle the current rundown uses */
	#showStyleOfRundownScope: AbortScope | undefined

	showStyleBaseId: ShowStyleBaseId | undefined

	currentProps: StudioObserverProps | undefined = undefined
	nextProps: StudioObserverProps | undefined = undefined

	readonly #handlers: StudioObserverHandlers

	constructor(studioId: StudioId, handlers: StudioObserverHandlers) {
		super()
		this.#handlers = handlers
		observerChain(this.#abort.signal)
			.next(
				'activePlaylist',
				async () =>
					RundownPlaylists.findWithCursor(
						{
							studioId: studioId,
							activationId: { $exists: true },
						},
						{
							projection: rundownPlaylistFieldSpecifier,
						}
					) as Promise<MinimalMongoCursor<Pick<DBRundownPlaylist, RundownPlaylistFields>>>
			)
			.end(this.updatePlaylistInStudio)
	}

	private updatePlaylistInStudio = _.debounce(
		(
			state: {
				activePlaylist: Pick<DBRundownPlaylist, RundownPlaylistFields>
			} | null
		): void => {
			if (this.#abort.signal.aborted) return

			const activePlaylistId = state?.activePlaylist?._id
			const activationId = state?.activePlaylist?.activationId
			const currentRundownId =
				state?.activePlaylist?.currentPartInfo?.rundownId ?? state?.activePlaylist?.nextPartInfo?.rundownId

			if (!activePlaylistId || !activationId || !currentRundownId) {
				this.#showStyleOfRundownScope?.abort()
				this.currentProps = undefined
				return
			}

			if (
				currentRundownId === this.currentProps?.currentRundownId &&
				activePlaylistId === this.currentProps?.activePlaylistId &&
				activationId === this.currentProps?.activationId
			)
				return

			this.#showStyleOfRundownScope?.abort()
			this.#showStyleOfRundownScope = undefined

			this.nextProps = {
				activePlaylistId,
				activationId,
				currentRundownId,
			}

			this.setupShowStyleOfRundownObserver(currentRundownId)
		},
		REACTIVITY_DEBOUNCE
	)

	private setupShowStyleOfRundownObserver = (rundownId: RundownId): void => {
		const scope = createChildAbort(this.#abort.signal)
		this.#showStyleOfRundownScope = scope

		observerChain(scope.signal)
			.next(
				'currentRundown',
				async () =>
					Rundowns.findWithCursor(
						{ _id: rundownId },
						{ projection: rundownFieldSpecifier, limit: 1 }
					) as Promise<MinimalMongoCursor<Pick<DBRundown, RundownFields>>>
			)
			.next('showStyleBase', async (chain) =>
				chain.currentRundown
					? (ShowStyleBases.findWithCursor(
							{ _id: chain.currentRundown.showStyleBaseId },
							{
								projection: showStyleBaseFieldSpecifier,
								limit: 1,
							}
						) as Promise<MinimalMongoCursor<Pick<DBShowStyleBase, ShowStyleBaseFields>>>)
					: null
			)
			.end(this.updateShowStyle.call)
	}

	private readonly updateShowStyle = new PromiseDebounce<
		void,
		[
			{
				currentRundown: Pick<DBRundown, RundownFields>
				showStyleBase: Pick<DBShowStyleBase, ShowStyleBaseFields>
			} | null,
		]
	>(async (state): Promise<void> => {
		if (this.#abort.signal.aborted) return

		const showStyleBaseId = state?.showStyleBase._id

		if (showStyleBaseId === undefined || !this.nextProps?.activePlaylistId || !this.nextProps?.activationId) {
			this.currentProps = undefined
			this.#showStyleScope?.abort()
			this.#showStyleScope = undefined
			this.showStyleBaseId = showStyleBaseId
			return
		}

		if (
			showStyleBaseId === this.showStyleBaseId &&
			this.nextProps?.activationId === this.currentProps?.activationId &&
			this.nextProps?.activePlaylistId === this.currentProps?.activePlaylistId &&
			this.nextProps?.currentRundownId === this.currentProps?.currentRundownId
		)
			return

		// Supersede the previous showStyle's observers. The scope is created synchronously, before any
		// await, so a later invocation always ends the right one - and if creating the observers below
		// fails partway, aborting this scope releases whatever did start.
		this.#showStyleScope?.abort()
		const scope = createChildAbort(this.#abort.signal)
		this.#showStyleScope = scope

		this.showStyleBaseId = showStyleBaseId

		this.currentProps = this.nextProps
		this.nextProps = undefined

		const { activePlaylistId, activationId } = this.currentProps
		const handlers = this.#handlers

		try {
			await RundownsObserver.create(activePlaylistId, scope.signal, async (rundownIds, invocationSignal) => {
				logger.silly(`Creating new RundownContentObserver`)

				await RundownContentObserver.create(
					activePlaylistId,
					showStyleBaseId,
					rundownIds,
					(cache) => handlers.onRundownContentChanged(showStyleBaseId, cache),
					invocationSignal
				)

				// This content is stale once the rundowns change, or the observer stops
				runOnAbort(invocationSignal, () => handlers.onRundownContentGone())
			})

			await PieceInstancesObserver.create(
				activationId,
				showStyleBaseId,
				(cache) => handlers.onPieceInstancesChanged(showStyleBaseId, cache),
				scope.signal
			)
		} catch (e) {
			// PromiseDebounce swallows rejections, so log this rather than let it vanish. Aborting the
			// scope releases anything that did start before the failure.
			scope.abort()
			logger.error(`Error in StudioObserver updateShowStyle: ${stringifyError(e)}`)
		}
	}, REACTIVITY_DEBOUNCE)

	public stop = (): void => {
		this.#abort.abort()

		this.updateShowStyle.cancelWaiting()
		this.updatePlaylistInStudio.cancel()
	}
}
