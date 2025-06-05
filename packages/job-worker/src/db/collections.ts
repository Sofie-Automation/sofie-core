import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
import {
	MongoClient,
	AnyBulkWriteOperation,
	Filter,
	FindOptions,
	UpdateFilter,
	Collection as MongoCollection,
	ChangeStreamDocument,
	CountOptions,
} from 'mongodb'
import { wrapMongoCollection } from './collection.js'
import { AdLibAction } from '@sofie-automation/corelib/dist/dataModel/AdlibAction'
import { AdLibPiece } from '@sofie-automation/corelib/dist/dataModel/AdLibPiece'
import { Blueprint } from '@sofie-automation/corelib/dist/dataModel/Blueprint'
import { BucketAdLibAction } from '@sofie-automation/corelib/dist/dataModel/BucketAdLibAction'
import { BucketAdLib } from '@sofie-automation/corelib/dist/dataModel/BucketAdLibPiece'
import { ExpectedMediaItem } from '@sofie-automation/corelib/dist/dataModel/ExpectedMediaItem'
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
import { RundownBaselineAdLibItem } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineAdLibPiece'
import { RundownBaselineObj } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineObj'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { DBShowStyleBase } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { DBShowStyleVariant } from '@sofie-automation/corelib/dist/dataModel/ShowStyleVariant'
import { DBStudio } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { TimelineComplete } from '@sofie-automation/corelib/dist/dataModel/Timeline'
import { DBTimelineDatastoreEntry } from '@sofie-automation/corelib/dist/dataModel/TimelineDatastore'
import { ExpectedPackageDB } from '@sofie-automation/corelib/dist/dataModel/ExpectedPackages'
import { PackageInfoDB } from '@sofie-automation/corelib/dist/dataModel/PackageInfos'
import { ProtectedString } from '@sofie-automation/corelib/dist/protectedString'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { ReadonlyDeep } from 'type-fest'
import { ExternalMessageQueueObj } from '@sofie-automation/corelib/dist/dataModel/ExternalMessageQueue'
import { MediaObjects } from '@sofie-automation/corelib/dist/dataModel/MediaObjects'
import type { DBNotificationObj } from '@sofie-automation/corelib/dist/dataModel/Notifications'
import type { EventEmitter } from 'events'

export type MongoQuery<TDoc> = Filter<TDoc>
export type MongoModifier<TDoc> = UpdateFilter<TDoc>

export interface IReadOnlyCollection<TDoc extends { _id: ProtectedString<any> }> {
	readonly name: string

	readonly rawCollection: MongoCollection<TDoc>

	findFetch(selector?: MongoQuery<TDoc>, options?: FindOptions<TDoc>): Promise<Array<TDoc>>
	findOne(selector?: MongoQuery<TDoc> | TDoc['_id'], options?: FindOptions<TDoc>): Promise<TDoc | undefined>
	count(selector?: MongoQuery<TDoc> | TDoc['_id'], options?: CountOptions): Promise<number>

	/**
	 * Watch the collection for changes
	 * This will throw when done in the context of a workqueue job
	 * Note: This is an artificial limitation that could be changed with some thought on how to make sure it doesnt block for too long or leak
	 */
	watch(pipeline: any[]): IChangeStream<TDoc>
}

export interface ICollection<TDoc extends { _id: ProtectedString<any> }> extends IReadOnlyCollection<TDoc> {
	insertOne(doc: TDoc | ReadonlyDeep<TDoc>): Promise<TDoc['_id']>
	// insertMany(docs: Array<TDoc | ReadonlyDeep<TDoc>>): Promise<Array<TDoc['_id']>>
	remove(selector: MongoQuery<TDoc> | TDoc['_id']): Promise<number>
	update(selector: MongoQuery<TDoc> | TDoc['_id'], modifier: MongoModifier<TDoc>): Promise<number>

	/** Returns true if a doc was replaced, false if inserted */
	replace(doc: TDoc | ReadonlyDeep<TDoc>): Promise<boolean>

	bulkWrite(ops: Array<AnyBulkWriteOperation<TDoc>>): Promise<unknown>
}

export type IChangeStreamEvents<TDoc extends { _id: ProtectedString<any> }> = {
	error: [e: Error]
	end: []
	change: [doc: ChangeStreamDocument<TDoc>]
}

export interface IChangeStream<TDoc extends { _id: ProtectedString<any> }>
	extends EventEmitter<IChangeStreamEvents<TDoc>> {
	readonly closed: boolean

	close(): Promise<void>
}

export interface IDirectCollections {
	AdLibActions: ICollection<AdLibAction>
	AdLibPieces: ICollection<AdLibPiece>
	Blueprints: ICollection<Blueprint>
	BucketAdLibActions: ICollection<BucketAdLibAction>
	BucketAdLibPieces: ICollection<BucketAdLib>
	ExpectedMediaItems: ICollection<ExpectedMediaItem>
	ExpectedPlayoutItems: ICollection<ExpectedPlayoutItem>
	Notifications: ICollection<DBNotificationObj>
	SofieIngestDataCache: ICollection<SofieIngestDataCacheObj>
	NrcsIngestDataCache: ICollection<NrcsIngestDataCacheObj>
	Parts: ICollection<DBPart>
	PartInstances: ICollection<DBPartInstance>
	PeripheralDevices: IReadOnlyCollection<PeripheralDevice>
	PeripheralDeviceCommands: ICollection<PeripheralDeviceCommand>
	Pieces: ICollection<Piece>
	PieceInstances: ICollection<PieceInstance>
	Rundowns: ICollection<DBRundown>
	RundownBaselineAdLibActions: ICollection<RundownBaselineAdLibAction>
	RundownBaselineAdLibPieces: ICollection<RundownBaselineAdLibItem>
	RundownBaselineObjects: ICollection<RundownBaselineObj>
	RundownPlaylists: ICollection<DBRundownPlaylist>
	Segments: ICollection<DBSegment>
	ShowStyleBases: IReadOnlyCollection<DBShowStyleBase>
	ShowStyleVariants: IReadOnlyCollection<DBShowStyleVariant>
	Studios: ICollection<DBStudio>
	Timelines: ICollection<TimelineComplete>
	TimelineDatastores: ICollection<DBTimelineDatastoreEntry>

