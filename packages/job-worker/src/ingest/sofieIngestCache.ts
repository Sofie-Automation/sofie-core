import { RundownId, SegmentId, SofieIngestDataCacheObjId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import {
	SofieIngestDataCacheObj,
	SofieIngestCacheType,
	SofieIngestDataCacheObjRundown,
	SofieIngestDataCacheObjSegment,
	SofieIngestDataCacheObjPart,
	SofieIngestRundownWithSource,
} from '@sofie-automation/corelib/dist/dataModel/SofieIngestDataCache'
import { protectString, unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import _ from 'underscore'
import { SofieIngestPart, SofieIngestSegment } from '@sofie-automation/blueprints-integration'
import { JobContext } from '../jobs/index.js'
import { getPartId, getSegmentId } from './lib.js'
import { SetOptional } from 'type-fest'
import { groupByToMap, normalizeArrayToMap } from '@sofie-automation/corelib/dist/lib'
import { AnyBulkWriteOperation } from 'mongodb'
import { ICollection } from '../db/index.js'
import { getCurrentTime } from '../lib/index.js'

/**
 * Represents a Rundown in the SofieIngestDataCache collection and provides methods for interacting with it.
 */
export class SofieIngestRundownDataCache {
	readonly #changedDocumentIds = new Set<SofieIngestDataCacheObjId>()

	private constructor(
		private readonly context: JobContext,
		private readonly collection: ICollection<SofieIngestDataCacheObj>,
		private documents: SofieIngestDataCacheObj[]
	) {}

	static async create(context: JobContext, rundownId: RundownId): Promise<SofieIngestRundownDataCache> {
		const docs = await context.directCollections.SofieIngestDataCache.findFetch({ rundownId })

		return new SofieIngestRundownDataCache(context, context.directCollections.SofieIngestDataCache, docs)
	}

	/**
	 * Fetch the IngestRundown contained in the cache
	 * Note: This does not deep clone the objects, so the returned object should not be modified
	 */
	fetchRundown(): SofieIngestRundownWithSource | undefined {
		const span = this.context.startSpan('ingest.ingestCache.loadCachedRundownData')

		const cachedRundown = this.documents.find(
			(e): e is SofieIngestDataCacheObjRundown => e.type === SofieIngestCacheType.RUNDOWN
		)
		if (!cachedRundown) {
			span?.end()
			return undefined
		}

		const ingestRundown: SofieIngestRundownWithSource = {
			...cachedRundown.data,
			segments: [],
		}

		const hasSegmentId = (
			obj: SofieIngestDataCacheObj
		): obj is SofieIngestDataCacheObjSegment | SofieIngestDataCacheObjPart => {
			return !!obj.segmentId
		}

		const segmentMap = groupByToMap(this.documents.filter(hasSegmentId), 'segmentId')
		for (const objs of segmentMap.values()) {
			const segmentEntry = objs.find(
				(e): e is SofieIngestDataCacheObjSegment => e.type === SofieIngestCacheType.SEGMENT
			)
			if (segmentEntry) {
				const ingestSegment: SofieIngestSegment = {
					...segmentEntry.data,
					parts: [],
				}

				for (const entry of objs) {
					if (entry.type === SofieIngestCacheType.PART) {
						ingestSegment.parts.push(entry.data)
					}
				}

				ingestSegment.parts = _.sortBy(ingestSegment.parts, (s) => s.rank)
				ingestRundown.segments.push(ingestSegment)
			}
		}

		ingestRundown.segments = _.sortBy(ingestRundown.segments, (s) => s.rank)

		span?.end()
		return ingestRundown
	}

	/**
	 * Delete the contents of the cache
	 */
	delete(): void {
		// Mark each document for deletion
		for (const doc of this.documents) {
			this.#changedDocumentIds.add(doc._id)
		}

		this.documents = []
	}

	/**
	 * Remove all documents from the cache other than the ids provided
	 * @param documentIdsToKeep The IDs of the documents to keep in the cache
	 */
	removeAllOtherDocuments(documentIdsToKeep: SofieIngestDataCacheObjId[]): void {
		const documentIdsToKeepSet = new Set<SofieIngestDataCacheObjId>(documentIdsToKeep)

		const newDocuments: SofieIngestDataCacheObj[] = []
		for (const document of this.documents) {
			if (!documentIdsToKeepSet.has(document._id)) {
				this.#changedDocumentIds.add(document._id)
			} else {
				newDocuments.push(document)
			}
		}
		this.documents = newDocuments
	}

	/**
	 * Replace/insert a set of documents into the cache
	 * This can be used to insert or update multiple documents at once
	 * This does not diff the documents, it assumes that has already been done prior to calling this method
	 * @param changedCacheObjects Documents to store in the cache
	 */
	replaceDocuments(changedCacheObjects: SofieIngestDataCacheObj[]): void {
		const newDocumentsMap = normalizeArrayToMap(this.documents, '_id')

		for (const newDocument of changedCacheObjects) {
			this.#changedDocumentIds.add(newDocument._id)
			newDocumentsMap.set(newDocument._id, newDocument)
		}

		this.documents = Array.from(newDocumentsMap.values())
	}

	/**
	 * Write any changes in the cache to the database
	 */
	async saveToDatabase(): Promise<void> {
		if (this.#changedDocumentIds.size === 0) return

		const documentsMap = normalizeArrayToMap(this.documents, '_id')

		const modifiedTime = getCurrentTime()

		const updates: AnyBulkWriteOperation<SofieIngestDataCacheObj>[] = []
		const removedIds: SofieIngestDataCacheObjId[] = []
		for (const changedId of this.#changedDocumentIds) {
			const newDoc = documentsMap.get(changedId)
			if (!newDoc) {
				removedIds.push(changedId)
			} else {
				updates.push({
					replaceOne: {
						filter: {
							_id: changedId,
						},
						replacement: {
							...newDoc,
							modified: modifiedTime,
						},
						upsert: true,
					},
				})
			}
		}

		if (removedIds.length) {
			updates.push({
				deleteMany: {
					filter: {
						_id: { $in: removedIds as any },
					},
				},
			})
		}

		await this.collection.bulkWrite(updates)
	}
}

/**
 * Convenience methods useful when interacting with the SofieIngestRundownDataCache
 */
export class SofieIngestRundownDataCacheGenerator {
	constructor(public readonly rundownId: RundownId) {}

	getPartObjectId(partExternalId: string): SofieIngestDataCacheObjId {
		return protectString<SofieIngestDataCacheObjId>(`${this.rundownId}_part_${partExternalId}`)
	}
	getSegmentObjectId(segmentExternalId: string): SofieIngestDataCacheObjId {
		return protectString<SofieIngestDataCacheObjId>(`${this.rundownId}_segment_${segmentExternalId}`)
	}
	getRundownObjectId(): SofieIngestDataCacheObjId {
		return protectString<SofieIngestDataCacheObjId>(unprotectString(this.rundownId))
	}

	generatePartObject(segmentId: SegmentId, part: SofieIngestPart): SofieIngestDataCacheObjPart {
		return {
			_id: this.getPartObjectId(part.externalId),
			type: SofieIngestCacheType.PART,
			rundownId: this.rundownId,
			segmentId: segmentId,
			partId: getPartId(this.rundownId, part.externalId),
			modified: 0, // Populated when saving
			data: part,
		}
	}

	generateSegmentObject(ingestSegment: SetOptional<SofieIngestSegment, 'parts'>): SofieIngestDataCacheObjSegment {
		return {
			_id: this.getSegmentObjectId(ingestSegment.externalId),
			type: SofieIngestCacheType.SEGMENT,
			rundownId: this.rundownId,
			segmentId: getSegmentId(this.rundownId, ingestSegment.externalId),
			modified: 0, // Populated when saving
			data: {
				...ingestSegment,
				parts: [], // omit the parts, they come as separate objects
			},
		}
	}

	generateRundownObject(
		ingestRundown: SetOptional<SofieIngestRundownWithSource, 'segments'>
	): SofieIngestDataCacheObjRundown {
		return {
			_id: this.getRundownObjectId(),
			type: SofieIngestCacheType.RUNDOWN,
			rundownId: this.rundownId,
			modified: 0, // Populated when saving
			data: {
				...ingestRundown,
				segments: [], // omit the segments, they come as separate objects
			},
		}
	}

	generateCacheForRundown(ingestRundown: SofieIngestRundownWithSource): SofieIngestDataCacheObj[] {
		const cacheEntries: SofieIngestDataCacheObj[] = []

		const rundown = this.generateRundownObject(ingestRundown)
		cacheEntries.push(rundown)

		for (const segment of ingestRundown.segments) {
			cacheEntries.push(...this.generateCacheForSegment(segment))
		}

		return cacheEntries
	}

	private generateCacheForSegment(ingestSegment: SofieIngestSegment): SofieIngestDataCacheObj[] {
		const cacheEntries: Array<SofieIngestDataCacheObjSegment | SofieIngestDataCacheObjPart> = []

		const segment = this.generateSegmentObject(ingestSegment)
		cacheEntries.push(segment)

		const segmentId = getSegmentId(this.rundownId, ingestSegment.externalId)
		for (const part of ingestSegment.parts) {
			cacheEntries.push(this.generatePartObject(segmentId, part))
		}

		return cacheEntries
	}
}
