import _ from 'underscore'
import { ProtectedString } from './protectedString.js'
import * as objectPath from 'object-path'
import type {
	Condition,
	DeleteManyModel,
	DeleteOneModel,
	Document,
	Filter,
	InsertOneModel,
	MatchKeysAndValues,
	OnlyFieldsOfType,
	PullOperator,
	PushOperator,
	ReplaceOneModel,
	SetFields,
	UpdateManyModel,
	UpdateOneModel,
} from 'mongodb'
import { clone } from './lib.js'

/** Hack's using typings pulled from meteor */

export type SortSpecifier<T> = {
	[P in keyof T]?: -1 | 1
}

// From Meteor docs: It is not possible to mix inclusion and exclusion styles: the keys must either be all 1 or all 0
export type MongoFieldSpecifierOnes<T> = {
	[P in keyof T]?: 1
}
export type MongoFieldSpecifierZeroes<T> = {
	[P in keyof T]?: 0
}
export type MongoFieldSpecifier<T> =
	| MongoFieldSpecifierOnes<T>
	| MongoFieldSpecifierZeroes<T>
	| MongoFieldSpecifierOnesStrict<Partial<T>>

/**
 * Type helper to construct a field specifier to include all the keys mentioned in a type union.
 * This ensures with Typescript that the fields specified in the query, match what we cast to afterwards
 */
export type MongoFieldSpecifierOnesStrict<T extends Record<string, any>> = {
	[key in keyof T]?: T[key] extends ProtectedString<any>
		? 1
		: T[key] extends object | undefined
			? MongoFieldSpecifierOnesStrict<T[key]> | 1
			: 1
}

export interface FindOneOptions<TDoc> {
	sort?: SortSpecifier<TDoc>
	skip?: number
	/** @deprecated */
	fields?: MongoFieldSpecifier<TDoc>
	projection?: MongoFieldSpecifier<TDoc>
}
export interface FindOptions<TDoc> extends FindOneOptions<TDoc> {
	limit?: number
}

export interface ObserveChangesOptions {
	/**
	 * If your observer functions do not mutate the passed arguments, you can set this to true, which
	 * improves performance by reducing the amount of data copies.
	 */
	nonMutatingCallbacks?: boolean | undefined
}

export interface FindObserveChangesOptions<TDoc> extends ObserveChangesOptions {
	/** @deprecated */
	fields?: MongoFieldSpecifier<TDoc>
	projection?: MongoFieldSpecifier<TDoc>
}

/** Callbacks for observing the full documents of a query as its result set changes. */
export interface ObserveCallbacks<DBInterface> {
	added?(document: DBInterface): void
	changed?(newDocument: DBInterface, oldDocument: DBInterface): void
	removed?(oldDocument: DBInterface): void
}
/**
 * Callbacks for observing a query as its result set changes. Only the differences between the old and new
 * documents are passed to the callbacks.
 */
export interface ObserveChangesCallbacks<DBInterface extends { _id: ProtectedString<any> }> {
	added?(id: DBInterface['_id'], fields: Partial<DBInterface>): void
	changed?(id: DBInterface['_id'], fields: Partial<DBInterface>): void
	removed?(id: DBInterface['_id']): void
}

/**
 * Subset of MongoSelector, only allows direct queries, not QueryWithModifiers such as $explain etc.
 * Used for simplified expressions (ie not using $and, $or etc..)
 * */
export type MongoQuery<TDoc> = Filter<TDoc>
export type MongoQueryKey<T> = RegExp | T | Condition<T> // Allowed properties in a MongoQuery

/**
 * The simplified update operators we support. This is intentionally a hand-rolled subset of mongodb's
 * `UpdateFilter` rather than `UpdateFilter` itself:
 *
 *  - `UpdateFilter` ends in `& Document` (a `[key: string]: any` index signature) which lets a whole
 *    plain document pass as a "modifier"; the native driver then rejects it at runtime ("Update document
 *    requires atomic operators").
 *  - it documents exactly which operators are supported, and keeps the type in lockstep with the
 *    in-memory `mongoModify` below (used by the unit-test mock).
 *
 * The per-operator value types are mongodb's own (loose, non-recursive) helpers, so this neither trips
 * "excessively deep" instantiation like `StrictUpdateFilter`, nor breaks dynamic `$set[key] = value` use.
 */
export type MongoModifier<TDoc> = {
	$set?: MatchKeysAndValues<TDoc>
	$unset?: OnlyFieldsOfType<TDoc, any, '' | true | 1>
	$push?: PushOperator<TDoc>
	$pull?: PullOperator<TDoc>
	$addToSet?: SetFields<TDoc>
	$rename?: Record<string, string>
}

