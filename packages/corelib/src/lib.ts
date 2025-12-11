import _ from 'underscore'
import { ReadonlyDeep } from 'type-fest'
import fastClone from 'fast-clone'
import { ProtectedString, protectString } from './protectedString.js'
import * as objectPath from 'object-path'
import { Timecode } from 'timecode'
import { iterateDeeply, iterateDeeplyEnum, Time } from '@sofie-automation/blueprints-integration'
import { IStudioSettings } from './dataModel/Studio.js'
import { customAlphabet as createNanoid } from 'nanoid'
import type { ITranslatableMessage } from './TranslatableMessage.js'
import { ReadonlyObjectDeep } from 'type-fest/source/readonly-deep'

/**
 * Limited character set to use for id generation
 * Generating id's using these characters has 2 reasons:
 * 1. By omitting 0, O, I, 1 it makes it easier to read for humans
 * 2. The Timeline only supports A-Za-z0-9 in id's and classnames
 */
const UNMISTAKABLE_CHARS = '23456789ABCDEFGHJKLMNPQRSTWXYZabcdefghijkmnopqrstuvwxyz'
// A length of 17 from a pool of 56 characters => ~98 bits of entropy
// The probability for a collision is around 1.5e-6 in a set of 1e12 items
const nanoid = createNanoid(UNMISTAKABLE_CHARS, 17)

export * from './hash.js'

export type { Complete, ArrayElement, Subtract } from '@sofie-automation/shared-lib/dist/lib/types'
export { assertNever, literal } from '@sofie-automation/shared-lib/dist/lib/lib'

export function getSofieHostUrl(): string {
	const url = process.env.ROOT_URL
	if (url) return url

	throw new Error('ROOT_URL must be defined to launch Sofie')
}

export function omit<T, P extends keyof T>(obj: T, ...props: P[]): Omit<T, P> {
	return _.omit(obj, ...(props as string[])) as any
}

export function flatten<T>(vals: Array<T[] | undefined>): T[] {
	return _.flatten(
		vals.filter((v) => v !== undefined),
		true
	)
}

export function max<T>(vals: T[], iterator: _.ListIterator<T, any>): T | undefined {
	if (vals.length <= 1) {
		return vals[0]
	} else {
		return _.max(vals, iterator) as T
	}
}

export function min<T>(vals: T[] | readonly T[], iterator: _.ListIterator<T, any>): T | undefined {
	if (vals.length <= 1) {
		return vals[0]
	} else {
		return _.min(vals, iterator) as T
	}
}

export function clone<T>(o: ReadonlyDeep<T> | Readonly<T> | T): T {
	// Use this instead of fast-clone directly, as this retains the type
	return fastClone(o as any)
}
export function cloneObject<T extends object>(o: ReadonlyObjectDeep<T> | Readonly<T> | T): T {
	// Use this instead of fast-clone directly, as this retains the type
	return fastClone(o as any)
}

/**
 * Deeply freeze an object
 * Note: This is done in place
 */
export function deepFreeze<T>(object: ReadonlyDeep<T> | Readonly<T> | T): ReadonlyDeep<T> {
	// Based on https://github.com/anatoliygatt/deep-freeze-node/blob/master/lib/deep-freeze.js

	Object.freeze(object)
	if (typeof object === 'object') {
		deepFreezeInner(object)
	}

	return object as ReadonlyDeep<T>
}
function deepFreezeInner(object: any): void {
	Object.freeze(object)

	for (const propertyKey in object) {
		if (Object.prototype.hasOwnProperty.call(object, propertyKey)) {
			const property = object[propertyKey]
			if (typeof property !== 'object' || !(property instanceof Object) || Object.isFrozen(property)) {
				continue
			}
			deepFreezeInner(property)
		}
	}
}

export function getRandomString(numberOfChars?: number): string {
	return nanoid(numberOfChars)
}

export function getRandomId<T extends ProtectedString<any>>(numberOfChars?: number): T {
	return protectString(getRandomString(numberOfChars))
}

/**
 * Convert an array to a object, keyed on an id generator function.
 * `undefined` key values will get filtered from the object
 * Duplicate keys will cause entries to replace others silently
 *
 * ```
 * normalizeArrayFuncFilter([{ a: 1, b: 2}], (o) => `${o.a + o.b}`)
 * ```
 */
export function normalizeArrayFuncFilter<T>(
	array: Array<T>,
	getKey: (o: T) => string | undefined
): { [indexKey: string]: T } {
	const normalizedObject: { [indexKey: string]: T } = {}
	for (const obj of array) {
		const key = getKey(obj)
		if (key !== undefined) {
			normalizedObject[key] = obj
		}
	}
	return normalizedObject
}
/**
 * Convert an array to a object, keyed on an id generator function.
 * Duplicate keys will cause entries to replace others silently
 *
 * ```
 * normalizeArrayFunc([{ a: 1, b: 2}], (o) => `${o.a + o.b}`)
 * ```
 */
