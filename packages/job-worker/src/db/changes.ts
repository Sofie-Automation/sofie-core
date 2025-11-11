import { ProtectedString } from '@sofie-automation/corelib/dist/protectedString'
import { AnyBulkWriteOperation } from 'mongodb'
import { ICollection, MongoQuery } from './collections.js'
import _ from 'underscore'
import { deleteAllUndefinedProperties, normalizeArrayToMap } from '@sofie-automation/corelib/dist/lib'
import { JobContext } from '../jobs/index.js'

/**
 * Object describe a collection write event
 * Contains counts of modified documents
 */
export interface Changes {
	added: number
	updated: number
	removed: number
}

/**
 * Object describe a collection write event
 * Contains ids of documents updated/considered
 */
export interface ChangedIds<T extends ProtectedString<any>> {
	added: T[]
	updated: T[]
	removed: T[]
	unchanged: T[]
}

export function sumChanges(...changes: (Changes | ChangedIds<any> | null)[]): Changes {
	const change: Changes = {
		added: 0,
		updated: 0,
		removed: 0,
	}
	for (const c of changes) {
		if (c) {
			change.added += Array.isArray(c.added) ? c.added.length : c.added
			change.updated += Array.isArray(c.updated) ? c.updated.length : c.updated
			change.removed += Array.isArray(c.removed) ? c.removed.length : c.removed
		}
	}
	return change
}
export function anythingChanged(changes: Changes): boolean {
	return !!(changes.added || changes.removed || changes.updated)
}

/**
 * Saves an array of data into a collection
 * This executes the necessary insert, update or remove operations to make it so that a load with the provided filter would return the provided documents
 * @param collection The collection to be updated
 * @param filter The filter defining the data subset to be affected in db
 * @param newDocs The new documents
 * @returns Description of the changes
 */
export async function saveIntoDb<TDoc extends { _id: ProtectedString<any> }>(
	context: JobContext,
	collection: ICollection<TDoc>,
	filter: MongoQuery<TDoc>,
	newDocs: Array<TDoc>,
	options?: SaveIntoDbHooks<TDoc>
): Promise<Changes> {
	const preparedChanges = await prepareSaveIntoDb(context, collection, filter, newDocs, options)

	return savePreparedChanges(preparedChanges, collection, options ?? {})
}

export interface PreparedChanges<T> {
	inserted: T[]
	changed: T[]
	removed: T[]
	unchanged: T[]
}

async function prepareSaveIntoDb<TDoc extends { _id: ProtectedString<any> }>(
	context: JobContext,
	collection: ICollection<TDoc>,
	filter: MongoQuery<TDoc>,
	newData: Array<TDoc>,
	optionsOrg?: SaveIntoDbHooks<TDoc>
): Promise<PreparedChanges<TDoc>> {
	const preparedChanges: PreparedChanges<TDoc> = {
		inserted: [],
		changed: [],
		removed: [],
		unchanged: [],
	}

	const existing = await collection.findFetch(filter)

	saveIntoBase(context, collection.name, existing, newData, {
		...optionsOrg,
		insert: (doc) => preparedChanges.inserted.push(doc),
		update: (doc) => preparedChanges.changed.push(doc),
		remove: (doc) => preparedChanges.removed.push(doc),
		unchanged: (doc) => preparedChanges.unchanged.push(doc),
		// supress hooks that are for the save phase
		afterInsert: undefined,
		afterRemove: undefined,
		afterRemoveAll: undefined,
		afterUpdate: undefined,
	})

	return preparedChanges
}
async function savePreparedChanges<TDoc extends { _id: ProtectedString<any> }>(
	preparedChanges: PreparedChanges<TDoc>,
	collection: ICollection<TDoc>,
	options: SaveIntoDbHooks<TDoc>
): Promise<Changes> {
	const change: Changes = {
		added: 0,
		updated: 0,
		removed: 0,
	}
	const newObjIds = new Set<TDoc['_id']>()
	const checkInsertId = (id: TDoc['_id']) => {
		if (newObjIds.has(id)) {
			throw new Error(
				`savePreparedChanges into collection "${(collection as any)._name}": Duplicate identifier "${id}"`
			)
		}
		newObjIds.add(id)
	}

	const updates: AnyBulkWriteOperation<TDoc>[] = []
	const removedDocs: TDoc['_id'][] = []

	_.each(preparedChanges.changed || [], (oUpdate) => {
		checkInsertId(oUpdate._id)
		updates.push({
			replaceOne: {
				filter: {
					_id: oUpdate._id,
				},
				replacement: oUpdate,
			},
		})
		change.updated++
		if (options.afterUpdate) options.afterUpdate(oUpdate)
	})

	_.each(preparedChanges.inserted || [], (oInsert) => {
		checkInsertId(oInsert._id)
		updates.push({
			replaceOne: {
				filter: {
					_id: oInsert._id,
				},
				replacement: oInsert,
				upsert: true,
			},
		})
		change.added++
		if (options.afterInsert) options.afterInsert(oInsert)
	})

	_.each(preparedChanges.removed || [], (oRemove) => {
		removedDocs.push(oRemove._id)
		change.removed++
		if (options.afterRemove) options.afterRemove(oRemove)
	})
	if (removedDocs.length) {
		updates.push({
			deleteMany: {
				filter: {
					_id: { $in: removedDocs as any },
				},
			},
		})
	}

	const pBulkWriteResult = updates.length > 0 ? collection.bulkWrite(updates) : Promise.resolve()

	await pBulkWriteResult

	if (options.afterRemoveAll) {
		const objs = _.compact(preparedChanges.removed || [])
		if (objs.length > 0) {
			options.afterRemoveAll(objs)
		}
	}

	return change
}