/**
 * A bulkWrite operation, hand-rolled to match exactly the arms our in-memory mocks implement (see the
 * `bulkWrite` handlers in the meteor and job-worker collection mocks). Like {@link MongoModifier}, this is
 * intentionally NOT mongodb's `AnyBulkWriteOperation`:
 *  - the `update` of the `updateOne`/`updateMany` arms is constrained to {@link MongoModifier}, so a whole
 *    plain document cannot sneak in as a "modifier" via the bulkWrite path (the heaviest write path). Use
 *    the `replaceOne` arm for a genuine full-document replacement.
 *  - aggregation-pipeline updates (the `Document[]` form) are deliberately omitted, as `mongoModify` does
 *    not implement them.
 */
export type MongoBulkWriteOperation<TDoc extends Document> =
	| { insertOne: InsertOneModel<TDoc> }
	| { replaceOne: ReplaceOneModel<TDoc> }
	| { updateOne: Omit<UpdateOneModel<TDoc>, 'update' | 'upsert'> & { update: MongoModifier<TDoc> } }
	| { updateMany: Omit<UpdateManyModel<TDoc>, 'update' | 'upsert'> & { update: MongoModifier<TDoc> } }
	| { deleteOne: DeleteOneModel<TDoc> }
	| { deleteMany: DeleteManyModel<TDoc> }

/** End of hacks */

export function mongoWhereFilter<T, R extends Record<string, any>>(items: R[], selector: MongoQuery<T>): R[] {
	const results: R[] = []
	for (const item of items) {
		if (mongoWhere(item, selector)) results.push(item)
	}
	return results
}

export function mongoWhere<T>(o: Record<string, any>, selector: MongoQuery<T>): boolean {
	if (typeof selector !== 'object') {
		// selector must be an object
		return false
	}

	let ok = true
	for (const [key, s] of Object.entries<any>(selector)) {
		if (!ok) break

		try {
			const keyWords = key.split('.')
			if (keyWords.length > 1) {
				const oAttr = o[keyWords[0]]
				if (_.isObject(oAttr) || oAttr === undefined) {
					const innerSelector: any = {}
					innerSelector[keyWords.slice(1).join('.')] = s
					ok = mongoWhere(oAttr || {}, innerSelector)
				} else {
					ok = false
				}
			} else if (key === '$or') {
				if (_.isArray(s)) {
					let ok2 = false
					for (const innerSelector of s) {
						ok2 = ok2 || mongoWhere(o, innerSelector)
					}
					ok = ok2
				} else {
					throw new Error('An $or filter must be an array')
				}
			} else if (key === '$and') {
				if (Array.isArray(s) && s.length >= 1) {
					let ok2 = true
					for (const innerSelector of s) {
						ok2 = ok2 && mongoWhere(o, innerSelector)
						if (!ok2) break
					}
					ok = ok2
				} else {
					throw new Error('An $and filter must be an array')
				}
			} else if (key.startsWith('$')) {
				throw new Error(`Operand "${key}" is not implemented`)
			} else {
				const oAttr = o[key]

				if (_.isObject(s)) {
					if (_.has(s, '$elemMatch')) {
						// Handle $elemMatch for array fields
						if (Array.isArray(oAttr)) {
							ok = oAttr.some((item) => mongoWhere(item, s.$elemMatch))
						} else {
							ok = false
						}
					} else if (_.has(s, '$gt')) {
						ok = oAttr > s.$gt
					} else if (_.has(s, '$gte')) {
						ok = oAttr >= s.$gte
					} else if (_.has(s, '$lt')) {
						ok = oAttr < s.$lt
					} else if (_.has(s, '$lte')) {
						ok = oAttr <= s.$lte
					} else if (_.has(s, '$eq')) {
						ok = oAttr === s.$eq
					} else if (_.has(s, '$ne')) {
						ok = oAttr !== s.$ne
					} else if (_.has(s, '$in')) {
						ok = s.$in.indexOf(oAttr) !== -1
					} else if (_.has(s, '$nin')) {
						ok = s.$nin.indexOf(oAttr) === -1
					} else if (_.has(s, '$exists')) {
						ok = (o[key] !== undefined) === !!s.$exists
					} else if (_.has(s, '$not')) {
						const innerSelector: any = {}
						innerSelector[key] = s.$not
						ok = !mongoWhere(o, innerSelector)
					} else {
						if (_.isObject(oAttr) || oAttr === undefined) {
							ok = mongoWhere(oAttr || {}, s)
						} else {
							ok = false
						}
					}
				} else {
					const innerSelector: any = {}
					innerSelector[key] = { $eq: s }
					ok = mongoWhere(o, innerSelector)
				}
			}
		} catch (_e) {
			ok = false
		}
	}
	return ok
}
/**
 * Build a comparator for a {@link SortSpecifier}. Compares by each sort key in turn, then falls back
 * to `_id` ascending as a final tie-breaker so the resulting order is *total* and *stable* — the same
 * set of documents always sorts to the same order regardless of input order.
 */