	ExpectedPackages: ICollection<ExpectedPackageDB>
	PackageInfos: IReadOnlyCollection<PackageInfoDB>

	ExternalMessageQueue: ICollection<ExternalMessageQueueObj>

	MediaObjects: IReadOnlyCollection<MediaObjects>
}

/**
 * Get the wrapped mongo db collections
 * @param client MongoClient handle
 * @param dbName Name of the mongodb database
 * @param allowWatchers Whether watch operations are supported. See ICollection.watch for more information
 */
export function getMongoCollections(
	client: MongoClient,
	dbName: string,
	allowWatchers: boolean
): Readonly<IDirectCollections> {
	const database = client.db(dbName)

	return Object.freeze(
		literal<IDirectCollections>({
			AdLibActions: wrapMongoCollection(database.collection(CollectionName.AdLibActions), allowWatchers),
			AdLibPieces: wrapMongoCollection(database.collection(CollectionName.AdLibPieces), allowWatchers),
			Blueprints: wrapMongoCollection(database.collection(CollectionName.Blueprints), allowWatchers),
			BucketAdLibActions: wrapMongoCollection(
				database.collection(CollectionName.BucketAdLibActions),
				allowWatchers
			),
			BucketAdLibPieces: wrapMongoCollection(
				database.collection(CollectionName.BucketAdLibPieces),
				allowWatchers
			),
			ExpectedMediaItems: wrapMongoCollection(
				database.collection(CollectionName.ExpectedMediaItems),
				allowWatchers
			),
			ExpectedPlayoutItems: wrapMongoCollection(
				database.collection(CollectionName.ExpectedPlayoutItems),
				allowWatchers
			),
			Notifications: wrapMongoCollection(database.collection(CollectionName.Notifications), allowWatchers),
			SofieIngestDataCache: wrapMongoCollection(
				database.collection(CollectionName.SofieIngestDataCache),
				allowWatchers
			),
			NrcsIngestDataCache: wrapMongoCollection(
				database.collection(CollectionName.NrcsIngestDataCache),
				allowWatchers
			),
			Parts: wrapMongoCollection(database.collection(CollectionName.Parts), allowWatchers),
			PartInstances: wrapMongoCollection(database.collection(CollectionName.PartInstances), allowWatchers),
			PeripheralDevices: wrapMongoCollection(
				database.collection(CollectionName.PeripheralDevices),
				allowWatchers
			),
			PeripheralDeviceCommands: wrapMongoCollection(
				database.collection(CollectionName.PeripheralDeviceCommands),
				allowWatchers
			),
			Pieces: wrapMongoCollection(database.collection(CollectionName.Pieces), allowWatchers),
			PieceInstances: wrapMongoCollection(database.collection(CollectionName.PieceInstances), allowWatchers),
			Rundowns: wrapMongoCollection(database.collection(CollectionName.Rundowns), allowWatchers),
			RundownBaselineAdLibActions: wrapMongoCollection(
				database.collection(CollectionName.RundownBaselineAdLibActions),
				allowWatchers
			),
			RundownBaselineAdLibPieces: wrapMongoCollection(
				database.collection(CollectionName.RundownBaselineAdLibPieces),
				allowWatchers
			),
			RundownBaselineObjects: wrapMongoCollection(
				database.collection(CollectionName.RundownBaselineObjects),
				allowWatchers
			),
			RundownPlaylists: wrapMongoCollection(database.collection(CollectionName.RundownPlaylists), allowWatchers),
			Segments: wrapMongoCollection(database.collection(CollectionName.Segments), allowWatchers),
			ShowStyleBases: wrapMongoCollection(database.collection(CollectionName.ShowStyleBases), allowWatchers),
			ShowStyleVariants: wrapMongoCollection(
				database.collection(CollectionName.ShowStyleVariants),
				allowWatchers
			),
			Studios: wrapMongoCollection(database.collection(CollectionName.Studios), allowWatchers),
			Timelines: wrapMongoCollection(database.collection(CollectionName.Timelines), allowWatchers),
			TimelineDatastores: wrapMongoCollection(
				database.collection(CollectionName.TimelineDatastore),
				allowWatchers
			),

			ExpectedPackages: wrapMongoCollection(database.collection(CollectionName.ExpectedPackages), allowWatchers),
			PackageInfos: wrapMongoCollection(database.collection(CollectionName.PackageInfos), allowWatchers),

			ExternalMessageQueue: wrapMongoCollection(
				database.collection(CollectionName.ExternalMessageQueue),
				allowWatchers
			),

			MediaObjects: wrapMongoCollection(database.collection(CollectionName.MediaObjects), allowWatchers),
		})
	)
}
