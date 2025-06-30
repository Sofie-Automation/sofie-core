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
import { Meteor } from 'meteor/meteor'
import _ from 'underscore'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
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
import { MinimalMongoCursor } from '../../collections/implementations/asyncCollection'
import { PieceInstancesObserver } from './PieceInstancesObserver'

type RundownContentChangeHandler = (showStyleBaseId: ShowStyleBaseId, cache: ContentCache) => () => void
type PieceInstancesChangeHandler = (showStyleBaseId: ShowStyleBaseId, cache: PieceInstancesContentCache) => () => void

const REACTIVITY_DEBOUNCE = 20

type RundownPlaylistFields = '_id' | 'nextPartInfo' | 'currentPartInfo' | 'activationId'
const rundownPlaylistFieldSpecifier = literal<
	MongoFieldSpecifierOnesStrict<Pick<DBRundownPlaylist, RundownPlaylistFields>>
>({
	_id: 1,
	activationId: 1,
	currentPartInfo: 1,
	nextPartInfo: 1,
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
	#playlistInStudioLiveQuery: Meteor.LiveQueryHandle
	#showStyleOfRundownLiveQuery: Meteor.LiveQueryHandle | undefined
	#rundownsLiveQuery: Meteor.LiveQueryHandle | undefined
	#pieceInstancesLiveQuery: Meteor.LiveQueryHandle | undefined

	showStyleBaseId: ShowStyleBaseId | undefined

	currentProps: StudioObserverProps | undefined = undefined
	nextProps: StudioObserverProps | undefined = undefined

	#rundownContentChanged: RundownContentChangeHandler
	#pieceInstancesChanged: PieceInstancesChangeHandler

	#disposed = false

	constructor(
		studioId: StudioId,
		onRundownContentChanged: RundownContentChangeHandler,
		pieceInstancesChanged: PieceInstancesChangeHandler
	) {
		super()
		this.#rundownContentChanged = onRundownContentChanged
		this.#pieceInstancesChanged = pieceInstancesChanged
		this.#playlistInStudioLiveQuery = observerChain()
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
		Meteor.bindEnvironment(
			(
				state: {
					activePlaylist: Pick<DBRundownPlaylist, RundownPlaylistFields>
				} | null
			): void => {
				if (this.#disposed) return

				const activePlaylistId = state?.activePlaylist?._id
				const activationId = state?.activePlaylist?.activationId
				const currentRundownId =
					state?.activePlaylist?.currentPartInfo?.rundownId ?? state?.activePlaylist?.nextPartInfo?.rundownId

				if (!activePlaylistId || !activationId || !currentRundownId) {
					this.#showStyleOfRundownLiveQuery?.stop()
					this.currentProps = undefined
					return
				}

				if (
					currentRundownId === this.currentProps?.currentRundownId &&
					activePlaylistId === this.currentProps?.activePlaylistId &&
					activationId === this.currentProps?.activationId
				)
					return

				this.#showStyleOfRundownLiveQuery?.stop()
				this.#showStyleOfRundownLiveQuery = undefined

				this.nextProps = {
					activePlaylistId,
					activationId,
					currentRundownId,
				}

				this.#showStyleOfRundownLiveQuery = this.setupShowStyleOfRundownObserver(currentRundownId)
			}
		),
		REACTIVITY_DEBOUNCE
	)

	private setupShowStyleOfRundownObserver = (rundownId: RundownId): Meteor.LiveQueryHandle => {
		return observerChain()
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
		if (this.#disposed) return

		const showStyleBaseId = state?.showStyleBase._id

		if (showStyleBaseId === undefined || !this.nextProps?.activePlaylistId || !this.nextProps?.activationId) {
			this.currentProps = undefined
			this.#rundownsLiveQuery?.stop()
			this.#rundownsLiveQuery = undefined
			this.showStyleBaseId = showStyleBaseId

			this.#pieceInstancesLiveQuery?.stop()
			this.#pieceInstancesLiveQuery = undefined
			return
		}

		if (
			showStyleBaseId === this.showStyleBaseId &&
			this.nextProps?.activationId === this.currentProps?.activationId &&
			this.nextProps?.activePlaylistId === this.currentProps?.activePlaylistId &&
			this.nextProps?.currentRundownId === this.currentProps?.currentRundownId
		)
			return

		this.#rundownsLiveQuery?.stop()
		this.#rundownsLiveQuery = undefined

		this.#pieceInstancesLiveQuery?.stop()
		this.#pieceInstancesLiveQuery = undefined

		this.showStyleBaseId = showStyleBaseId

		this.currentProps = this.nextProps
		this.nextProps = undefined

		const { activePlaylistId, activationId } = this.currentProps

		this.showStyleBaseId = showStyleBaseId

		this.#rundownsLiveQuery = await RundownsObserver.create(activePlaylistId, async (rundownIds) => {
			logger.silly(`Creating new RundownContentObserver`)

			const obs1 = await RundownContentObserver.create(activePlaylistId, showStyleBaseId, rundownIds, (cache) => {
				return this.#rundownContentChanged(showStyleBaseId, cache)
			})

			return () => {
				obs1.stop()
			}
		})

		this.#pieceInstancesLiveQuery = await PieceInstancesObserver.create(activationId, showStyleBaseId, (cache) => {
			const cleanupChanges = this.#pieceInstancesChanged(showStyleBaseId, cache)

			return () => {
				cleanupChanges?.()
			}
		})

		if (this.#disposed) {
			// If we were disposed of while waiting for the observer to be created, stop it immediately
			this.#rundownsLiveQuery.stop()
			this.#pieceInstancesLiveQuery.stop()
		}
	}, REACTIVITY_DEBOUNCE)

	public stop = (): void => {
		this.#disposed = true

		this.updateShowStyle.cancelWaiting()
		this.#playlistInStudioLiveQuery.stop()
		this.updatePlaylistInStudio.cancel()
		this.#rundownsLiveQuery?.stop()
	}
}
