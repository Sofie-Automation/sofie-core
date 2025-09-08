/* eslint-disable @typescript-eslint/only-throw-error */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import _ from 'underscore'
import { literal, ProtectedString, unprotectString, protectString, getRandomString } from '../server/lib/tempLib'
import { RandomMock } from './random'
import { MeteorMock } from './meteor'
import { Random } from 'meteor/random'
import { Meteor } from 'meteor/meteor'
import type { AnyBulkWriteOperation } from 'mongodb'
import {
	FindOneOptions,
	FindOptions,
	MongoCursor,
	MongoReadOnlyCollection,
	ObserveCallbacks,
	ObserveChangesCallbacks,
	UpdateOptions,
	UpsertOptions,
} from '@sofie-automation/meteor-lib/dist/collections/lib'
import { mongoWhere, mongoFindOptions, mongoModify, MongoQuery } from '@sofie-automation/corelib/dist/mongo'
import { AsyncOnlyMongoCollection, AsyncOnlyReadOnlyMongoCollection } from '../server/collections/collection'
import type {
	MinimalMeteorMongoCollection,
	MinimalMongoCursor,
} from '../server/collections/implementations/asyncCollection'
import clone from 'fast-clone'

export namespace MongoMock {
	interface ObserverEntry<T extends CollectionObject> {
		id: string
		query: any
		callbacksChanges?: ObserveChangesCallbacks<T>
		callbacksObserve?: ObserveCallbacks<T>
	}

	export interface MockCollections<T extends CollectionObject> {
		[collectionName: string]: MockCollection<T>
	}
	export interface MockCollection<T extends CollectionObject> {
		[id: string]: T
	}
	interface CollectionObject {
		_id: ProtectedString<any>
	}

	const mockCollections: MockCollections<any> = {}
	export class Collection<T extends CollectionObject> implements Omit<MinimalMeteorMongoCollection<T>, 'find'> {
		public _name: string
		private _isTemporaryCollection: boolean
		private _options: any = {}
		// @ts-expect-error used in test to check that it's a mock
		private _isMock = true as const
		public observers: ObserverEntry<T>[] = []

		public asyncBulkWriteDelay = 100

		constructor(name: string | null, options?: { transform?: never }) {
			this._options = options || {}
			this._name = name || getRandomString() // If `null`, then its an in memory unique collection
			this._isTemporaryCollection = name === null

			if (this._options.transform) throw new Error('document transform is no longer supported')
		}

		find(
			query: any,
			options?: FindOptions<T>
		): MinimalMongoCursor<T> & { _fetchRaw: () => T[] } & Pick<MongoCursor<T>, 'fetch' | 'forEach'> {
			if (_.isString(query)) query = { _id: query }
			query = query || {}

			const unimplementedUsedOptions = _.without(_.keys(options), 'sort', 'limit', 'fields', 'projection')
			if (options && 'fields' in options && 'projection' in options) {
				throw new Error(`Only one of 'fields' and 'projection' can be specified`)
			}
			if (unimplementedUsedOptions.length > 0) {
				throw new Error(`find being performed using unimplemented options: ${unimplementedUsedOptions}`)
			}

			const docsArray = Object.values<T>(this.documents)
			let docs: T[] = _.compact(
				query._id && typeof query._id === 'string'
					? [this.documents[query._id]]
					: docsArray.filter((doc) => mongoWhere(doc, query))
			)

			docs = mongoFindOptions(docs, options)

			const observers = this.observers

			const removeObserver = (id: string): void => {
				const index = observers.findIndex((o) => o.id === id)
				if (index === -1) throw new Meteor.Error(500, 'Cannot stop observer that is not registered')
				observers.splice(index, 1)
			}

			return {
				_fetchRaw: () => {
					return docs
				},
				fetchAsync: async () => {
					// Force this to be performed async
					await MeteorMock.sleepNoFakeTimers(0)

					return clone(docs)
				},
				fetch: () => {
					if (!this._isTemporaryCollection)
						throw new Meteor.Error(500, 'sync methods can only be used for unnamed collections')

					return clone(docs)
				},
				countAsync: async () => {
					// Force this to be performed async
					await MeteorMock.sleepNoFakeTimers(0)

					return docs.length
				},
				async observeAsync(clbs: ObserveCallbacks<T>): Promise<Meteor.LiveQueryHandle> {
					// Force this to be performed async
					await MeteorMock.sleepNoFakeTimers(0)

					const id = Random.id(5)
					observers.push(
						literal<ObserverEntry<T>>({
							id: id,
							callbacksObserve: clbs,
							query: query,
						})
					)
					return {
						stop() {
							removeObserver(id)
						},
					}
				},
				async observeChangesAsync(clbs: ObserveChangesCallbacks<T>): Promise<Meteor.LiveQueryHandle> {
					// Force this to be performed async
					await MeteorMock.sleepNoFakeTimers(0)

					// todo - finish implementing uses of callbacks
					const id = Random.id(5)
					observers.push(
						literal<ObserverEntry<T>>({
							id: id,
							callbacksChanges: clbs,
							query: query,
						})
					)
					return {
						stop() {
							removeObserver(id)
						},
					}
				},
				forEach: (f: any) => {
					if (!this._isTemporaryCollection)
						throw new Meteor.Error(500, 'sync methods can only be used for unnamed collections')

					docs.forEach(f)
				},
				// async mapAsync(f: any) {
				// 	return docs.map(f)
				// },
			}
		}
		async findOneAsync(query: MongoQuery<T>, options?: FindOneOptions<T>) {
			const docs = await this.find(query, options).fetchAsync()
			return docs[0]
		}
		findOne(query: MongoQuery<T>, options?: FindOneOptions<T>) {
			if (!this._isTemporaryCollection)
				throw new Meteor.Error(500, 'sync methods can only be used for unnamed collections')

			const docs = this.find(query, options).fetch()
			return docs[0]
		}