export function makeMongoSortComparator<TDoc extends { _id: ProtectedString<any> }>(
	sortSpec: SortSpecifier<TDoc> | undefined
): (a: TDoc, b: TDoc) => number {
	const spec = (sortSpec ?? {}) as any
	// Underscore doesnt support desc order, or multiple fields, so we have to do it manually
	const keys = Object.keys(spec).filter((k) => spec[k])
	return (a, b) => {
		for (let i = 0; i < keys.length; i++) {
			const key = keys[i]
			const order = spec[key]

			// Get the values, and handle asc vs desc
			const val1 = objectPath.get(order > 0 ? a : b, key)
			const val2 = objectPath.get(order > 0 ? b : a, key)

			if (_.isEqual(val1, val2)) continue
			// Missing/null values sort lowest (MongoDB BSON order: null/missing before numbers/strings).
			// A bare `val1 > val2` would mis-handle `undefined` (all comparisons yield false), so order them
			// explicitly before falling back to the natural comparison of two present values.
			const val1Empty = val1 === undefined || val1 === null
			const val2Empty = val2 === undefined || val2 === null
			if (val1Empty && val2Empty) continue
			else if (val1Empty) return -1
			else if (val2Empty) return 1
			else if (val1 > val2) return 1
			else return -1
		}
		// Final tie-break by `_id` ascending, for a total and resync-stable order.
		const id1 = a._id as unknown as string
		const id2 = b._id as unknown as string
		if (id1 < id2) return -1
		if (id1 > id2) return 1
		return 0
	}
}

export function mongoFindOptions<TDoc extends { _id: ProtectedString<any> }>(
	docs0: ReadonlyArray<TDoc>,
	options?: FindOptions<TDoc>
): TDoc[] {
	let docs = [...docs0] // Shallow clone it
	if (options) {
		const sortOptions = options.sort as any
		if (sortOptions) {
			const keys = Object.keys(sortOptions).filter((k) => sortOptions[k])
			if (keys.length > 0) {
				docs.sort(makeMongoSortComparator<TDoc>(sortOptions))
			}
		}

		if (options.skip) {
			docs = docs.slice(options.skip)
		}
		if (options.limit !== undefined) {
			docs = _.take(docs, options.limit)
		}

		if ('fields' in options && 'projection' in options) {
			throw new Error(`Only one of 'fields' and 'projection' can be specified`)
		}
		const projection = (options.projection || options.fields) as MongoFieldSpecifier<TDoc> | undefined
		if (projection !== undefined) {
			docs = docs.map((doc) => mongoProjectDocument(doc, projection))
		}

		// options.reactive // Not used server-side
	}
	return docs
}

/**
 * Apply a MongoDB projection (`fields`/`projection` specifier) to a single document, in JS.
 * Returns a new (projected) document, or the same document if no projection is given.
 */
export function mongoProjectDocument<TDoc extends { _id: ProtectedString<any> }>(
	doc: TDoc,
	projection: MongoFieldSpecifier<TDoc> | undefined
): TDoc {
	if (projection === undefined) return doc

	// Flatten any embedded-document form into dot-notation, so that `{ b: { c: 1 } }` is treated
	// identically to `{ 'b.c': 1 }` (as MongoDB does). This lets the include/exclude branches below
	// reuse the dot-path aware projection logic instead of including/excluding the whole `b` subtree.
	const proj: Record<string, 0 | 1> = {}
	flattenProjection(projection as Record<string, unknown>, '', proj)

	const idVal = proj['_id']
	const includeKeys = _.keys(proj).filter((key) => key !== '_id' && proj[key] !== 0)
	const excludeKeys: string[] = _.keys(proj).filter((key) => key !== '_id' && proj[key] === 0)

	// Mongo does not allow mixed include and exclude (exception being excluding _id)
	// https://docs.mongodb.com/manual/reference/method/db.collection.find/#projection
	if (includeKeys.length !== 0 && excludeKeys.length !== 0) {
		throw new Error(`options.projection cannot contain both include and exclude rules`)
	}

	if (includeKeys.length !== 0) {
		if (idVal !== 0) includeKeys.push('_id')
		const newDoc: any = {} // any since includeKeys breaks strict typings anyway
		for (const key of includeKeys) {
			projectFieldIntoDoc(doc, newDoc, key)
		}
		return newDoc
	} else if (excludeKeys.length !== 0) {
		if (idVal === 0) excludeKeys.push('_id')
		const newDoc = clone<any>(doc) // any since excludeKeys breaks strict typings anyway
		for (const key of excludeKeys) {
			objectPath.del(newDoc, key)
		}
		return newDoc
	}

	return doc
}