export function normalizeArrayFunc<T>(array: Array<T>, getKey: (o: T) => string): { [indexKey: string]: T } {
	const normalizedObject: { [indexKey: string]: T } = {}
	for (const obj of array) {
		normalizedObject[getKey(obj)] = obj
	}
	return normalizedObject as { [key: string]: T }
}
/**
 * Convert an array to a object, keyed on an `id` field.
 * Duplicate keys will cause entries to replace others silently
 *
 * ```
 * normalizeArray([{ a: '1', b: 2}], 'a')
 * ```
 */
export function normalizeArray<T>(array: Array<T> | readonly T[], indexKey: keyof T): { [indexKey: string]: T } {
	const normalizedObject: any = {}
	for (const obj of array) {
		normalizedObject[obj[indexKey]] = obj
	}
	return normalizedObject as { [key: string]: T }
}
/**
 * Convert an array to a Map, keyed on an `id` field.
 * Duplicate keys will cause entries to replace others silently
 *
 * ```
 * normalizeArrayToMap([{ a: '1', b: 2}], 'a')
 * ```
 */
export function normalizeArrayToMap<T, K extends keyof T>(array: readonly T[], indexKey: K): Map<T[K], T> {
	const normalizedObject = new Map<T[K], T>()
	for (const item of array) {
		normalizedObject.set(item[indexKey], item)
	}
	return normalizedObject
}
/**
 * Convert an array to a Map, keyed on an id generator function.
 * `undefined` key values will get filtered from the map
 * Duplicate keys will cause entries to replace others silently
 *
 * ```
 * normalizeArrayToMapFunc([{ a: 1, b: 2}], (o) => o.a + o.b)
 * ```
 */
export function normalizeArrayToMapFunc<T, K>(
	array: Array<T> | readonly T[],
	getKey: (o: T) => K | undefined
): Map<K, T> {
	const normalizedObject = new Map<K, T>()
	for (const item of array) {
		const key = getKey(item)
		if (key !== undefined) {
			normalizedObject.set(key, item)
		}
	}
	return normalizedObject
}

/**
 * Group items in an array by a property of the objects, as a Map of arrays
 * Replacement for `_.groupBy`
 * @param array Array of items to group
 * @param indexKey Name of the property to use as the group-key
 */
export function groupByToMap<T, K extends keyof T>(
	array: Array<T> | readonly T[] | IterableIterator<T>,
	indexKey: K
): Map<T[K], T[]> {
	const groupedItems = new Map<T[K], T[]>()
	for (const item of array) {
		const key = item[indexKey]
		const existing = groupedItems.get(key)
		if (existing) {
			existing.push(item)
		} else {
			groupedItems.set(key, [item])
		}
	}
	return groupedItems
}

/**
 * Group items in an array by a value derived from the objects, as a Map of arrays
 * Replacement for `_.groupBy`
 * @param array Array of items to group
 * @param getKey Function to get the group-key of the object
 */
export function groupByToMapFunc<T, K>(
	array: Array<T> | readonly T[] | IterableIterator<T>,
	getKey: (o: T) => K | undefined
): Map<K, T[]> {
	const groupedItems = new Map<K, T[]>()
	for (const item of array) {
		const key = getKey(item)
		if (key !== undefined) {
			const existing = groupedItems.get(key)
			if (existing) {
				existing.push(item)
			} else {
				groupedItems.set(key, [item])
			}
		}
	}
	return groupedItems
}

/**
 * Recursively delete all undefined properties from the supplied object.
 * This is necessary as _.isEqual({ a: 1 }, { a: 1, b: undefined }) === false
 */
export function deleteAllUndefinedProperties<T>(obj: T): void {
	if (Array.isArray(obj)) {
		for (const v of obj) {
			deleteAllUndefinedProperties(v)
		}
	} else if (obj && typeof obj === 'object') {
		for (const key in obj) {
			if (obj[key] === undefined) {
				delete obj[key]
			} else {
				deleteAllUndefinedProperties(obj[key])
			}
		}
	}
}