		async updateAsync(query: any, modifier: any, options?: UpdateOptions): Promise<number> {
			// Force this to be performed async
			await MeteorMock.sleepNoFakeTimers(0)

			return this.updateRaw(query, modifier, options)
		}
		update(query: any, modifier: any, options?: UpdateOptions): number {
			if (!this._isTemporaryCollection)
				throw new Meteor.Error(500, 'sync methods can only be used for unnamed collections')

			return this.updateRaw(query, modifier, options)
		}

		private updateRaw(query: any, modifier: any, options?: UpdateOptions): number {
			const unimplementedUsedOptions = _.without(_.keys(options), 'multi')
			if (unimplementedUsedOptions.length > 0) {
				throw new Error(`update being performed using unimplemented options: ${unimplementedUsedOptions}`)
			}

			// todo
			let docs = this.find(query)._fetchRaw()

			// By default mongo only updates one doc, unless told multi
			if (this.documents.length && !options?.multi) {
				docs = [docs[0]]
			}

			_.each(docs, (doc) => {
				const modifiedDoc = mongoModify(query, doc, modifier)
				this.documents[unprotectString(doc._id)] = modifiedDoc

				Meteor.defer(() => {
					_.each(_.clone(this.observers), (obs) => {
						if (mongoWhere(doc, obs.query)) {
							if (obs.callbacksChanges?.changed) {
								obs.callbacksChanges.changed(doc._id, {}) // TODO - figure out what changed
							}
							if (obs.callbacksObserve?.changed) {
								obs.callbacksObserve.changed(modifiedDoc, doc)
							}
						}
					})
				})
			})

			return docs.length
		}

		async insertAsync(doc: any): Promise<string> {
			// Force this to be performed async
			await MeteorMock.sleepNoFakeTimers(0)

			return this.insertRaw(doc)
		}
		insert(doc: any): string {
			if (!this._isTemporaryCollection)
				throw new Meteor.Error(500, 'sync methods can only be used for unnamed collections')

			return this.insertRaw(doc)
		}
		private insertRaw(doc: any): string {
			const d = _.clone(doc)
			if (!d._id) d._id = protectString(RandomMock.id())

			if (this.documents[unprotectString(d._id)]) {
				throw new MeteorMock.Error(500, `Duplicate key '${d._id}'`)
			}

			this.documents[unprotectString(d._id)] = d

			Meteor.defer(() => {
				_.each(_.clone(this.observers), (obs) => {
					if (mongoWhere(d, obs.query)) {
						const fields = _.keys(_.omit(d, '_id'))
						if (obs.callbacksChanges?.addedBefore) {
							obs.callbacksChanges.addedBefore(d._id, fields, null as any)
						}
						if (obs.callbacksChanges?.added) {
							obs.callbacksChanges.added(d._id, fields)
						}
						if (obs.callbacksObserve?.added) {
							obs.callbacksObserve.added(d)
						}
					}
				})
			})

			return d._id
		}

		async upsertAsync(
			query: any,
			modifier: any,
			options?: UpsertOptions
		): Promise<{ numberAffected: number | undefined; insertedId: string | undefined }> {
			// Force this to be performed async
			await MeteorMock.sleepNoFakeTimers(0)

			return this.upsertRaw(query, modifier, options)
		}
		upsert(
			query: any,
			modifier: any,
			options?: UpsertOptions
		): { numberAffected: number | undefined; insertedId: string | undefined } {
			if (!this._isTemporaryCollection)
				throw new Meteor.Error(500, 'sync methods can only be used for unnamed collections')

			return this.upsertRaw(query, modifier, options)
		}
		private upsertRaw(
			query: any,
			modifier: any,
			options?: UpsertOptions
		): { numberAffected: number | undefined; insertedId: string | undefined } {
			const id = _.isString(query) ? query : query._id

			const docs = this.find(id)._fetchRaw()

			if (docs.length) {
				const count = this.updateRaw(docs[0]._id, modifier, options)
				return { insertedId: undefined, numberAffected: count }
			} else {
				const doc = mongoModify<T>(query, { _id: id } as any, modifier)
				const insertedId = this.insertRaw(doc)
				return { insertedId: insertedId, numberAffected: undefined }
			}
		}

