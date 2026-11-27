import type { PartialDeep, ReadonlyDeep } from 'type-fest'

/*
===============================================================================
===========================                   =================================
===========================  ProtectedString  =================================
===========================                   =================================
===============================================================================
==      This is a utility type for defining "special" string types,          ==
==    Such as references to database IDs or other unique identifiers.        ==
==                                                                           ==
==   The actual runtime values are just regular strings, but TypeScript      ==
==  will treat ProtectedStrings as distinct types based on their declared    ==
== type, avoiding the accidental mixing of different protected string types. ==
===============================================================================
*/

/**
 * Defines a string of a certain _type_.
 * The actual values at runtime are the actual string itself,
 * however during compile-time we pretend that all protected strings are prefixed with their type.
 * @example
 * type UserId = ProtectedString<'UserId'> // is any string at runtime
 * const id = protectString<UserId>('123')
 * type TL = ProtectedString<'UserId', `mystring_${string}`> // is a template literal at runtime
 */
export type ProtectedString<Type extends string, Value extends string = string> = `@@protectedString/${Type}/${Value}`

/**
 * The actual value type of a ProtectedString
 * ( which is a string or a template literal )
 */
export type ValueOfProtectedString<T extends UnknownProtectedString> =
	T extends ProtectedString<any, infer Value> ? Value : never

/**
 * Defines "unknown" ProtectedString. Any ProtectedString can be assigned to this,
 * but no specific ProtectedString can be inferred from it.
 */
export type UnknownProtectedString = ProtectedString<string, string>

type V<T extends UnknownProtectedString> = ValueOfProtectedString<T> // shorthand type
/**
 * Converts a string into a ProtectedString
 * (This does nothing at runtime; it only affects the TypeScript type)
 */

export function protectString<T extends UnknownProtectedString>(str: V<T>): T
export function protectString<T extends UnknownProtectedString>(str: V<T> | undefined): T | undefined
export function protectString<T extends UnknownProtectedString>(str: V<T> | null): T | null
export function protectString<T extends UnknownProtectedString>(str: V<T> | undefined | null): T | undefined | null {
	return str as any
}
export function protectStringArray<T extends UnknownProtectedString>(arr: V<T>[]): T[] {
	return arr as any as T[]
}

/**
 * Converts a ProtectedString back into a regular string
 * (This does nothing at runtime; it only affects the TypeScript type)
 * ( unprotectString(a: T) is an alias for a as ValueOfProtectedString<T> )
 */
export function unprotectString<T extends UnknownProtectedString>(str: T): V<T>
export function unprotectString<T extends UnknownProtectedString>(str: T | undefined): V<T> | undefined
export function unprotectString<T extends UnknownProtectedString>(str: T | null): V<T> | null
export function unprotectString<T extends UnknownProtectedString>(str: T | undefined | null): V<T> | undefined | null {
	return str as any
}
export function unprotectStringArray<T extends UnknownProtectedString>(protectedStrings: T[]): V<T>[] {
	return protectedStrings as any as V<T>[]
}
export function unDeepString<T extends UnknownProtectedString>(str: ReadonlyDeep<T> | PartialDeep<T>): T {
	return str as T
}
/** Used on protectedStrings instead of _.isString or typeof x === 'string' */
export function isProtectedString(str: unknown): str is UnknownProtectedString {
	return typeof str === 'string'
}
/** Like Object.entries() but returns stricter types */
export function objectEntries<T extends UnknownProtectedString, V>(obj: Record<T, V>): [T, V][] {
	return Object.entries<V>(obj) as any
}
/** Like Object.keys() but returns stricter types */
export function objectKeys<T extends UnknownProtectedString>(obj: Record<T, any>): T[] {
	return Object.keys(obj) as any
}
/** Like Object.values() but returns stricter types */
export function objectValues<V>(obj: Record<UnknownProtectedString, V>): V[] {
	return Object.values<V>(obj)
}

export type ProtectId<T extends { _id: string }> = Omit<T, '_id'> & { _id: UnknownProtectedString }

/** Converts all properties of an object that are ProtectedStrings back into regular strings */
export type UnprotectedStringProperties<T extends object | undefined> = {
	[P in keyof T]: T[P] extends UnknownProtectedString
		? V<T[P]>
		: T[P] extends UnknownProtectedString | undefined
			? string | undefined
			: T[P] extends object
				? UnprotectedStringProperties<T[P]>
				: T[P] extends object | undefined
					? UnprotectedStringProperties<T[P]>
					: T[P]
}
export function unprotectObject<T extends object>(obj: T): UnprotectedStringProperties<T>
export function unprotectObject<T extends object>(obj: T | undefined): UnprotectedStringProperties<T> | undefined
export function unprotectObject(obj: undefined): undefined
export function unprotectObject<T extends object>(obj: T | undefined): UnprotectedStringProperties<T> | undefined {
	return obj as any
}
export function unprotectObjectArray<T extends object>(obj: T[]): UnprotectedStringProperties<T>[]
export function unprotectObjectArray<T extends object>(obj: readonly T[]): readonly UnprotectedStringProperties<T>[]
export function unprotectObjectArray<T extends object>(obj: T[] | readonly T[]): UnprotectedStringProperties<T>[] {
	return obj as any
}
export function isStringOrProtectedString<T extends UnknownProtectedString>(val: unknown): val is V<T> | T {
	return typeof val === 'string'
}

export function unpartialString<T extends UnknownProtectedString>(obj: T | PartialDeep<T>): T
export function unpartialString<T extends UnknownProtectedString>(str: T | PartialDeep<T> | undefined): T | undefined
export function unpartialString<T extends UnknownProtectedString>(str: T | PartialDeep<T> | undefined): T | undefined {
	return str as any
}