export function applyToArray<T>(arr: T | T[], func: (val: T) => void): void {
	if (Array.isArray(arr)) {
		for (const val of arr) {
			func(val)
		}
	} else {
		func(arr)
	}
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function objectPathGet(obj: any, path: string, defaultValue?: any): any {
	const v = objectPath.get(obj, path)
	if (v === undefined && defaultValue !== undefined) return defaultValue
	return v
}
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function objectPathSet(obj: any, path: string, value: any): any {
	objectPath.set(obj, path, value)
	return obj
}
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function objectPathDelete(obj: any, path: string): any {
	objectPath.del(obj, path)
	return obj
}

/**
 * Returns a rank number, to be used to insert new objects in a ranked list
 * @param before   The element before the one-to-be-inserted, null/undefined if inserted first
 * @param after	   The element after the one-to-be-inserted, null/undefined if inserted last
 * @param i        If inserting multiple elements; the internal rank of the to-be-inserted element
 * @param count    If inserting multiple elements, this is total count of inserted elements
 */
export function getRank<T extends { _rank: number }>(
	before: T | number | null | undefined,
	after: T | number | null | undefined,
	i = 0,
	count = 1
): number {
	let newRankMax: number
	let newRankMin: number

	if (after) {
		if (before) {
			newRankMin = objectOrRank(before)
			newRankMax = objectOrRank(after)
		} else {
			// First
			newRankMin = objectOrRank(after) - 1
			newRankMax = objectOrRank(after)
		}
	} else {
		if (before) {
			// Last
			newRankMin = objectOrRank(before)
			newRankMax = objectOrRank(before) + 1
		} else {
			// Empty list
			newRankMin = 0
			newRankMax = 1
		}
	}
	return newRankMin + ((i + 1) / (count + 1)) * (newRankMax - newRankMin)
}
function objectOrRank<T extends { _rank: number }>(obj: T | number): number {
	if (typeof obj === 'number') {
		return obj
	} else {
		return obj._rank
	}
}

export function formatDateAsTimecode(settings: ReadonlyDeep<Pick<IStudioSettings, 'frameRate'>>, date: Date): string {
	const tc = Timecode.init({
		framerate: settings.frameRate + '',
		timecode: date,
		drop_frame: !Number.isInteger(settings.frameRate),
	})
	return tc.toString()
}
/**
 * @param duration time in milliseconds
 */
export function formatDurationAsTimecode(
	settings: ReadonlyDeep<Pick<IStudioSettings, 'frameRate'>>,
	duration: Time
): string {
	const tc = Timecode.init({
		framerate: settings.frameRate + '',
		timecode: (duration * settings.frameRate) / 1000,
		drop_frame: !Number.isInteger(settings.frameRate),
	})
	return tc.toString()
}

/**
 * Deeply iterates through the object and removes propertys whose value equals null
 * @param obj
 */
export function removeNullyProperties<T>(obj: T): T {
	iterateDeeply(obj, (val, _key) => {
		if (_.isArray(val)) {
			return iterateDeeplyEnum.CONTINUE
		} else if (_.isObject(val)) {
			_.each(_.keys(val), (k) => {
				if (_.isNull(val[k])) {
					delete val[k]
				}
			})
			return iterateDeeplyEnum.CONTINUE
		} else {
			return val
		}
	})
	return obj
}

/**
 * 'Defer' the execution of an async function.
 * Pass an async function, and a catch block
 */
export function deferAsync(fn: () => Promise<void>, catcher: (e: unknown) => void): void {
	fn().catch(catcher)
}

export function joinObjectPathFragments(...fragments: Array<string | number | undefined>): string {
	return fragments.filter((v) => v !== '' && v !== undefined && v !== null).join('.')
}

export function ensureHasTrailingSlash(input: string | null): string | undefined {
	if (input) {
		return input.endsWith('/') ? input : input + '/'
	} else {
		return undefined
	}
}

/**
 * Returns a string that can be used to compare objects for equality
 * @param objs
 */
export function stringifyObjects(objs: unknown): string {
	if (_.isArray(objs)) {
		return _.map(objs, (obj) => {
			if (obj !== undefined) {
				return stringifyObjects(obj)
			} else {
				return undefined
			}
		}).join(',')
	} else if (_.isFunction(objs)) {
		return ''
	} else if (_.isObject(objs)) {
		const objs0 = objs as any
		const keys = _.sortBy(_.keys(objs), (k) => k)

		return _.compact(
			_.map(keys, (key) => {
				if (objs0[key] !== undefined) {
					return key + '=' + stringifyObjects(objs0[key])
				} else {
					return null
				}
			})
		).join(',')
	} else {
		return objs + ''
	}
}

/** Generate the translation for a string, to be applied later when it gets rendered */
export function generateTranslation(
	key: string,
	args?: { [k: string]: any },
	namespaces?: string[]
): ITranslatableMessage {
	return {
		key,
		args,
		namespaces,
	}
}

export function areSetsEqual<T>(a: Set<T>, b: Set<T>): boolean {
	return a.size === b.size && [...a].every((value) => b.has(value))
}

export function doSetsIntersect<T>(a: Set<T>, b: Set<T>): boolean {
	return [...a].some((value) => b.has(value))
}