		async removeAsync(query: any): Promise<number> {
			// Force this to be performed async
			await MeteorMock.sleepNoFakeTimers(0)

			return this.removeRaw(query)
		}
		remove(query: any): number {
			if (!this._isTemporaryCollection)
				throw new Meteor.Error(500, 'sync methods can only be used for unnamed collections')

			return this.removeRaw(query)
		}
		private removeRaw(query: any): number {
			const docs = this.find(query)._fetchRaw()

			_.each(docs, (doc) => {
				delete this.documents[unprotectString(doc._id)]

				Meteor.defer(() => {
					_.each(_.clone(this.observers), (obs) => {
						if (mongoWhere(doc, obs.query)) {
							if (obs.callbacksChanges?.removed) {
								obs.callbacksChanges.removed(doc._id)
							}
							if (obs.callbacksObserve?.removed) {
								obs.callbacksObserve.removed(doc)
							}
						}
					})
				})
			})
			return docs.length
		}

		createIndex(_obj: any) {
			// todo
		}
		allow() {
			// todo
		}

		rawDatabase(): any {
			throw new Error('Not implemented')
		}
		rawCollection(): any {
			return {
				bulkWrite: async (updates: AnyBulkWriteOperation<any>[], _options: unknown) => {
					await MeteorMock.sleepNoFakeTimers(this.asyncBulkWriteDelay)

					for (const update of updates) {
						if ('insertOne' in update) {
							await this.insertAsync(update.insertOne.document)
						} else if ('updateOne' in update) {
							if (update.updateOne.upsert) {
								await this.upsertAsync(update.updateOne.filter, update.updateOne.update as any, {
									multi: false,
								})
							} else {
								await this.updateAsync(update.updateOne.filter, update.updateOne.update as any, {
									multi: false,
								})
							}
						} else if ('updateMany' in update) {
							if (update.updateMany.upsert) {
								await this.upsertAsync(update.updateMany.filter, update.updateMany.update as any, {
									multi: true,
								})
							} else {
								await this.updateAsync(update.updateMany.filter, update.updateMany.update as any, {
									multi: true,
								})
							}
						} else if ('deleteOne' in update) {
							const docs = await this.find(update.deleteOne.filter).fetchAsync()
							if (docs.length) {
								await this.removeAsync(docs[0]._id)
							}
						} else if ('deleteMany' in update) {
							await this.removeAsync(update.deleteMany.filter)
						} else if (update['replaceOne']) {
							await this.upsertAsync(update.replaceOne.filter, update.replaceOne.replacement)
						}
					}
				},
				collectionName: this._name,
			}
		}
		private get documents(): MockCollection<T> {
			if (!mockCollections[this._name]) mockCollections[this._name] = {}
			return mockCollections[this._name]
		}
	}
	// Mock functions:
	export function mockSetData<T extends CollectionObject>(
		collection: AsyncOnlyMongoCollection<T>,
		data: MockCollection<T> | Array<T> | null
	) {
		const collectionName = collection.name
		if (collectionName === null) {
			throw new Meteor.Error(500, 'mockSetData can only be done for named collections')
		}

		data = data || {}
		if (_.isArray(data)) {
			const collectionData: MockCollection<T> = {}
			_.each(data, (doc) => {
				if (!doc._id) throw Error(`mockSetData: "${collectionName}": doc._id missing`)
				collectionData[unprotectString(doc._id)] = doc
			})
			mockCollections[collectionName] = collectionData
		} else {
			mockCollections[collectionName] = data
		}
	}

	export function deleteAllData() {
		Object.keys(mockCollections).forEach((id) => {
			mockCollections[id] = {}
		})
	}

	/**
	 * The Mock Collection type does a sleep before starting on executing the bulkWrite.
	 * This simulates the async nature of writes to mongo, and aims to detect race conditions in our code.
	 * This method will change the duration of the sleep, and returns the old delay value
	 */
	export function setCollectionAsyncBulkWriteDelay(collection: AsyncOnlyMongoCollection<any>, delay: number): number {
		const collection2 = collection as any
		if (typeof collection2.asyncWriteDelay !== 'number') {
			throw new Error(
				"asyncWriteDelay must be defined already, or this won't do anything. Perhaps some refactoring?"
			)
		}
		const oldDelay = collection2.asyncWriteDelay
		collection2.asyncWriteDelay = delay
		return oldDelay
	}

	export function getInnerMockCollection<T extends { _id: ProtectedString<any> }>(
		collection: MongoReadOnlyCollection<T> | AsyncOnlyReadOnlyMongoCollection<T>
	): MinimalMeteorMongoCollection<T> {
		return (collection as any).mockCollection
	}
}
export function setup(): any {
	return {
		Mongo: MongoMock,
	}
}
