import _ from 'underscore'
import { ProtectedString } from './protectedString.js'
import * as objectPath from 'object-path'
import type { Condition, Filter, UpdateFilter } from 'mongodb'
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

/**
 * Subset of MongoSelector, only allows direct queries, not QueryWithModifiers such as $explain etc.
 * Used for simplified expressions (ie not using $and, $or etc..)
 * */
export type MongoQuery<TDoc> = Filter<TDoc>
export type MongoQueryKey<T> = RegExp | T | Condition<T> // Allowed properties in a MongoQuery
export type MongoModifier<TDoc> = UpdateFilter<TDoc>

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
export function mongoFindOptions<TDoc extends { _id: ProtectedString<any> }>(
	docs0: ReadonlyArray<TDoc>,
	options?: FindOptions<TDoc>
): TDoc[] {
	let docs = [...docs0] // Shallow clone it
	if (options) {
		const sortOptions = options.sort as any
		if (sortOptions) {
			// Underscore doesnt support desc order, or multiple fields, so we have to do it manually
			const keys = Object.keys(sortOptions).filter((k) => sortOptions[k])
			const doSort = (a: any, b: any, i: number): number => {
				if (i >= keys.length) return 0

				const key = keys[i]
				const order = sortOptions[key]

				// Get the values, and handle asc vs desc
				const val1 = objectPath.get(order > 0 ? a : b, key)
				const val2 = objectPath.get(order > 0 ? b : a, key)

				if (_.isEqual(val1, val2)) {
					return doSort(a, b, i + 1)
				} else if (val1 > val2) {
					return 1
				} else {
					return -1
				}
			}

			if (keys.length > 0) {
				docs.sort((a, b) => doSort(a, b, 0))
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
		const projection = (options.projection || options.fields) as any
		if (projection !== undefined) {
			const idVal = projection['_id']
			const includeKeys = _.keys(projection).filter((key) => key !== '_id' && projection[key] !== 0)
			const excludeKeys: string[] = _.keys(projection).filter((key) => key !== '_id' && projection[key] === 0)

			// Mongo does not allow mixed include and exclude (exception being excluding _id)
			// https://docs.mongodb.com/manual/reference/method/db.collection.find/#projection
			if (includeKeys.length !== 0 && excludeKeys.length !== 0) {
				throw new Error(`options.projection cannot contain both include and exclude rules`)
			}

			if (includeKeys.length !== 0) {
				if (idVal !== 0) includeKeys.push('_id')
				docs = docs.map((doc) => {
					const newDoc: any = {} // any since includeKeys breaks strict typings anyway

					for (const key of includeKeys) {
						projectFieldIntoDoc(doc, newDoc, key)
					}

					return newDoc
				})
			} else if (excludeKeys.length !== 0) {
				if (idVal === 0) excludeKeys.push('_id')
				docs = docs.map((doc) => {
					const newDoc = clone<any>(doc) // any since excludeKeys breaks strict typings anyway

					for (const key of excludeKeys) {
						objectPath.del(newDoc, key)
					}

					return newDoc
				})
			}
		}

		// options.reactive // Not used server-side
	}
	return docs
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
 * @param valueToPush Value to push onto array
 */
export function pushOntoPath<T>(obj: Record<string, unknown>, path: string, valueToPush: T): void {
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

		arr.push(valueToPush)
		return arr
	}
	mutatePath(obj, path, {}, mutator)
}
/**
 * Push a value from a object, when the value matches
 * @param obj Object
 * @param path Path to array in object
 * @param matchValue Value to match for removal. Supports $in operator for matching multiple values.
 */
export function pullFromPath<T>(obj: Record<string, unknown>, path: string, matchValue: T): void {
	const mutator = (o: Record<string, unknown>, lastAttr: string) => {
		if (_.has(o, lastAttr)) {
			const arrAttr = o[lastAttr]
			if (!arrAttr || !Array.isArray(arrAttr))
				throw new Error(
					'Object propery "' + lastAttr + '" is not an array ("' + arrAttr + '") (in path "' + path + '")'
				)

			// Handle $in operator for matching multiple values
			if (
				matchValue &&
				typeof matchValue === 'object' &&
				'$in' in matchValue &&
				Array.isArray((matchValue as Record<string, unknown>).$in)
			) {
				const inValues = (matchValue as Record<string, unknown>).$in as unknown[]
				return (o[lastAttr] = arrAttr.filter((entry: T) => !inValues.includes(entry)))
			}

			return (o[lastAttr] = arrAttr.filter((entry: T) => !_.isMatch(entry, matchValue)))
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
