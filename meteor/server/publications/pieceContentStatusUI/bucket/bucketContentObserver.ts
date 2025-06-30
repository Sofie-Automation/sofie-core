import { Meteor } from 'meteor/meteor'
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
import { ReactiveMongoObserverGroup, ReactiveMongoObserverGroupHandle } from '../../lib/observerGroup'
import _ from 'underscore'
import { waitForAllObserversReady } from '../../lib/lib'

const REACTIVITY_DEBOUNCE = 20

function convertShowStyleBase(doc: Pick<DBShowStyleBase, ShowStyleBaseFields>): Omit<SourceLayersDoc, '_id'> {
	return {
		blueprintId: doc.blueprintId,
		sourceLayers: applyAndValidateOverrides(doc.sourceLayersWithOverrides).obj,
	}
}

export class BucketContentObserver implements Meteor.LiveQueryHandle {
	#observers: Meteor.LiveQueryHandle[] = []
	#cache: BucketContentCache

	#showStyleBaseIds: ShowStyleBaseId[] = []
	#showStyleBaseIdObserver!: ReactiveMongoObserverGroupHandle

	#blueprintIds: BlueprintId[] = []
	#blueprintIdObserver!: ReactiveMongoObserverGroupHandle

	#disposed = false

	private constructor(cache: BucketContentCache) {
		this.#cache = cache
	}

	static async create(bucketId: BucketId, cache: BucketContentCache): Promise<BucketContentObserver> {
		logger.silly(`Creating BucketContentObserver for "${bucketId}"`)

		const observer = new BucketContentObserver(cache)

		// Run the ShowStyleBase query in a ReactiveMongoObserverGroup, so that it can be restarted whenever
		observer.#showStyleBaseIdObserver = await ReactiveMongoObserverGroup(async () => {
			// Clear already cached data
			cache.ShowStyleSourceLayers.remove({})

			return [
				ShowStyleBases.observe(
					{
						// We can use the `this.#showStyleBaseIds` here, as this is restarted every time that property changes
						_id: { $in: observer.#showStyleBaseIds },
					},
					{
						added: (doc) => {
							const newDoc = convertShowStyleBase(doc)
							cache.ShowStyleSourceLayers.upsert(doc._id, { $set: newDoc as Partial<Document> })
							observer.updateBlueprintIds()
						},
						changed: (doc) => {
							const newDoc = convertShowStyleBase(doc)
							cache.ShowStyleSourceLayers.upsert(doc._id, { $set: newDoc as Partial<Document> })
							observer.updateBlueprintIds()
						},
						removed: (doc) => {
							cache.ShowStyleSourceLayers.remove(doc._id)
							observer.updateBlueprintIds()
						},
					},
					{
						projection: showStyleBaseFieldSpecifier,
					}
				),
			]
		})

		// Run the Blueprint query in a ReactiveMongoObserverGroup, so that it can be restarted whenever
		observer.#blueprintIdObserver = await ReactiveMongoObserverGroup(async () => {
			// Clear already cached data
			cache.Blueprints.remove({})

			logger.silly(`optimized observer restarting ${observer.#blueprintIds}`)

			return [
				Blueprints.observeChanges(
					{
						// We can use the `this.#blueprintIds` here, as this is restarted every time that property changes
						_id: { $in: observer.#blueprintIds },
					},
					cache.Blueprints.link(),
					{
						projection: blueprintFieldSpecifier,
					}
				),
			]
		})

		// Subscribe to the database, and pipe any updates into the ReactiveCacheCollections
		// This takes ownership of the #showStyleBaseIdObserver, and will stop it if this throws
		observer.#observers = await waitForAllObserversReady([
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
				}
			),

			observer.#showStyleBaseIdObserver,
			observer.#blueprintIdObserver,
		])

		return observer
	}

	private updateShowStyleBaseIds = _.debounce(
		Meteor.bindEnvironment(() => {
			if (this.#disposed) return

			const newShowStyleBaseIdsSet = new Set<ShowStyleBaseId>()
			this.#cache.BucketAdLibs.find({}).forEach((adlib) => newShowStyleBaseIdsSet.add(adlib.showStyleBaseId))
			this.#cache.BucketAdLibActions.find({}).forEach((action) =>
				newShowStyleBaseIdsSet.add(action.showStyleBaseId)
			)

			const newShowStyleBaseIds = Array.from(newShowStyleBaseIdsSet)

			if (!equivalentArrays(newShowStyleBaseIds, this.#showStyleBaseIds)) {
				this.#showStyleBaseIds = newShowStyleBaseIds
				// trigger the rundown group to restart
				this.#showStyleBaseIdObserver.restart()
			}
		}),
		REACTIVITY_DEBOUNCE
	)

	private updateBlueprintIds = _.debounce(
		Meteor.bindEnvironment(() => {
			if (this.#disposed) return

			const newBlueprintIds = _.uniq(this.#cache.ShowStyleSourceLayers.find({}).map((rd) => rd.blueprintId))

			if (!equivalentArrays(newBlueprintIds, this.#blueprintIds)) {
				logger.silly(`optimized observer changed ids ${JSON.stringify(newBlueprintIds)} ${this.#blueprintIds}`)
				this.#blueprintIds = newBlueprintIds
				// trigger the rundown group to restart
				this.#blueprintIdObserver.restart()
			}
		}),
		REACTIVITY_DEBOUNCE
	)

	public get cache(): BucketContentCache {
		return this.#cache
	}

	public stop = (): void => {
		this.#disposed = true

		this.#observers.forEach((observer) => observer.stop())
	}
}
