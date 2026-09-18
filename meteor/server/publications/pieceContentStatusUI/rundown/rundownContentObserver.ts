import { BlueprintId, RundownId, ShowStyleBaseId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { logger } from '../../../logging'
import {
	adLibActionFieldSpecifier,
	adLibPieceFieldSpecifier,
	blueprintFieldSpecifier,
	ContentCache,
	partFieldSpecifier,
	partInstanceFieldSpecifier,
	pieceFieldSpecifier,
	pieceInstanceFieldSpecifier,
	rundownFieldSpecifier,
	segmentFieldSpecifier,
	ShowStyleBaseFields,
	showStyleBaseFieldSpecifier,
	SourceLayersDoc,
} from './reactiveContentCache'
import {
	AdLibActions,
	AdLibPieces,
	Blueprints,
	PartInstances,
	Parts,
	PieceInstances,
	Pieces,
	RundownBaselineAdLibActions,
	RundownBaselineAdLibPieces,
	Rundowns,
	Segments,
	ShowStyleBases,
} from '../../../collections'
import { DBShowStyleBase } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { applyAndValidateOverrides } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { reactiveObserverGroup, ReactiveObserverGroup } from '../../lib/observerGroup'
import { createDebounce, Debounced } from '../../../lib/debounce'
import _ from 'underscore'
import { equivalentArrays } from '@sofie-automation/shared-lib/dist/lib/lib'

const REACTIVITY_DEBOUNCE = 20

function convertShowStyleBase(doc: Pick<DBShowStyleBase, ShowStyleBaseFields>): Omit<SourceLayersDoc, '_id'> {
	return {
		blueprintId: doc.blueprintId,
		sourceLayers: applyAndValidateOverrides(doc.sourceLayersWithOverrides).obj,
	}
}

export class RundownContentObserver {
	readonly #cache: ContentCache
	readonly #signal: AbortSignal

	#showStyleBaseIds: ShowStyleBaseId[] = []
	#showStyleBaseIdObserver!: ReactiveObserverGroup

	#blueprintIds: BlueprintId[] = []
	#blueprintIdObserver!: ReactiveObserverGroup

	private readonly updateShowStyleBaseIds: Debounced<[]>
	private readonly updateBlueprintIds: Debounced<[]>

	private constructor(cache: ContentCache, signal: AbortSignal) {
		this.#cache = cache
		this.#signal = signal

		this.updateShowStyleBaseIds = createDebounce(
			() => {
				const newShowStyleBaseIds = _.uniq(this.#cache.Rundowns.findFetch({}).map((rd) => rd.showStyleBaseId))

				if (!equivalentArrays(newShowStyleBaseIds, this.#showStyleBaseIds)) {
					logger.silly(
						`optimized observer changed ids ${JSON.stringify(newShowStyleBaseIds)} ${
							this.#showStyleBaseIds
						}`
					)
					this.#showStyleBaseIds = newShowStyleBaseIds
					// trigger the rundown group to restart
					this.#showStyleBaseIdObserver.restart()
				}
			},
			REACTIVITY_DEBOUNCE,
			signal
		)

		this.updateBlueprintIds = createDebounce(
			() => {
				const newBlueprintIds = _.uniq(
					this.#cache.ShowStyleSourceLayers.findFetch({}).map((rd) => rd.blueprintId)
				)

				if (!equivalentArrays(newBlueprintIds, this.#blueprintIds)) {
					logger.silly(
						`optimized observer changed ids ${JSON.stringify(newBlueprintIds)} ${this.#blueprintIds}`
					)
					this.#blueprintIds = newBlueprintIds
					// trigger the rundown group to restart
					this.#blueprintIdObserver.restart()
				}
			},
			REACTIVITY_DEBOUNCE,
			signal
		)
	}

	static async create(
		rundownIds: RundownId[],
		cache: ContentCache,
		signal: AbortSignal
	): Promise<RundownContentObserver> {
		logger.silly(`Creating RundownContentObserver for rundowns "${rundownIds.join(',')}"`)

		const observer = new RundownContentObserver(cache, signal)

		await observer.initShowStyleBaseIdObserver()
		await observer.initBlueprintIdObserver()
		await observer.initContentObservers(rundownIds)

		return observer
	}

	private async initShowStyleBaseIdObserver() {
		// Run the ShowStyleBase query in a reactiveObserverGroup, so that it can be restarted whenever
		this.#showStyleBaseIdObserver = await reactiveObserverGroup(this.#signal, async (generationSignal) => {
			// Clear already cached data
			this.#cache.ShowStyleSourceLayers.remove({})

			logger.silly(`optimized observer restarting ${this.#showStyleBaseIds}`)

			await ShowStyleBases.observe(
				{
					// We can use the `this.#showStyleBaseIds` here, as this is restarted every time that property changes
					_id: { $in: this.#showStyleBaseIds },
				},
				{
					added: (doc) => {
						const newDoc = convertShowStyleBase(doc)
						this.#cache.ShowStyleSourceLayers.replace({ ...newDoc, _id: doc._id })
						this.updateBlueprintIds()
					},
					changed: (doc) => {
						const newDoc = convertShowStyleBase(doc)
						this.#cache.ShowStyleSourceLayers.replace({ ...newDoc, _id: doc._id })
						this.updateBlueprintIds()
					},
					removed: (doc) => {
						this.#cache.ShowStyleSourceLayers.remove(doc._id)
						this.updateBlueprintIds()
					},
				},
				{
					projection: showStyleBaseFieldSpecifier,
					signal: generationSignal,
				}
			)
		})
	}

	private async initBlueprintIdObserver() {
		// Run the Blueprint query in a reactiveObserverGroup, so that it can be restarted whenever
		this.#blueprintIdObserver = await reactiveObserverGroup(this.#signal, async (generationSignal) => {
			// Clear already cached data
			this.#cache.Blueprints.remove({})

			logger.silly(`optimized observer restarting ${this.#blueprintIds}`)

			await Blueprints.observeChanges(
				{
					// We can use the `this.#blueprintIds` here, as this is restarted every time that property changes
					_id: { $in: this.#blueprintIds },
				},
				this.#cache.Blueprints.link(),
				{
					projection: blueprintFieldSpecifier,
					signal: generationSignal,
				}
			)
		})
	}

	private async initContentObservers(rundownIds: RundownId[]) {
		// Subscribe to the database, and pipe any updates into the cache collections
		await Promise.all([
			Rundowns.observeChanges(
				{
					_id: {
						$in: rundownIds,
					},
				},
				this.#cache.Rundowns.link(() => {
					// Check if the ShowStyleBaseIds needs updating
					this.updateShowStyleBaseIds()
				}),
				{
					projection: rundownFieldSpecifier,
					signal: this.#signal,
				}
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
					signal: this.#signal,
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
					signal: this.#signal,
				}
			),
			Pieces.observeChanges(
				{
					startRundownId: {
						$in: rundownIds,
					},
				},
				this.#cache.Pieces.link(),
				{
					projection: pieceFieldSpecifier,
					signal: this.#signal,
				}
			),
			PartInstances.observeChanges(
				{
					rundownId: {
						$in: rundownIds,
					},
					reset: { $ne: true },
				},
				this.#cache.PartInstances.link(),
				{
					projection: partInstanceFieldSpecifier,
					signal: this.#signal,
				}
			),
			PieceInstances.observeChanges(
				{
					rundownId: {
						$in: rundownIds,
					},
					reset: { $ne: true },
				},
				this.#cache.PieceInstances.link(),
				{
					projection: pieceInstanceFieldSpecifier,
					signal: this.#signal,
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
					signal: this.#signal,
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
					signal: this.#signal,
				}
			),
			RundownBaselineAdLibPieces.observeChanges(
				{
					rundownId: {
						$in: rundownIds,
					},
				},
				this.#cache.BaselineAdLibPieces.link(),
				{
					projection: adLibPieceFieldSpecifier,
					signal: this.#signal,
				}
			),
			RundownBaselineAdLibActions.observeChanges(
				{
					rundownId: {
						$in: rundownIds,
					},
				},
				this.#cache.BaselineAdLibActions.link(),
				{
					projection: adLibActionFieldSpecifier,
					signal: this.#signal,
				}
			),
		])
	}

	public get cache(): ContentCache {
		return this.#cache
	}
}
