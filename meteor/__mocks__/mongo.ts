/* eslint-disable @typescript-eslint/only-throw-error */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import _ from 'underscore'
import { literal, getRandomString } from '@sofie-automation/corelib/dist/lib'
import { protectString, unprotectString, ProtectedString } from '@sofie-automation/corelib/dist/protectedString'
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
	UpdateOptions,
	UpsertOptions,
} from '@sofie-automation/meteor-lib/dist/collections/lib'
import {
	mongoWhere,
	mongoFindOptions,
	mongoModify,
	MongoQuery,
	ObserveCallbacks,
	ObserveChangesCallbacks,
} from '@sofie-automation/corelib/dist/mongo'
import { InMemoryMongoCollection } from '@sofie-automation/corelib/dist/memoryCollection'
import { AsyncOnlyMongoCollection, AsyncOnlyReadOnlyMongoCollection } from '../server/collections/collection'
import { Collections } from '../server/collections/lib'
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
	// TODO (replace-meteor phase 2): this mock now reimplements a chunk of BOTH the Meteor collection API
	// (find/observe for the reactive bridge) AND the native `mongodb` driver API (via rawCollection(), for
	// CRUD). Once the change-stream observe engine lands and the Meteor bridge is removed, revisit this:
	// it should reduce to a single thin fake of the native driver (or be replaced by mongodb-memory-server
	// for integration tests).
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
				collectionName: this._name,
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

		private replaceRaw(
			query: any,
			replacement: any,
			options?: { upsert?: boolean }
		): { numberAffected: number | undefined; insertedId: string | undefined } {
			const id = _.isString(query) ? query : query._id
			const existing = this.find(id)._fetchRaw()[0]

			if (existing) {
				// Full-document replacement: store the new document verbatim, preserving the original `_id`.
				const newDoc = { ...clone(replacement), _id: existing._id }
				this.documents[unprotectString(existing._id)] = newDoc

				Meteor.defer(() => {
					_.each(_.clone(this.observers), (obs) => {
						if (mongoWhere(existing, obs.query)) {
							if (obs.callbacksChanges?.changed) obs.callbacksChanges.changed(existing._id, {})
							if (obs.callbacksObserve?.changed) obs.callbacksObserve.changed(newDoc, existing)
						}
					})
				})
				return { numberAffected: 1, insertedId: undefined }
			} else if (options?.upsert) {
				// No match: insert the replacement (the `_id` comes from the filter if absent on the doc).
				const newDoc = { ...replacement }
				if (!newDoc._id && id) newDoc._id = id
				const insertedId = this.insertRaw(newDoc)
				return { numberAffected: undefined, insertedId }
			} else {
				return { numberAffected: 0, insertedId: undefined }
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

		// A minimal mock of the native `mongodb` driver Collection, sufficient for the CRUD methods of
		// WrappedAsyncMongoCollection. Each method delegates to the (observer-firing) mock methods above,
		// and returns native-shaped results.
		rawCollection(): any {
			const mapUpdateResult = (numberAffected: number | undefined, insertedId: string | undefined) => {
				if (insertedId !== undefined) {
					return {
						acknowledged: true,
						matchedCount: 0,
						modifiedCount: 0,
						upsertedCount: 1,
						upsertedId: insertedId,
					}
				}
				const n = numberAffected || 0
				return { acknowledged: true, matchedCount: n, modifiedCount: n, upsertedCount: 0, upsertedId: null }
			}

			return {
				collectionName: this._name,
				find: (filter: any, options?: any) => ({
					toArray: async () => this.find(filter, options).fetchAsync(),
				}),
				findOne: async (filter: any, options?: any) => {
					return (await this.findOneAsync(filter, options)) ?? null
				},
				countDocuments: async (filter?: any) => {
					return this.find(filter || {}).countAsync()
				},
				insertOne: async (doc: any) => {
					const insertedId = await this.insertAsync(doc)
					return { acknowledged: true, insertedId }
				},
				updateOne: async (filter: any, modifier: any, options?: any) => {
					if (options?.upsert) {
						const r = await this.upsertAsync(filter, modifier, { multi: false })
						return mapUpdateResult(r.numberAffected, r.insertedId)
					}
					const n = await this.updateAsync(filter, modifier, { multi: false })
					return mapUpdateResult(n, undefined)
				},
				updateMany: async (filter: any, modifier: any, options?: any) => {
					if (options?.upsert) {
						const r = await this.upsertAsync(filter, modifier, { multi: true })
						return mapUpdateResult(r.numberAffected, r.insertedId)
					}
					const n = await this.updateAsync(filter, modifier, { multi: true })
					return mapUpdateResult(n, undefined)
				},
				replaceOne: async (filter: any, replacement: any, options?: any) => {
					// Force this to be performed async
					await MeteorMock.sleepNoFakeTimers(0)

					const r = this.replaceRaw(filter, replacement, { upsert: !!options?.upsert })
					return mapUpdateResult(r.numberAffected, r.insertedId)
				},
				deleteMany: async (filter: any) => {
					const deletedCount = await this.removeAsync(filter)
					return { acknowledged: true, deletedCount }
				},
				createIndex: async (_keys: any, _options?: any) => {
					// no-op in tests
					return 'index'
				},
				indexes: async () => {
					// no indexes are tracked in the mock
					return []
				},
				dropIndex: async (_indexName: string) => {
					// no-op in tests
				},
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
						} else if ('replaceOne' in update) {
							this.replaceRaw(update.replaceOne.filter, update.replaceOne.replacement, {
								upsert: !!update.replaceOne.upsert,
							})
						}
					}
				},
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
		getInnerMockCollection(collection).mockSetData(data)
	}

	export function deleteAllData() {
		for (const collection of Collections.values()) {
			;(collection.mutableCollection as any).mockCollection?.clear()
		}
	}

	export function getInnerMockCollection<T extends { _id: ProtectedString<any> }>(
		collection: MongoReadOnlyCollection<T> | AsyncOnlyReadOnlyMongoCollection<T>
	): InMemoryMongoCollection<T> {
		return (collection as any).mockCollection
	}
}
export function setup(): any {
	return {
		Mongo: MongoMock,
	}
}