/**
 * Flatten a projection specifier into a flat map of dot-notation path -> 0 | 1.
 * Embedded-document form is expanded, so `{ a: 1, b: { c: 1 } }` becomes `{ a: 1, 'b.c': 1 }`,
 * matching how MongoDB interprets nested projection objects.
 */
function flattenProjection(projection: Record<string, unknown>, prefix: string, out: Record<string, 0 | 1>): void {
	for (const key of Object.keys(projection)) {
		const value = projection[key]
		const path = prefix ? `${prefix}.${key}` : key
		if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
			// Nested embedded-document form, e.g. { b: { c: 1 } } === { 'b.c': 1 }
			flattenProjection(value as Record<string, unknown>, path, out)
		} else {
			out[path] = value === 0 ? 0 : 1
		}
	}
}

/**
 * Project a field from a source document into a target document.
 * Handles nested paths through arrays like MongoDB does.
 * e.g., 'items.name' on {items: [{name: 'a', value: 1}]} => {items: [{name: 'a'}]}
 */
function projectFieldIntoDoc(source: any, target: any, path: string): void {
	const parts = path.split('.')
	let currentSource = source
	let currentTarget = target

	for (let i = 0; i < parts.length; i++) {
		const part = parts[i]
		const isLast = i === parts.length - 1
		const remainingPath = parts.slice(i + 1).join('.')

		if (currentSource === undefined || currentSource === null) {
			return
		}

		if (Array.isArray(currentSource)) {
			// Handle array - project the field from each element
			if (!Array.isArray(currentTarget)) {
				// Initialize as empty array if not already an array
				const parentPath = parts.slice(0, i).join('.')
				if (parentPath) {
					objectPath.set(target, parentPath, [])
					currentTarget = objectPath.get(target, parentPath)
				} else {
					return // Can't set root to array
				}
			}

			// Project the remaining path into each array element
			for (let j = 0; j < currentSource.length; j++) {
				if (currentTarget[j] === undefined) {
					currentTarget[j] = {}
				}
				const subPath = isLast ? part : [part, remainingPath].join('.')
				projectFieldIntoDoc(currentSource[j], currentTarget[j], subPath)
			}
			return
		}

		if (isLast) {
			// We've reached the final part of the path
			if (currentSource[part] !== undefined) {
				currentTarget[part] = currentSource[part]
			}
		} else {
			// Navigate deeper
			if (currentTarget[part] === undefined) {
				if (Array.isArray(currentSource[part])) {
					currentTarget[part] = []
				} else {
					currentTarget[part] = {}
				}
			}
			currentSource = currentSource[part]
			currentTarget = currentTarget[part]
		}
	}
}

export function mongoModify<TDoc extends { _id: ProtectedString<any> }>(
	selector: MongoQuery<TDoc>,
	doc: TDoc,
	modifier: MongoModifier<TDoc>
): TDoc {
	let replace = false
	for (const [key, value] of Object.entries<any>(modifier)) {
		if (key === '$set') {
			_.each(value, (value: any, key: string) => {
				setOntoPath(doc, key, selector, value)
			})
		} else if (key === '$unset') {
			_.each(value, (_value: any, key: string) => {
				unsetPath(doc, key, selector)
			})
		} else if (key === '$push') {
			_.each(value, (value: any, key: string) => {
				pushOntoPath(doc, key, value)
			})
		} else if (key === '$pull') {
			_.each(value, (value: any, key: string) => {
				pullFromPath(doc, key, value)
			})
		} else if (key === '$addToSet') {
			_.each(value, (value: any, key: string) => {
				addToSetOntoPath(doc, key, value)
			})
		} else if (key === '$rename') {
			_.each(value, (value: any, key: string) => {
				renamePath(doc, key, value)
			})
		} else {
			if (key[0] === '$') {
				throw Error(`Update method "${key}" not implemented yet`)
			} else {
				replace = true
			}
		}
	}
	if (replace) {
		const newDoc = modifier as TDoc
		if (!newDoc._id) newDoc._id = doc._id
		return newDoc
	} else {
		return doc
	}
}

