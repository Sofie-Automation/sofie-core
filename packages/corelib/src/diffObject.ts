import EJSON from 'ejson'
import { ProtectedString } from './protectedString.js'

/**
 * Perform a shallow diff of a pair of objects.
 *
 * @param oldDoc The original object
 * @param newDoc The new object
 * @returns The difference, or null if nothing changed
 */
export function diffObject<T extends { _id: ProtectedString<any> }>(oldDoc: T, newDoc: T): Partial<T> | null {
	const oldDocAny: Record<string, any> = oldDoc
	const newDocAny: Record<string, any> = newDoc

	const fields: Record<string, any> = {}
	Object.keys(oldDocAny).forEach((key) => {
		if (Object.hasOwn(newDocAny, key)) {
			if (!EJSON.equals(oldDocAny[key], newDocAny[key])) fields[key] = newDocAny[key]
		} else {
			fields[key] = undefined
		}
	})

	Object.keys(newDocAny).forEach((key) => {
		if (!Object.hasOwn(oldDocAny, key)) {
			fields[key] = newDocAny[key]
		}
	})

	if (Object.keys(fields).length) return fields as Partial<T>
	return null
}
