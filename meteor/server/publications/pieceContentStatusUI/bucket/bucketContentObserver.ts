import { BlueprintId, BucketId, ShowStyleBaseId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { logger } from '../../../logging'
import {
	blueprintFieldSpecifier,
	bucketActionFieldSpecifier,
	bucketAdlibFieldSpecifier,
	BucketContentCache,
	ShowStyleBaseFields,
	showStyleBaseFieldSpecifier,
	SourceLayersDoc,
} from './bucketContentCache'
import { Blueprints, BucketAdLibActions, BucketAdLibs, ShowStyleBases } from '../../../collections'
import { DBShowStyleBase } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { equivalentArrays } from '@sofie-automation/shared-lib/dist/lib/lib'
import { applyAndValidateOverrides } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { reactiveObserverGroup, ReactiveObserverGroup } from '../../lib/observerGroup'
import { createDebounce, Debounced } from '../../../lib/debounce'
import _ from 'underscore'

const REACTIVITY_DEBOUNCE = 20

function convertShowStyleBase(doc: Pick<DBShowStyleBase, ShowStyleBaseFields>): Omit<SourceLayersDoc, '_id'> {
	return {
		blueprintId: doc.blueprintId,
		sourceLayers: applyAndValidateOverrides(doc.sourceLayersWithOverrides).obj,
	}
}

export class BucketContentObserver {
	#cache: BucketContentCache

	#showStyleBaseIds: ShowStyleBaseId[] = []
	#showStyleBaseIdObserver!: ReactiveObserverGroup

	#blueprintIds: BlueprintId[] = []
	#blueprintIdObserver!: ReactiveObserverGroup

	private readonly updateShowStyleBaseIds: Debounced<[]>
	private readonly updateBlueprintIds: Debounced<[]>

	private constructor(cache: BucketContentCache, signal: AbortSignal) {
		this.#cache = cache

		this.updateShowStyleBaseIds = createDebounce(
			() => {
				const newShowStyleBaseIdsSet = new Set<ShowStyleBaseId>()
				this.#cache.BucketAdLibs.findFetch({}).forEach((adlib) =>
					newShowStyleBaseIdsSet.add(adlib.showStyleBaseId)
				)
				this.#cache.BucketAdLibActions.findFetch({}).forEach((action) =>
					newShowStyleBaseIdsSet.add(action.showStyleBaseId)
				)

				const newShowStyleBaseIds = Array.from(newShowStyleBaseIdsSet)

				if (!equivalentArrays(newShowStyleBaseIds, this.#showStyleBaseIds)) {
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
		bucketId: BucketId,
		cache: BucketContentCache,
		signal: AbortSignal
	): Promise<BucketContentObserver> {
		logger.silly(`Creating BucketContentObserver for "${bucketId}"`)

		const observer = new BucketContentObserver(cache, signal)

		// Run the ShowStyleBase query in a reactiveObserverGroup, so that it can be restarted whenever
		observer.#showStyleBaseIdObserver = await reactiveObserverGroup(signal, async (generationSignal) => {
			// Clear already cached data
			cache.ShowStyleSourceLayers.remove({})

			await ShowStyleBases.observe(
				{
					// We can use the `this.#showStyleBaseIds` here, as this is restarted every time that property changes
					_id: { $in: observer.#showStyleBaseIds },
				},
				{
					added: (doc) => {
						const newDoc = convertShowStyleBase(doc)
						cache.ShowStyleSourceLayers.replace({ ...newDoc, _id: doc._id })
						observer.updateBlueprintIds()
					},
					changed: (doc) => {
						const newDoc = convertShowStyleBase(doc)
						cache.ShowStyleSourceLayers.replace({ ...newDoc, _id: doc._id })
						observer.updateBlueprintIds()
					},
					removed: (doc) => {
						cache.ShowStyleSourceLayers.remove(doc._id)
						observer.updateBlueprintIds()
					},
				},
				{
					projection: showStyleBaseFieldSpecifier,
					signal: generationSignal,
				}
			)
		})

		// Run the Blueprint query in a reactiveObserverGroup, so that it can be restarted whenever
		observer.#blueprintIdObserver = await reactiveObserverGroup(signal, async (generationSignal) => {
			// Clear already cached data
			cache.Blueprints.remove({})

			logger.silly(`optimized observer restarting ${observer.#blueprintIds}`)

			await Blueprints.observeChanges(
				{
					// We can use the `this.#blueprintIds` here, as this is restarted every time that property changes
					_id: { $in: observer.#blueprintIds },
				},
				cache.Blueprints.link(),
				{
					projection: blueprintFieldSpecifier,
					signal: generationSignal,
				}
			)
		})

		// Subscribe to the database, and pipe any updates into the cache collections
		await Promise.all([
			BucketAdLibs.observeChanges(
				{
					bucketId: bucketId,
				},
				cache.BucketAdLibs.link(() => {
					// Check if the ShowStyleBaseIds needs updating
					// TODO - is this over-eager?
					observer.updateShowStyleBaseIds()
				}),
				{
					projection: bucketAdlibFieldSpecifier,
					signal,
				}
			),
			BucketAdLibActions.observeChanges(
				{
					bucketId: bucketId,
				},
				cache.BucketAdLibActions.link(() => {
					// Check if the ShowStyleBaseIds needs updating
					// TODO - is this over-eager?
					observer.updateShowStyleBaseIds()
				}),
				{
					projection: bucketActionFieldSpecifier,
					signal,
				}
			),
		])

		return observer
	}

	public get cache(): BucketContentCache {
		return this.#cache
	}
}
