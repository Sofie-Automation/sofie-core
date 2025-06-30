import { ProtectedString } from './protectedString.js'

export type Time = number
export type TimeDuration = number

export function assertNever(_never: never): void {
	// Do nothing. This is a type guard
}
export function literal<T>(o: T): T {
	return o
}

/** Convenience function, to be used when length of array has previously been verified */
export function last<T>(values: T[]): T {
	return values[values.length - 1]
}

export function objectFromEntries<Key extends ProtectedString<any>, Val>(
	entries: Array<[Key, Val]>
): Record<string, Val> {
	return Object.fromEntries(entries)
}

export async function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms))
}

export function isPromise<T>(val: unknown): val is Promise<T> {
	const val0 = val as any
	return val0 && typeof val0 == 'object' && typeof val0.then === 'function' && typeof val0.catch === 'function'
}

/**
 * This is a fast, shallow compare of two Sets.
 *
 * **Note**: This is a shallow compare, so it will return false if the objects in the arrays are identical, but not the same.
 *
 * @param a
 * @param b
 */
export function equalSets<T>(a: Set<T>, b: Set<T>): boolean {
	if (a === b) return true
	if (a.size !== b.size) return false
	for (const val of a.values()) {
		if (!b.has(val)) return false
	}
	return true
}

/**
 * This is a fast, shallow compare of two arrays that are used as unsorted lists. The ordering of the elements is ignored.
 *
 * **Note**: This is a shallow compare, so it will return false if the objects in the arrays are identical, but not the same.
 *
 * @param a
 * @param b
 */
export function equivalentArrays<T>(a: T[], b: T[]): boolean {
	if (a === b) return true
	if (a.length !== b.length) return false
	for (let i = 0; i < a.length; i++) {
		if (!b.includes(a[i])) return false
	}
	return true
}

/**
 * This is a fast, shallow compare of two arrays of the same type.
 *
 * **Note**: This is a shallow compare, so it will return false if the objects in the arrays are identical, but not the same.
 * @param a
 * @param b
 */
export function equalArrays<T>(a: T[], b: T[]): boolean {
	if (a === b) return true
	if (a.length !== b.length) return false
	for (let i = 0; i < a.length; i++) {
		if (b[i] !== a[i]) return false
	}
	return true
}