/**
 * Mutate a value on a object
 * @param obj Object
 * @param path Path to value in object
 * @param substitutions Object any query values to use instead of $
 * @param mutator Operation to run on the object value
 */
export function mutatePath<T>(
	obj: Record<string, unknown>,
	path: string,
	substitutions: Record<string, unknown>,
	mutator: (parentObj: Record<string, unknown>, key: string) => T
): void {
	if (!path) throw new Error('parameter path missing')

	const attrs = path.split('.')

	const lastAttr = _.last(attrs)
	const attrsExceptLast = attrs.slice(0, -1)

	const generateWildcardAttrInfo = () => {
		const keys = _.filter(_.keys(substitutions), (k) => k.indexOf(currentPath) === 0)
		if (keys.length === 0) {
			// This might be a bad assumption, but as this is for tests, lets go with it for now
			throw new Error(`missing parameters for $ in "${path}"`)
		}

		const query: any = {}
		const trimmedSubstitutions: any = {}
		_.each(keys, (key) => {
			// Create a mini 'query' and new substitutions with trimmed keys
			const remainingKey = key.substr(currentPath.length)
			if (remainingKey.indexOf('$') === -1) {
				query[remainingKey] = substitutions[key]
			} else {
				trimmedSubstitutions[remainingKey] = substitutions[key]
			}
		})

		return {
			query,
			trimmedSubstitutions,
		}
	}

	let o: any = obj
	let currentPath = ''
	for (const attr of attrsExceptLast) {
		if (attr === '$') {
			if (!_.isArray(o))
				throw new Error(
					'Object at "' + currentPath + '" is not an array ("' + o + '") (in path "' + path + '")'
				)

			const info = generateWildcardAttrInfo()
			for (const obj of o) {
				// mutate any objects which match
				if (_.isMatch(obj, info.query)) {
					mutatePath(obj, path.substr(currentPath.length + 2), info.trimmedSubstitutions, mutator)
				}
			}

			// Break the outer loop, as it gets handled with the for loop above
			break
		} else {
			if (!_.has(o, attr)) {
				o[attr] = {}
			} else {
				if (!_.isObject(o[attr]))
					throw new Error(
						'Object propery "' + attr + '" is not an object ("' + o[attr] + '") (in path "' + path + '")'
					)
			}
			o = o[attr]
		}
		currentPath += `${attr}.`
	}
	if (!lastAttr) throw new Error('Bad lastAttr')

	if (lastAttr === '$') {
		if (!_.isArray(o))
			throw new Error('Object at "' + currentPath + '" is not an array ("' + o + '") (in path "' + path + '")')

		const info = generateWildcardAttrInfo()
		o.forEach((val, i) => {
			// mutate any objects which match
			if (_.isMatch(val, info.query)) {
				mutator(o as any, i + '')
			}
		})
	} else {
		mutator(o, lastAttr)
	}
}
/**
 * Push a value into a object, and ensure the array exists
 * @param obj Object
 * @param path Path to array in object
 * @param valueToPush Value to push onto array, or a `{ $each: [...] }` wrapper to push multiple values
 */
export function pushOntoPath<T>(obj: Record<string, unknown>, path: string, valueToPush: T): void {
	const valuesToPush =
		valueToPush && typeof valueToPush === 'object' && '$each' in valueToPush && Array.isArray(valueToPush.$each)
			? (valueToPush.$each as unknown[])
			: [valueToPush]

	const mutator = (o: Record<string, unknown>, lastAttr: string) => {
		if (!_.has(o, lastAttr)) {
			o[lastAttr] = []
		} else {
			if (!_.isArray(o[lastAttr]))
				throw new Error(
					'Object propery "' + lastAttr + '" is not an array ("' + o[lastAttr] + '") (in path "' + path + '")'
				)
		}
		const arr: any = o[lastAttr]

		arr.push(...valuesToPush)
		return arr
	}
	mutatePath(obj, path, {}, mutator)
}
/**
 * Add one or more values into an array, ensuring the array exists and that values are not duplicated
 * (mirroring MongoDB's `$addToSet`). The value may be a single value, or a `{ $each: [...] }` wrapper to
 * add multiple values at once.
 * @param obj Object
 * @param path Path to array in object
 * @param valueToAdd Value (or `{ $each: [...] }`) to add to the array
 */
