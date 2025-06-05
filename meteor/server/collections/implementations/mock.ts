import { MongoQuery } from '@sofie-automation/corelib/dist/mongo'
import { ProtectedString } from '@sofie-automation/corelib/dist/protectedString'
import { Meteor } from 'meteor/meteor'
import { FindOptions, MongoCursor } from '@sofie-automation/meteor-lib/dist/collections/lib'
import type { AnyBulkWriteOperation, Db as RawDb } from 'mongodb'
import { AsyncOnlyMongoCollection } from '../collection'
import { WrappedAsyncMongoCollection } from './asyncCollection'
import { Mongo } from 'meteor/mongo'

/** This is for the mock mongo collection, as internally it is sync and so we dont need or want to play around with fibers */
export class WrappedMockCollection<DBInterface extends { _id: ProtectedString<any> }>
	extends WrappedAsyncMongoCollection<DBInterface>
	implements AsyncOnlyMongoCollection<DBInterface>
{
	constructor(collection: Mongo.Collection<DBInterface>, name: string | null) {
		super(collection, name)

		if (!this._isMock) throw new Meteor.Error(500, 'WrappedMockCollection is only valid for a mock collection')
	}

	get mutableCollection(): AsyncOnlyMongoCollection<DBInterface> {
		return this
	}

	protected override rawDatabase(): RawDb {
		throw new Error('rawDatabase not supported in tests')
	}

	/**
	 * Retrieve a cursor for use in a publication
	 * @param selector A query describing the documents to find
	 */
	override async findWithCursor(
		_selector?: MongoQuery<DBInterface> | DBInterface['_id'],
		_options?: FindOptions<DBInterface>
	): Promise<MongoCursor<DBInterface>> {
		throw new Error('findWithCursor not supported in tests')
	}

	override async bulkWriteAsync(ops: Array<AnyBulkWriteOperation<DBInterface>>): Promise<void> {
		if (ops.length > 0) {
			const rawCollection = this.rawCollection()
			const bulkWriteResult = await rawCollection.bulkWrite(ops, {
				ordered: false,
			})
			if (bulkWriteResult && bulkWriteResult.hasWriteErrors()) {
				throw new Meteor.Error(
					500,
					`Errors in rawCollection.bulkWrite: ${bulkWriteResult.getWriteErrors().join(',')}`
				)
			}
		}
	}
}
