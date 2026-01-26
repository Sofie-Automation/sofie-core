import { AdLibAction } from '@sofie-automation/corelib/dist/dataModel/AdlibAction'
import { AdLibPiece } from '@sofie-automation/corelib/dist/dataModel/AdLibPiece'
import { Blueprint } from '@sofie-automation/corelib/dist/dataModel/Blueprint'
import { BucketAdLibAction } from '@sofie-automation/corelib/dist/dataModel/BucketAdLibAction'
import { BucketAdLib } from '@sofie-automation/corelib/dist/dataModel/BucketAdLibPiece'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
import { ExpectedPackageDB } from '@sofie-automation/corelib/dist/dataModel/ExpectedPackages'
import { ExpectedPlayoutItem } from '@sofie-automation/corelib/dist/dataModel/ExpectedPlayoutItem'
import { NrcsIngestDataCacheObj } from '@sofie-automation/corelib/dist/dataModel/NrcsIngestDataCache'
import { SofieIngestDataCacheObj } from '@sofie-automation/corelib/dist/dataModel/SofieIngestDataCache'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { PeripheralDevice } from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'
import { PeripheralDeviceCommand } from '@sofie-automation/corelib/dist/dataModel/PeripheralDeviceCommand'
import { Piece } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { PieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { RundownBaselineAdLibAction } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineAdLibAction'
import { RundownBaselineObj } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineObj'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { DBShowStyleBase } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { DBShowStyleVariant } from '@sofie-automation/corelib/dist/dataModel/ShowStyleVariant'
import { DBStudio } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { DBTimelineDatastoreEntry } from '@sofie-automation/corelib/dist/dataModel/TimelineDatastore'
import { TimelineComplete } from '@sofie-automation/corelib/dist/dataModel/Timeline'
import { clone, literal } from '@sofie-automation/corelib/dist/lib'
import {
	FindOptions as CacheFindOptions,
	mongoFindOptions,
	mongoModify,
	mongoWhere,
} from '@sofie-automation/corelib/dist/mongo'
import { ProtectedString } from '@sofie-automation/corelib/dist/protectedString'
import { AnyBulkWriteOperation, Collection, CountOptions, FindOptions } from 'mongodb'
import { ReadonlyDeep } from 'type-fest'
import {
	IChangeStream,
	IChangeStreamEvents,
	ICollection,
	IDirectCollections,
	MongoModifier,
	MongoQuery,
} from '../db/index.js'
import _ from 'underscore'
import { RundownBaselineAdLibItem } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineAdLibPiece'
import { ExternalMessageQueueObj } from '@sofie-automation/corelib/dist/dataModel/ExternalMessageQueue'
import { MediaObjects } from '@sofie-automation/corelib/dist/dataModel/MediaObjects'
import { PackageInfoDB } from '@sofie-automation/corelib/dist/dataModel/PackageInfos'
import type { DBNotificationObj } from '@sofie-automation/corelib/dist/dataModel/Notifications'
import { EventEmitter } from 'events'

export interface CollectionOperation {
	type: string
	args: any[]
}

export class MockMongoCollection<TDoc extends { _id: ProtectedString<any> }> implements ICollection<TDoc> {
	readonly #name: string
	readonly #documents = new Map<TDoc['_id'], TDoc>()
	readonly #ops: CollectionOperation[] = []

	/** Allow watchers to be created on this collection */
	allowWatchers = false

	static fromReal<TDoc extends { _id: ProtectedString<any> }>(col: ICollection<TDoc>): MockMongoCollection<TDoc> {
		// TODO - any type assertion?
		return col as any as MockMongoCollection<TDoc>
	}

	constructor(name: CollectionName) {
		this.#name = name
	}

	get name(): string {
		return this.#name
	}
	get rawCollection(): Collection<TDoc> {
		throw new Error('Not implemented.')
	}

	get operations(): CollectionOperation[] {
		return this.#ops
	}

	clearOpLog(): void {
		this.#ops.length = 0
	}

	async findFetch(selector?: MongoQuery<TDoc>, options?: FindOptions<TDoc>): Promise<TDoc[]> {
		this.#ops.push({ type: 'findFetch', args: [selector, options] })

		return this.findFetchInner(selector, options)
	}

	private async findFetchInner(selector?: MongoQuery<TDoc>, options?: FindOptions<TDoc>): Promise<TDoc[]> {
		if (typeof selector === 'string') selector = { _id: selector }
		selector = selector ?? {}

		const unimplementedUsedOptions = _.without(_.keys(options), 'sort', 'limit', 'projection')
		if (unimplementedUsedOptions.length > 0) {
			throw new Error(`find being performed using unimplemented options: ${unimplementedUsedOptions}`)
		}

		let matchedDocs: TDoc[]
		if (typeof selector._id === 'string') {
			const doc = this.#documents.get(selector._id as any)
			if (doc && mongoWhere(doc, selector)) {
				matchedDocs = [doc]
			} else {
				matchedDocs = []
			}
		} else {
			matchedDocs = Array.from(this.#documents.values()).filter((doc) => mongoWhere(doc, selector as any))
		}

		if (options) {
			let fields: CacheFindOptions<TDoc>['fields']
			if (options.projection) {
				const fields2: any = (fields = {})

				for (const [k, v] of Object.entries<any>(options.projection)) {
					if (v === 0 || v === false) {
						fields2[k] = 0
					} else if (v === 1 || v === true) {
						fields2[k] = 1
					} else {
						throw new Error(`find has invalid value for projection "${k}":"${v}"`)
					}
				}
			}

			let sort: CacheFindOptions<TDoc>['sort']
			if (options.sort) {
				const sort2: any = (sort = {})
				if (typeof options.sort !== 'object') throw new Error(`find expects sort to be an object (for now)`)
				for (const [k, v] of Object.entries<any>(options.sort)) {
					if (v === 1 || v === -1) {
						sort2[k] = v
					} else {
						throw new Error(`find expects an sort value to be an int "${k}":"${v}" (for now)`)
					}
				}
			}

			matchedDocs = mongoFindOptions(matchedDocs, {
				sort: sort,
				limit: options.limit,
				skip: options.skip,
				fields: fields,
			})
		}

		return clone(matchedDocs)
	}
	async findOne(selector?: MongoQuery<TDoc> | TDoc['_id'], options?: FindOptions<TDoc>): Promise<TDoc | undefined> {
		this.#ops.push({ type: 'findOne', args: [selector, options] })

		const docs = await this.findFetchInner(selector, {
			...options,
			limit: 1,
		})
		return docs[0]
	}
	async count(selector?: MongoQuery<TDoc> | TDoc['_id'], options?: CountOptions): Promise<number> {
		this.#ops.push({ type: 'count', args: [selector, options] })

		const docs = await this.findFetchInner(selector, options)
		return docs.length
	}

	async insertOne(doc: TDoc | ReadonlyDeep<TDoc>): Promise<TDoc['_id']> {
		this.#ops.push({ type: 'insertOne', args: [doc._id] })

		if (!doc._id) throw new Error(`insertOne requires document to have an _id`)

		if (this.#documents.has(doc._id)) throw new Error(`insertOne document already exists`)

		this.#documents.set(doc._id, clone(doc))

		return doc._id
	}
	async remove(selector: MongoQuery<TDoc> | TDoc['_id']): Promise<number> {
		this.#ops.push({ type: 'remove', args: [selector] })

		const docs: Pick<TDoc, '_id'>[] = await this.findFetchInner(selector, { projection: { _id: 1 } })
		for (const doc of docs) {
			this.#documents.delete(doc._id)
		}

		return docs.length
	}
	private async removeOne(selector: MongoQuery<TDoc> | TDoc['_id']): Promise<number> {
		this.#ops.push({ type: 'removeOne', args: [selector] })

		const docs: Pick<TDoc, '_id'>[] = await this.findFetchInner(selector, { projection: { _id: 1 }, limit: 1 })
		for (const doc of docs) {
			this.#documents.delete(doc._id)
		}

		return docs.length
	}
	async update(selector: MongoQuery<TDoc> | TDoc['_id'], modifier: MongoModifier<TDoc>): Promise<number> {
		return this.updateInner(selector, modifier, false)
	}
	private async updateInner(
		selector: MongoQuery<TDoc> | TDoc['_id'],
		modifier: MongoModifier<TDoc>,
		single: boolean
	) {
		this.#ops.push({ type: 'update', args: [selector, modifier] })

		const docs = await this.findFetchInner(selector)

		for (const doc of docs) {
			const newDoc = mongoModify(selector, doc, modifier)
			this.#documents.set(doc._id, newDoc)

			// For an 'updateOne
			if (single) break
		}

		return docs.length
	}
	async replace(doc: TDoc | ReadonlyDeep<TDoc>): Promise<boolean> {
		this.#ops.push({ type: 'replace', args: [doc._id] })

		if (!doc._id) throw new Error(`replace requires document to have an _id`)

		const exists = this.#documents.has(doc._id)
		this.#documents.set(doc._id, clone(doc))
		return exists
	}
	async bulkWrite(ops: AnyBulkWriteOperation<TDoc>[]): Promise<unknown> {
		this.#ops.push({ type: 'bulkWrite', args: [ops.length] })

		for (const op of ops) {
			if ('updateMany' in op) {
				await this.updateInner(op.updateMany.filter, op.updateMany.update, false)
			} else if ('updateOne' in op) {
				await this.updateInner(op.updateOne.filter, op.updateOne.update, true)
			} else if ('replaceOne' in op) {
				await this.replace(op.replaceOne.replacement as any)
			} else if ('insertOne' in op) {
				await this.insertOne(op.insertOne.document as any)
			} else if ('deleteMany' in op) {
				await this.remove(op.deleteMany.filter)
			} else if ('deleteOne' in op) {
				await this.removeOne(op.deleteOne.filter)
			} else {
				// Note: implement more as we start using them
				throw new Error(`Unknown mongo Bulk Operation: ${JSON.stringify(op)}`)
			}
		}

		return null
	}

	/**
	 * The registered watchers
	 * Note: These are not (yet?) automatically triggered upon changes
	 */
	watchers: MockChangeStream<TDoc>[] = []

	watch(pipeline: any[]): IChangeStream<TDoc> {
		if (!this.allowWatchers) throw new Error(`Watching this collection is not allowed`)

		const newWatcher = new MockChangeStream(pipeline)
		this.watchers.push(newWatcher)

		return newWatcher
	}
}

export class MockChangeStream<TDoc extends { _id: ProtectedString<any> }>
	extends EventEmitter<IChangeStreamEvents<TDoc>>
	implements IChangeStream<TDoc>
{
	constructor(public readonly pipeline: any[]) {
		super()
	}

	closed = false

	async close(): Promise<void> {
		await defer()
		this.closed = true
	}
}

export async function defer(): Promise<void> {
	return new Promise((resolve) => jest.requireActual('timers').setImmediate(resolve))
}

export function getMockCollections(): {
	jobCollections: Readonly<IDirectCollections>
	mockCollections: Readonly<IMockCollections>
} {
	const mockCollections: IMockCollections = Object.freeze(
		literal<IMockCollections>({
			AdLibActions: new MockMongoCollection<AdLibAction>(CollectionName.AdLibActions),
			AdLibPieces: new MockMongoCollection<AdLibPiece>(CollectionName.AdLibPieces),
			Blueprints: new MockMongoCollection<Blueprint>(CollectionName.Blueprints),
			BucketAdLibActions: new MockMongoCollection<BucketAdLibAction>(CollectionName.BucketAdLibActions),
			BucketAdLibPieces: new MockMongoCollection<BucketAdLib>(CollectionName.BucketAdLibPieces),
			ExpectedPlayoutItems: new MockMongoCollection<ExpectedPlayoutItem>(CollectionName.ExpectedPlayoutItems),
			Notifications: new MockMongoCollection<DBNotificationObj>(CollectionName.Notifications),
			SofieIngestDataCache: new MockMongoCollection<SofieIngestDataCacheObj>(CollectionName.SofieIngestDataCache),
			NrcsIngestDataCache: new MockMongoCollection<NrcsIngestDataCacheObj>(CollectionName.NrcsIngestDataCache),
			Parts: new MockMongoCollection<DBPart>(CollectionName.Parts),
			PartInstances: new MockMongoCollection<DBPartInstance>(CollectionName.PartInstances),
			PeripheralDevices: new MockMongoCollection<PeripheralDevice>(CollectionName.PeripheralDevices),
			PeripheralDeviceCommands: new MockMongoCollection<PeripheralDeviceCommand>(
				CollectionName.PeripheralDeviceCommands
			),
			Pieces: new MockMongoCollection<Piece>(CollectionName.Pieces),
			PieceInstances: new MockMongoCollection<PieceInstance>(CollectionName.PieceInstances),
			Rundowns: new MockMongoCollection<DBRundown>(CollectionName.Rundowns),
			RundownBaselineAdLibActions: new MockMongoCollection<RundownBaselineAdLibAction>(
				CollectionName.RundownBaselineAdLibActions
			),
			RundownBaselineAdLibPieces: new MockMongoCollection<AdLibPiece>(CollectionName.RundownBaselineAdLibPieces),
			RundownBaselineObjects: new MockMongoCollection<RundownBaselineObj>(CollectionName.RundownBaselineObjects),
			RundownPlaylists: new MockMongoCollection<DBRundownPlaylist>(CollectionName.RundownPlaylists),
			Segments: new MockMongoCollection<DBSegment>(CollectionName.Segments),
			ShowStyleBases: new MockMongoCollection<DBShowStyleBase>(CollectionName.ShowStyleBases),
			ShowStyleVariants: new MockMongoCollection<DBShowStyleVariant>(CollectionName.ShowStyleVariants),
			Studios: new MockMongoCollection<DBStudio>(CollectionName.Studios),
			Timelines: new MockMongoCollection<TimelineComplete>(CollectionName.Timelines),
			TimelineDatastores: new MockMongoCollection<DBTimelineDatastoreEntry>(CollectionName.TimelineDatastore),

			ExpectedPackages: new MockMongoCollection<ExpectedPackageDB>(CollectionName.ExpectedPackages),
			PackageInfos: new MockMongoCollection(CollectionName.PackageInfos),

			ExternalMessageQueue: new MockMongoCollection(CollectionName.ExternalMessageQueue),

			MediaObjects: new MockMongoCollection(CollectionName.MediaObjects),
		})
	)

	const jobCollections = Object.freeze(
		literal<IDirectCollections>({
			...mockCollections,
		})
	)

	return {
		jobCollections,
		mockCollections,
	}
}

/**
 * A version of IDirectCollections, with every collection swapped out for MockMongoCollection.
 * This gives us mutable versions of readonly collections, and avoids the need to provide a `transaction` parameter
 */
export interface IMockCollections {
	AdLibActions: MockMongoCollection<AdLibAction>
	AdLibPieces: MockMongoCollection<AdLibPiece>
	Blueprints: MockMongoCollection<Blueprint>
	BucketAdLibActions: MockMongoCollection<BucketAdLibAction>
	BucketAdLibPieces: MockMongoCollection<BucketAdLib>
	ExpectedPlayoutItems: MockMongoCollection<ExpectedPlayoutItem>
	Notifications: MockMongoCollection<DBNotificationObj>
	SofieIngestDataCache: MockMongoCollection<SofieIngestDataCacheObj>
	NrcsIngestDataCache: MockMongoCollection<NrcsIngestDataCacheObj>
	Parts: MockMongoCollection<DBPart>
	PartInstances: MockMongoCollection<DBPartInstance>
	PeripheralDevices: MockMongoCollection<PeripheralDevice>
	PeripheralDeviceCommands: MockMongoCollection<PeripheralDeviceCommand>
	Pieces: MockMongoCollection<Piece>
	PieceInstances: MockMongoCollection<PieceInstance>
	Rundowns: MockMongoCollection<DBRundown>
	RundownBaselineAdLibActions: MockMongoCollection<RundownBaselineAdLibAction>
	RundownBaselineAdLibPieces: MockMongoCollection<RundownBaselineAdLibItem>
	RundownBaselineObjects: MockMongoCollection<RundownBaselineObj>
	RundownPlaylists: MockMongoCollection<DBRundownPlaylist>
	Segments: MockMongoCollection<DBSegment>
	ShowStyleBases: MockMongoCollection<DBShowStyleBase>
	ShowStyleVariants: MockMongoCollection<DBShowStyleVariant>
	Studios: MockMongoCollection<DBStudio>
	Timelines: MockMongoCollection<TimelineComplete>
	TimelineDatastores: MockMongoCollection<DBTimelineDatastoreEntry>

	ExpectedPackages: MockMongoCollection<ExpectedPackageDB>
	PackageInfos: MockMongoCollection<PackageInfoDB>

	ExternalMessageQueue: MockMongoCollection<ExternalMessageQueueObj>

	MediaObjects: MockMongoCollection<MediaObjects>
}
