import { RundownId, SegmentId, NrcsIngestDataCacheObjId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import {
	NrcsIngestDataCacheObj,
	NrcsIngestCacheType,
	NrcsIngestDataCacheObjRundown,
	NrcsIngestDataCacheObjSegment,
	NrcsIngestDataCacheObjPart,
	IngestRundownWithSource,
} from '@sofie-automation/corelib/dist/dataModel/NrcsIngestDataCache'
import { ProtectedString, protectString, unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import _ from 'underscore'
import { IngestPart, IngestSegment } from '@sofie-automation/blueprints-integration'
import { JobContext } from '../jobs/index.js'
import { getPartId, getSegmentId } from './lib.js'
import { SetOptional } from 'type-fest'
import { groupByToMap, normalizeArrayToMap } from '@sofie-automation/corelib/dist/lib'
import { AnyBulkWriteOperation } from 'mongodb'
import { diffAndReturnLatestObjects } from './model/implementation/utils.js'
import { ICollection } from '../db/index.js'
import { getCurrentTime } from '../lib/index.js'

/**
 * Represents a Rundown in the NRCSIngestDataCache collection and provides methods for interacting with it.
 */
export class NrcsIngestRundownDataCache {
	readonly #changedDocumentIds = new Set<NrcsIngestDataCacheObjId>()

	private constructor(
		private readonly context: JobContext,
		private readonly collection: ICollection<NrcsIngestDataCacheObj>,
		private readonly rundownId: RundownId,
		private documents: NrcsIngestDataCacheObj[]
	) {}

	static async create(context: JobContext, rundownId: RundownId): Promise<NrcsIngestRundownDataCache> {
		const docs = await context.directCollections.NrcsIngestDataCache.findFetch({ rundownId })

		return new NrcsIngestRundownDataCache(context, context.directCollections.NrcsIngestDataCache, rundownId, docs)
	}

	/**
	 * Fetch the IngestRundown contained in the cache
	 * Note: This does not deep clone the objects, so the returned object should not be modified
	 */
	fetchRundown(): IngestRundownWithSource | undefined {
		const span = this.context.startSpan('ingest.ingestCache.loadCachedRundownData')

		const cachedRundown = this.documents.find(
			(e): e is NrcsIngestDataCacheObjRundown => e.type === NrcsIngestCacheType.RUNDOWN
		)
		if (!cachedRundown) {
			span?.end()
			return undefined
		}

		const ingestRundown: IngestRundownWithSource = {
			...cachedRundown.data,
			segments: [],
		}

		const hasSegmentId = (
			obj: NrcsIngestDataCacheObj
		): obj is NrcsIngestDataCacheObjSegment | NrcsIngestDataCacheObjPart => {
			return !!obj.segmentId
		}

		const segmentMap = groupByToMap(this.documents.filter(hasSegmentId), 'segmentId')
		for (const objs of segmentMap.values()) {
			const segmentEntry = objs.find(
				(e): e is NrcsIngestDataCacheObjSegment => e.type === NrcsIngestCacheType.SEGMENT
			)
			if (segmentEntry) {
				const ingestSegment: IngestSegment = {
					...segmentEntry.data,
					parts: [],
				}

				for (const entry of objs) {
					if (entry.type === NrcsIngestCacheType.PART) {
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
	 * Replace the contents of the cache with the given IngestRundown
	 * This will diff and replace the documents in the cache
	 * @param ingestRundown The new IngestRundown to store in the cache
	 */
	replace(ingestRundown: IngestRundownWithSource): void {
		const generator = new RundownIngestDataCacheGenerator(this.rundownId)
		const cacheEntries: NrcsIngestDataCacheObj[] = generator.generateCacheForRundown(ingestRundown)

		this.documents = diffAndReturnLatestObjects(this.#changedDocumentIds, this.documents, cacheEntries)
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
	 * Write any changes in the cache to the database
	 */
	async saveToDatabase(): Promise<void> {
		if (this.#changedDocumentIds.size === 0) return

		const documentsMap = normalizeArrayToMap(this.documents, '_id')

		const modifiedTime = getCurrentTime()

		const updates: AnyBulkWriteOperation<NrcsIngestDataCacheObj>[] = []
		const removedIds: NrcsIngestDataCacheObjId[] = []
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
 * Convenience methods useful when interacting with the NrcsIngestRundownDataCache
 */
class RundownIngestDataCacheGenerator<TId extends ProtectedString<any>> {
	constructor(public readonly rundownId: RundownId) {}

	getPartObjectId(partExternalId: string): TId {
		return protectString<TId>(`${this.rundownId}_part_${partExternalId}`)
	}
	getSegmentObjectId(segmentExternalId: string): TId {
		return protectString<TId>(`${this.rundownId}_segment_${segmentExternalId}`)
	}
	getRundownObjectId(): TId {
		return protectString<TId>(unprotectString(this.rundownId))
	}

	generatePartObject(segmentId: SegmentId, part: IngestPart): NrcsIngestDataCacheObjPart {
		return {
			_id: this.getPartObjectId(part.externalId),
			type: NrcsIngestCacheType.PART,
			rundownId: this.rundownId,
			segmentId: segmentId,
			partId: getPartId(this.rundownId, part.externalId),
			modified: 0, // Populated when saving
			data: part,
		}
	}

	generateSegmentObject(ingestSegment: SetOptional<IngestSegment, 'parts'>): NrcsIngestDataCacheObjSegment {
		return {
			_id: this.getSegmentObjectId(ingestSegment.externalId),
			type: NrcsIngestCacheType.SEGMENT,
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
		ingestRundown: SetOptional<IngestRundownWithSource, 'segments'>
	): NrcsIngestDataCacheObjRundown {
		return {
			_id: this.getRundownObjectId(),
			type: NrcsIngestCacheType.RUNDOWN,
			rundownId: this.rundownId,
			modified: 0, // Populated when saving
			data: {
				...ingestRundown,
				segments: [], // omit the segments, they come as separate objects
			},
		}
	}

	generateCacheForRundown(ingestRundown: IngestRundownWithSource): NrcsIngestDataCacheObj[] {
		const cacheEntries: NrcsIngestDataCacheObj[] = []

		const rundown = this.generateRundownObject(ingestRundown)
		cacheEntries.push(rundown)

		for (const segment of ingestRundown.segments) {
			cacheEntries.push(...this.generateCacheForSegment(segment))
		}

		return cacheEntries
	}

	private generateCacheForSegment(ingestSegment: IngestSegment): NrcsIngestDataCacheObj[] {
		const cacheEntries: Array<NrcsIngestDataCacheObjSegment | NrcsIngestDataCacheObjPart> = []

		const segment = this.generateSegmentObject(ingestSegment)
		cacheEntries.push(segment)

		const segmentId = getSegmentId(this.rundownId, ingestSegment.externalId)
		for (const part of ingestSegment.parts) {
			cacheEntries.push(this.generatePartObject(segmentId, part))
		}

		return cacheEntries
	}
}