export function addToSetOntoPath<T>(obj: Record<string, unknown>, path: string, valueToAdd: T): void {
	const valuesToAdd =
		valueToAdd && typeof valueToAdd === 'object' && '$each' in valueToAdd && Array.isArray(valueToAdd.$each)
			? (valueToAdd.$each as unknown[])
			: [valueToAdd]

	const mutator = (o: Record<string, unknown>, lastAttr: string) => {
		if (!_.has(o, lastAttr)) {
			o[lastAttr] = []
		} else {
			if (!_.isArray(o[lastAttr]))
				throw new Error(
					'Object propery "' + lastAttr + '" is not an array ("' + o[lastAttr] + '") (in path "' + path + '")'
				)
		}
		const arr: any[] = o[lastAttr] as any[]

		for (const value of valuesToAdd) {
			if (!arr.some((entry) => _.isEqual(entry, value))) {
				arr.push(value)
			}
		}
		return arr
	}
	mutatePath(obj, path, {}, mutator)
}
/**
 * Push a value from a object, when the value matches
 * @param obj Object
 * @param path Path to array in object
 * @param matchValue Value to match for removal. This mirrors MongoDB's `$pull`:
 *  - a `{ $in: [...] }` operator removes elements equal to one of the listed values
 *  - any other object is treated as a query against each element (supporting nested operators such as
 *    `{ field: { $in: [...] } }`, evaluated by {@link mongoWhere})
 *  - a primitive removes elements equal to it
 */
export function pullFromPath<T>(obj: Record<string, unknown>, path: string, matchValue: T): void {
	const mutator = (o: Record<string, unknown>, lastAttr: string) => {
		if (_.has(o, lastAttr)) {
			const arrAttr = o[lastAttr]
			if (!arrAttr || !Array.isArray(arrAttr))
				throw new Error(
					'Object propery "' + lastAttr + '" is not an array ("' + arrAttr + '") (in path "' + path + '")'
				)

			// Handle $in operator for matching multiple values against the array elements directly
			if (
				matchValue &&
				typeof matchValue === 'object' &&
				'$in' in matchValue &&
				Array.isArray((matchValue as Record<string, unknown>).$in)
			) {
				const inValues = (matchValue as Record<string, unknown>).$in as unknown[]
				return (o[lastAttr] = arrAttr.filter((entry: T) => !inValues.some((value) => _.isEqual(entry, value))))
			}

			// An object is treated as a query against each element (handles plain sub-document matches as
			// well as nested operators like `{ field: { $in: [...] } }`)
			if (matchValue && typeof matchValue === 'object') {
				return (o[lastAttr] = arrAttr.filter((entry: T) => !mongoWhere(entry as any, matchValue as any)))
			}

			// A primitive removes elements equal to it
			return (o[lastAttr] = arrAttr.filter((entry: T) => !_.isEqual(entry, matchValue)))
		} else {
			return undefined
		}
	}
	mutatePath(obj, path, {}, mutator)
}
/**
 * Set a value into a object
 * @param obj Object
 * @param path Path to value in object
 * @param substitutions Object any query values to use instead of $
 * @param valueToPush Value to set
 */
export function setOntoPath<T>(
	obj: Record<string, unknown>,
	path: string,
	substitutions: Record<string, unknown>,
	valueToSet: T
): void {
	mutatePath(
		obj,
		path,
		substitutions,
		(parentObj: Record<string, unknown>, key: string) => (parentObj[key] = valueToSet)
	)
}
/**
 * Remove a value from a object
 * @param obj Object
 * @param path Path to value in object
 * @param substitutions Object any query values to use instead of $
 */
export function unsetPath(obj: Record<string, unknown>, path: string, substitutions: Record<string, unknown>): void {
	mutatePath(obj, path, substitutions, (parentObj: Record<string, unknown>, key: string) => delete parentObj[key])
}
/**
 * Rename a path to value
 * @param obj Object
 * @param oldPath Old path to value in object
 * @param newPath New path to value
 */
export function renamePath(obj: Record<string, unknown>, oldPath: string, newPath: string): void {
	mutatePath(obj, oldPath, {}, (parentObj: Record<string, unknown>, key: string) => {
		setOntoPath(obj, newPath, {}, parentObj[key])
		delete parentObj[key]
	})
}
