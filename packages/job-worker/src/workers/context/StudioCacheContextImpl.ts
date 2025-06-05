import { IDirectCollections } from '../../db/index.js'
import {
	ProcessedShowStyleBase,
	ProcessedShowStyleVariant,
	ProcessedShowStyleCompound,
	StudioCacheContext,
	JobStudio,
} from '../../jobs/index.js'
import { ReadonlyDeep } from 'type-fest'
import { WorkerDataCache } from '../caches.js'
import { DBStudio } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { ShowStyleBaseId, ShowStyleVariantId, StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { parseBlueprintDocument, WrappedShowStyleBlueprint, WrappedStudioBlueprint } from '../../blueprints/cache.js'
import { ReadonlyObjectDeep } from 'type-fest/source/readonly-deep'
import { DBShowStyleBase } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { clone, deepFreeze } from '@sofie-automation/corelib/dist/lib'
import { createShowStyleCompound } from '../../showStyles.js'
import { BlueprintManifestType } from '@sofie-automation/blueprints-integration'
import {
	preprocessShowStyleConfig,
	preprocessStudioConfig,
	ProcessedShowStyleConfig,
	ProcessedStudioConfig,
} from '../../blueprints/config.js'

import { processShowStyleBase, processShowStyleVariant } from '../../jobs/showStyle.js'

export class StudioCacheContextImpl implements StudioCacheContext {
	constructor(
		readonly directCollections: Readonly<IDirectCollections>,
		protected readonly cacheData: WorkerDataCache
	) {}

	get studio(): ReadonlyDeep<JobStudio> {
		// This is frozen at the point of populating the cache
		return this.cacheData.jobStudio
	}

	get rawStudio(): ReadonlyDeep<DBStudio> {
		// This is frozen at the point of populating the cache
		return this.cacheData.rawStudio
	}

	get studioId(): StudioId {
		return this.studio._id
	}

	get studioBlueprint(): ReadonlyObjectDeep<WrappedStudioBlueprint> {
		// This is frozen at the point of populating the cache
		return this.cacheData.studioBlueprint
	}

	getStudioBlueprintConfig(): ProcessedStudioConfig {
		if (!this.cacheData.studioBlueprintConfig) {
			this.cacheData.studioBlueprintConfig = deepFreeze(
				clone(
					preprocessStudioConfig(this.cacheData.jobStudio, this.cacheData.studioBlueprint.blueprint) ?? null
				)
			)
		}

		return this.cacheData.studioBlueprintConfig
	}

	async getShowStyleBases(): Promise<ReadonlyDeep<Array<ProcessedShowStyleBase>>> {
		const docsToLoad: ShowStyleBaseId[] = []
		const loadedDocs: Array<ReadonlyDeep<ProcessedShowStyleBase>> = []

		// Figure out what is already cached, and what needs loading
		for (const id of this.cacheData.jobStudio.supportedShowStyleBase) {
			const doc = this.cacheData.showStyleBases.get(id)
			if (doc === undefined) {
				docsToLoad.push(id)
			} else if (doc) {
				loadedDocs.push(doc)
			} else {
				// Doc missing in db
			}
		}

		// Load the uncached docs
		if (docsToLoad.length > 0) {
			const newDocs = await this.directCollections.ShowStyleBases.findFetch({ _id: { $in: docsToLoad } })

			// First mark them all in the cache as loaded
			for (const id of docsToLoad) {
				this.cacheData.showStyleBases.set(id, null)
			}

			// Now fill it in with the loaded docs
			for (const doc0 of newDocs) {
				// Freeze and cache it
				const doc = processShowStyleBase(doc0)
				this.cacheData.showStyleBases.set(doc._id, doc ?? null)

				// Add it to the result
				loadedDocs.push(doc)
			}
		}

		return loadedDocs
	}

	async getShowStyleBase(id: ShowStyleBaseId): Promise<ReadonlyDeep<ProcessedShowStyleBase>> {
		// Check if allowed
		if (!this.cacheData.jobStudio.supportedShowStyleBase.includes(id)) {
			throw new Error(`ShowStyleBase "${id}" is not allowed in studio`)
		}

		let doc = this.cacheData.showStyleBases.get(id)
		if (doc === undefined) {
			// Load the document
			const doc0 = await this.directCollections.ShowStyleBases.findOne(id)

			// Freeze and cache it
			if (doc0) {
				doc = processShowStyleBase(doc0)
				this.cacheData.showStyleBases.set(id, doc)
			} else {
				this.cacheData.showStyleBases.set(id, null)
			}
		}

		if (doc) {
			// Return the raw doc, as it was frozen before being cached
			return doc
		}

		throw new Error(`ShowStyleBase "${id}" does not exist`)
	}

	async getShowStyleVariants(id: ShowStyleBaseId): Promise<ReadonlyDeep<Array<ProcessedShowStyleVariant>>> {
		// Check if allowed
		if (!this.cacheData.jobStudio.supportedShowStyleBase.includes(id)) {
			throw new Error(`ShowStyleBase "${id}" is not allowed in studio`)
		}

		// This is a weirder one, as we can't efficiently know if we have them all loaded, due to needing to lookup docs that contain the id, with no master list of ids to check

		const loadedDocs: Array<ReadonlyDeep<ProcessedShowStyleVariant>> = []

		// Find all the ones already cached
		for (const doc of this.cacheData.showStyleVariants.values()) {
			if (doc && doc.showStyleBaseId === id) {
				loadedDocs.push(doc)
			}
		}

		// Do a search for more
		const uncachedDocs = await this.directCollections.ShowStyleVariants.findFetch({
			showStyleBaseId: id,
			_id: { $nin: loadedDocs.map((d) => d._id) },
		})

		// Cache the freshly loaded docs,
		for (const doc0 of uncachedDocs) {
			// Freeze and cache it
			const doc = processShowStyleVariant(doc0)
			this.cacheData.showStyleVariants.set(doc._id, doc)

			loadedDocs.push(doc)
		}

		loadedDocs.sort((a, b) => {
			if (a._rank > b._rank) return 1
			if (a._rank < b._rank) return -1
			if (a.name > b.name) return 1
			if (a.name < b.name) return -1
			if (a._id > b._id) return 1
			if (a._id < b._id) return -1
			return 0
		})

		return loadedDocs
	}
	async getShowStyleVariant(id: ShowStyleVariantId): Promise<ReadonlyDeep<ProcessedShowStyleVariant>> {
		let doc = this.cacheData.showStyleVariants.get(id)
		if (doc === undefined) {
			// Load the document
			const doc0 = await this.directCollections.ShowStyleVariants.findOne(id)

			// Check allowed
			if (doc0 && !this.cacheData.jobStudio.supportedShowStyleBase.includes(doc0.showStyleBaseId)) {
				throw new Error(`ShowStyleVariant "${id}" is not allowed in studio`)
			}

			// Freeze and cache it
			if (doc0) {
				doc = processShowStyleVariant(doc0)
				this.cacheData.showStyleVariants.set(id, doc)
			} else {
				this.cacheData.showStyleVariants.set(id, null)
			}
		}

		if (doc) {
			// Check allowed
			if (!this.cacheData.jobStudio.supportedShowStyleBase.includes(doc.showStyleBaseId)) {
				throw new Error(`ShowStyleVariant "${id}" is not allowed in studio`)
			}

			// Return the raw doc, as it was frozen before being cached
			return doc
		}

		throw new Error(`ShowStyleVariant "${id}" does not exist`)
	}
	async getShowStyleCompound(
		variantId: ShowStyleVariantId,
		baseId?: ShowStyleBaseId
	): Promise<ReadonlyDeep<ProcessedShowStyleCompound>> {
		const [variant, base0] = await Promise.all([
			this.getShowStyleVariant(variantId),
			baseId ? this.getShowStyleBase(baseId) : null,
		])

		const base = base0 ?? (await this.getShowStyleBase(variant.showStyleBaseId))

		const compound = createShowStyleCompound(base, variant)

		if (!compound) {
			throw new Error(`Failed to compile ShowStyleCompound for base "${base._id}" and variant  "${variant._id}"`)
		}

		return compound
	}

	async getShowStyleBlueprint(id: ShowStyleBaseId): Promise<ReadonlyDeep<WrappedShowStyleBlueprint>> {
		const showStyle = await this.getShowStyleBase(id)

		let blueprint = this.cacheData.showStyleBlueprints.get(showStyle.blueprintId)
		if (blueprint === undefined) {
			// Load the document
			blueprint = await loadShowStyleBlueprint(this.directCollections, showStyle).catch(() => undefined)

			// cache it. It is frozen by the loader
			this.cacheData.showStyleBlueprints.set(showStyle.blueprintId, blueprint ?? null)
		}

		if (blueprint) {
			// Return the raw doc, as it was frozen before being cached
			return blueprint
		}

		throw new Error(`Blueprint for ShowStyleBase "${id}" does not exist`)
	}
	getShowStyleBlueprintConfig(showStyle: ProcessedShowStyleCompound): ProcessedShowStyleConfig {
		const existing = this.cacheData.showStyleBlueprintConfig.get(showStyle.showStyleVariantId)
		if (existing) {
			return existing
		}

		const blueprint = this.cacheData.showStyleBlueprints.get(showStyle.blueprintId)
		if (!blueprint)
			throw new Error(`Blueprint "${showStyle.blueprintId}" must be loaded before its config can be retrieved`)

		const config = deepFreeze(
			clone(preprocessShowStyleConfig(showStyle, blueprint.blueprint, this.studio.settings))
		)
		this.cacheData.showStyleBlueprintConfig.set(showStyle.showStyleVariantId, config)

		// Return the raw object, as it was frozen before being cached
		return config
	}
}

async function loadShowStyleBlueprint(
	collections: IDirectCollections,
	showStyleBase: Pick<ReadonlyDeep<DBShowStyleBase>, '_id' | 'blueprintId'>
): Promise<ReadonlyDeep<WrappedShowStyleBlueprint>> {
	if (!showStyleBase.blueprintId) {
		throw new Error(`ShowStyleBase "${showStyleBase._id}" has no defined blueprint!`)
	}

	const blueprintDoc = await collections.Blueprints.findOne(showStyleBase.blueprintId)
	const blueprintManifest = await parseBlueprintDocument(blueprintDoc)
	if (!blueprintManifest) {
		throw new Error(
			`Blueprint "${showStyleBase.blueprintId}" not found! (referenced by ShowStyleBase "${showStyleBase._id}")`
		)
	}

	if (blueprintManifest.blueprintType !== BlueprintManifestType.SHOWSTYLE) {
		throw new Error(
			`Blueprint "${showStyleBase.blueprintId}" is not valid for a ShowStyle "${showStyleBase._id}" (${blueprintManifest.blueprintType})!`
		)
	}

	return Object.freeze({
		blueprintId: showStyleBase.blueprintId,
		blueprint: blueprintManifest,
	})
}