export interface SaveIntoDbHooks<TDoc> {
	beforeInsert?: (o: TDoc) => TDoc
	beforeUpdate?: (o: TDoc, pre?: TDoc) => TDoc
	beforeRemove?: (o: TDoc) => TDoc
	beforeDiff?: (o: TDoc, oldObj: TDoc) => TDoc
	afterInsert?: (o: TDoc) => void
	afterUpdate?: (o: TDoc) => void
	afterRemove?: (o: TDoc) => void
	afterRemoveAll?: (o: Array<TDoc>) => void
}

interface SaveIntoDbHandlers<TDoc> {
	insert: (o: TDoc) => void
	update: (o: TDoc) => void
	remove: (o: TDoc) => void
	unchanged?: (o: TDoc) => void
}
export function saveIntoBase<TDoc extends { _id: ProtectedString<any> }>(
	context: JobContext,
	collectionName: string,
	oldDocs: TDoc[],
	newData: Array<TDoc>,
	options: SaveIntoDbHooks<TDoc> & SaveIntoDbHandlers<TDoc>
): ChangedIds<TDoc['_id']> {
	const span = context.startSpan(`saveIntoBase.${collectionName}`)

	const changes: ChangedIds<TDoc['_id']> = {
		added: [],
		updated: [],
		removed: [],
		unchanged: [],
	}

	const newObjIds = new Set<TDoc['_id']>()
	_.each(newData, (o) => {
		if (newObjIds.has(o._id)) {
			throw new Error(`saveIntoBase into collection "${collectionName}": Duplicate identifier _id: "${o._id}"`)
		}
		newObjIds.add(o._id)
	})

	const objectsToRemove = normalizeArrayToMap(oldDocs, '_id')

	for (const o of newData) {
		// const span2 = profiler.startSpan(`saveIntoBase.${collectionName}.do.${o._id}`)
		const oldObj = objectsToRemove.get(o._id)

		if (oldObj) {
			const o2 = options.beforeDiff ? options.beforeDiff(o, oldObj) : o
			deleteAllUndefinedProperties(o2)
			const eql = _.isEqual(oldObj, o2)

			if (!eql) {
				const oUpdate = options.beforeUpdate ? options.beforeUpdate(o, oldObj) : o
				options.update(oUpdate)
				if (options.afterUpdate) options.afterUpdate(oUpdate)
				changes.updated.push(oUpdate._id)
			} else {
				if (options.unchanged) options.unchanged(o)
				changes.unchanged.push(oldObj._id)
			}
		} else {
			const oInsert = options.beforeInsert ? options.beforeInsert(o) : o
			options.insert(oInsert)
			if (options.afterInsert) options.afterInsert(oInsert)
			changes.added.push(oInsert._id)
		}
		objectsToRemove.delete(o._id)

		// span2?.end()
	}
	for (const obj of objectsToRemove.values()) {
		if (obj) {
			const oRemove = options.beforeRemove ? options.beforeRemove(obj) : obj

			options.remove(oRemove)

			if (options.afterRemove) options.afterRemove(oRemove)
			changes.removed.push(oRemove._id)
		}
	}

	if (options.afterRemoveAll) {
		const objs = _.compact(Array.from(objectsToRemove.values()))
		if (objs.length > 0) {
			options.afterRemoveAll(objs)
		}
	}

	span?.addLabels(changes as any)
	span?.end()
	return changes
}
