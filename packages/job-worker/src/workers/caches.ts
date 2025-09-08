import { DBStudio } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { parseBlueprintDocument, WrappedShowStyleBlueprint, WrappedStudioBlueprint } from '../blueprints/cache.js'
import { ReadonlyDeep } from 'type-fest'
import { IDirectCollections } from '../db/index.js'
import {
	BlueprintId,
	ShowStyleBaseId,
	ShowStyleVariantId,
	StudioId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { BlueprintManifestType } from '@sofie-automation/blueprints-integration'
import { ProcessedShowStyleConfig, ProcessedStudioConfig } from '../blueprints/config.js'
import { DefaultStudioBlueprint } from '../blueprints/defaults/studio.js'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { clone, deepFreeze } from '@sofie-automation/corelib/dist/lib'
import { logger } from '../logging.js'
import deepmerge from 'deepmerge'
import { JobStudio, ProcessedShowStyleBase, ProcessedShowStyleVariant, StudioCacheContext } from '../jobs/index.js'
import { StudioCacheContextImpl } from './context/StudioCacheContextImpl.js'
import { convertStudioToJobStudio } from '../jobs/studio.js'

/**
 * A Wrapper to maintain a cache and provide a context using the cache when appropriate
 */
export interface WorkerDataCacheWrapper {
	get studioId(): StudioId

	invalidateCaches(data: ReadonlyDeep<InvalidateWorkerDataCache>): void

	processInvalidations(): Promise<void>

	createStudioCacheContext(): StudioCacheContext
}

/**
 * A Wrapper class to maintain a cache and provide a context using the cache when appropriate
 */
export class WorkerDataCacheWrapperImpl implements WorkerDataCacheWrapper {
	readonly #collections: IDirectCollections
	readonly #dataCache: WorkerDataCache
	#pendingCacheInvalidations: InvalidateWorkerDataCache | undefined

	/**
	 * The StudioId the cache is maintained for
	 */
	get studioId(): StudioId {
		return this.#dataCache.rawStudio._id
	}

	constructor(collections: IDirectCollections, dataCache: WorkerDataCache) {
		this.#collections = collections
		this.#dataCache = dataCache
	}

	static async create(collections: IDirectCollections, studioId: StudioId): Promise<WorkerDataCacheWrapper> {
		const dataCache = await loadWorkerDataCache(collections, studioId)

		return new WorkerDataCacheWrapperImpl(collections, dataCache)
	}

	/**
	 * Queue an invalidation of a portion of the cache. This will be processed when requested
	 * @param data The Invalidation fragment
	 */
	invalidateCaches(data: ReadonlyDeep<InvalidateWorkerDataCache>): void {
		// Store the invalidation for later
		if (!this.#pendingCacheInvalidations) {
			this.#pendingCacheInvalidations = clone<InvalidateWorkerDataCache>(data)
		} else {
			this.#pendingCacheInvalidations = deepmerge<InvalidateWorkerDataCache>(
				this.#pendingCacheInvalidations,
				data as InvalidateWorkerDataCache
			)
		}
	}

	/**
	 * Process a pending invalidation of the cache
	 */
	async processInvalidations(): Promise<void> {
		if (this.#pendingCacheInvalidations) {
			// Move the invalidations off of the class before running the async method, to avoid race conditions
			const invalidations = this.#pendingCacheInvalidations
			this.#pendingCacheInvalidations = undefined

			await invalidateWorkerDataCache(this.#collections, this.#dataCache, invalidations)
		}
	}

	/**
	 * Create a StudioCacheContext based on this cache
	 */
	createStudioCacheContext(): StudioCacheContext {
		return new StudioCacheContextImpl(this.#collections, this.#dataCache)
	}
}

/**
 * A collection of properties that form the basis of the JobContext.
 * This is a reusable cache of these properties
 */
export interface WorkerDataCache {
	/**
	 * The Studio the cache belongs to
	 * This has any ObjectWithOverrides in their original form
	 */
	rawStudio: ReadonlyDeep<DBStudio>
	/**
	 * The Studio the cache belongs to.
	 * This has any ObjectWithOverrides in their computed/flattened form
	 */
	jobStudio: ReadonlyDeep<JobStudio>
	studioBlueprint: ReadonlyDeep<WrappedStudioBlueprint>
	studioBlueprintConfig: ProcessedStudioConfig | undefined

	showStyleBases: Map<ShowStyleBaseId, ReadonlyDeep<ProcessedShowStyleBase> | null> // null when not found
	showStyleVariants: Map<ShowStyleVariantId, ReadonlyDeep<ProcessedShowStyleVariant> | null> // null when not found
	showStyleBlueprints: Map<BlueprintId, ReadonlyDeep<WrappedShowStyleBlueprint> | null> // null when not found
	showStyleBlueprintConfig: Map<ShowStyleVariantId, ProcessedShowStyleConfig>
}

export interface InvalidateWorkerDataCache {
	forceAll: boolean
	studio: boolean
	blueprints: Array<BlueprintId>
	showStyleBases: Array<ShowStyleBaseId>
	showStyleVariants: Array<ShowStyleVariantId>
}

export function createInvalidateWorkerDataCache(): InvalidateWorkerDataCache {
	return {
		forceAll: false,
		studio: false,
		blueprints: [],
		showStyleBases: [],
		showStyleVariants: [],
	}
}

export async function loadWorkerDataCache(
	// queueOptions: QueueOptions,
	collections: Readonly<IDirectCollections>,
	studioId: StudioId
): Promise<WorkerDataCache> {
	// Load some 'static' data from the db
	const dbStudio = await collections.Studios.findOne(studioId)
	if (!dbStudio) throw new Error('Missing studio')
	const studio = deepFreeze(dbStudio)
	const studioBlueprint = await loadStudioBlueprintOrPlaceholder(collections, studio)

	const jobStudio = deepFreeze(convertStudioToJobStudio(dbStudio))

	return {
		rawStudio: studio,
		jobStudio: jobStudio,
		studioBlueprint,
		studioBlueprintConfig: undefined,

		showStyleBases: new Map(),
		showStyleVariants: new Map(),
		showStyleBlueprints: new Map(),
		showStyleBlueprintConfig: new Map(),
	}
}

export async function invalidateWorkerDataCache(
	collections: Readonly<IDirectCollections>,
	cache: WorkerDataCache,
	data: ReadonlyDeep<InvalidateWorkerDataCache>
): Promise<void> {
	if (data.forceAll) {
		// Clear everything!

		const newStudio = await collections.Studios.findOne(cache.rawStudio._id)
		if (!newStudio) throw new Error(`Studio is missing during cache invalidation!`)
		cache.rawStudio = deepFreeze(newStudio)
		cache.jobStudio = deepFreeze(convertStudioToJobStudio(newStudio))

		cache.studioBlueprint = await loadStudioBlueprintOrPlaceholder(collections, cache.rawStudio)
		cache.studioBlueprintConfig = undefined

		cache.showStyleBases.clear()
		cache.showStyleVariants.clear()
		cache.showStyleBlueprints.clear()
		cache.showStyleBlueprintConfig.clear()

		return
	}

	let updateStudioBlueprint = false

	if (data.studio) {
		logger.debug('WorkerDataCache: Reloading studio')
		const newStudio = await collections.Studios.findOne(cache.rawStudio._id)
		if (!newStudio) throw new Error(`Studio is missing during cache invalidation!`)

		// If studio blueprintId changed, then force it to be reloaded
		if (newStudio.blueprintId !== cache.rawStudio.blueprintId) updateStudioBlueprint = true

		cache.rawStudio = deepFreeze(newStudio)
		cache.jobStudio = deepFreeze(convertStudioToJobStudio(newStudio))
		cache.studioBlueprintConfig = undefined
	}

	// Check if studio blueprint was in the changed list
	if (!updateStudioBlueprint && cache.rawStudio.blueprintId) {
		updateStudioBlueprint = data.blueprints.includes(cache.rawStudio.blueprintId)
	}

	// Reload studioBlueprint
	if (updateStudioBlueprint) {
		logger.debug('WorkerDataCache: Reloading studioBlueprint')
		cache.studioBlueprint = await loadStudioBlueprintOrPlaceholder(collections, cache.rawStudio)
		cache.studioBlueprintConfig = undefined
	}

	const purgeShowStyleVariants = (keep: (variant: ReadonlyDeep<ProcessedShowStyleVariant>) => boolean) => {
		for (const [id, v] of Array.from(cache.showStyleVariants.entries())) {
			if (v === null || !keep(v)) {
				logger.debug(`WorkerDataCache: Discarding ShowStyleVariant "${id}"`)
				cache.showStyleVariants.delete(id)
				cache.showStyleBlueprintConfig.delete(id)
			}
		}
	}

	if (data.studio) {
		// Ensure showStyleBases & showStyleVariants are all still valid for the studio
		const allowedBases = new Set(cache.rawStudio.supportedShowStyleBase)

		for (const id of Array.from(cache.showStyleBases.keys())) {
			if (!allowedBases.has(id)) {
				logger.debug(`WorkerDataCache: Discarding showStyleBase "${id}"`)
				cache.showStyleBases.delete(id)
			}
		}

		purgeShowStyleVariants((v) => allowedBases.has(v.showStyleBaseId))

		// Blueprints get cleaned up at the end
	}

	// Future: inactivity timeout for everything/anything showstyle?
	// Future: this is all a bit too agressive, it would be better to have a grace period as it likely that the owning ShowStyleBase will be reloaded soon

	// Purge any ShowStyleBase (and its Variants) that has changes
	for (const id of data.showStyleBases) {
		logger.debug(`WorkerDataCache: Discarding showStyleBase "${id}"`)
		cache.showStyleBases.delete(id)

		purgeShowStyleVariants((v) => v.showStyleBaseId !== id)
	}

	// Purge any ShowtStyleVariant that has changes
	if (data.showStyleVariants.length > 0) {
		const variantIds = new Set(data.showStyleVariants)
		purgeShowStyleVariants((v) => !variantIds.has(v._id))
	}

	{
		// Clear out any currently unreferenced blueprints
		const allowedBlueprints = new Set<BlueprintId>()
		for (const showStyleBase of cache.showStyleBases.values()) {
			if (showStyleBase) {
				allowedBlueprints.add(showStyleBase.blueprintId)
			}
		}
		const removedBlueprints = new Set<BlueprintId>()
		for (const id of cache.showStyleBlueprints.keys()) {
			if (!allowedBlueprints.has(id)) {
				logger.debug(`WorkerDataCache: Discarding unreferenced Blueprint "${id}"`)

				cache.showStyleBlueprints.delete(id)
				removedBlueprints.add(id)
			}
		}
		// Clear out changed blueprints
		for (const id of data.blueprints) {
			logger.debug(`WorkerDataCache: Discarding changed Blueprint "${id}"`)

			cache.showStyleBlueprints.delete(id)
			removedBlueprints.add(id)
		}

		if (removedBlueprints.size > 0) {
			const cleanupBases = new Set<ShowStyleBaseId>()

			// Figure out which bases used the blueprint
			for (const [baseId, base] of cache.showStyleBases.entries()) {
				if (base && removedBlueprints.has(base.blueprintId)) {
					cleanupBases.add(baseId)
				}
			}

			if (cleanupBases.size > 0) {
				for (const [variantId, variant] of cache.showStyleVariants.entries()) {
					if (variant && cleanupBases.has(variant.showStyleBaseId)) {
						logger.debug(`WorkerDataCache: Discarding cached config for ShowStyleVariant "${variantId}"`)
						cache.showStyleBlueprintConfig.delete(variantId)
					}
				}
			}
		}
	}
}

async function loadStudioBlueprintOrPlaceholder(
	collections: IDirectCollections,
	studio: ReadonlyDeep<DBStudio>
): Promise<ReadonlyDeep<WrappedStudioBlueprint>> {
	if (!studio.blueprintId) {
		return Object.freeze({
			blueprintDoc: undefined,
			blueprintId: protectString('__placeholder__'),
			blueprint: DefaultStudioBlueprint,
		})
	}

	const blueprintDoc = await collections.Blueprints.findOne(studio.blueprintId)
	const blueprintManifest = await parseBlueprintDocument(blueprintDoc)
	if (!blueprintManifest) {
		throw new Error(`Blueprint "${studio.blueprintId}" not found! (referenced by Studio "${studio._id}")`)
	}

	if (blueprintManifest.blueprintType !== BlueprintManifestType.STUDIO) {
		throw new Error(
			`Blueprint "${studio.blueprintId}" is not valid for a Studio "${studio._id}" (${blueprintManifest.blueprintType})!`
		)
	}

	return Object.freeze({
		blueprintDoc: blueprintDoc,
		blueprintId: studio.blueprintId,
		blueprint: blueprintManifest,
	})
}
