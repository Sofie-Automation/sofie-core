import { clone, literal, objectPathSet } from './lib.js'
import {
	SomeObjectOverrideOp,
	ObjectWithOverrides,
	ObjectOverrideDeleteOp,
	ObjectOverrideSetOp,
	applyAndValidateOverrides,
	filterOverrideOpsForPrefix,
	findParentOpToUpdate,
} from './settings/objectWithOverrides.js'
import { ReadonlyDeep } from 'type-fest'

export interface WrappedOverridableItemDeleted<T extends object> {
	type: 'deleted'
	id: string
	computed: undefined
	defaults: ReadonlyDeep<T>
	overrideOps: ReadonlyDeep<SomeObjectOverrideOp[]>
}
export interface WrappedOverridableItemNormal<T extends object> {
	type: 'normal'
	id: string
	computed: T
	defaults: ReadonlyDeep<T> | undefined
	overrideOps: ReadonlyDeep<SomeObjectOverrideOp[]>
}

export type WrappedOverridableItem<T extends object> =
	| WrappedOverridableItemDeleted<T>
	| WrappedOverridableItemNormal<T>

/**
 * Compile a sorted array of all the items currently in the ObjectWithOverrides, and those that have been deleted
 * @param rawObject The ObjectWithOverrides to look at
 * @param comparitor Comparitor for sorting the items
 * @returns Sorted items, with sorted deleted items at the end
 */
export function getAllCurrentAndDeletedItemsFromOverrides<T extends object>(
	rawObject: ReadonlyDeep<ObjectWithOverrides<Record<string, T | undefined>>>,
	comparitor:
		| ((a: [id: string, obj: T | ReadonlyDeep<T>], b: [id: string, obj: T | ReadonlyDeep<T>]) => number)
		| null
): WrappedOverridableItem<T>[] {
	// Sort and wrap in the return type
	const sortedItems = getAllCurrentItemsFromOverrides(rawObject, comparitor)

	const computedItemIds = new Set(sortedItems.map((l) => l.id))
	const removedItems = getAllRemovedItemsFromOverrides(rawObject, comparitor, computedItemIds)

	return [...sortedItems, ...removedItems]
}

export function getAllRemovedItemsFromOverrides<T extends object>(
	rawObject: ReadonlyDeep<ObjectWithOverrides<Record<string, T | undefined>>>,
	comparitor:
		| ((a: [id: string, obj: T | ReadonlyDeep<T>], b: [id: string, obj: T | ReadonlyDeep<T>]) => number)
		| null,
	validItemIds: Set<string> // TODO - should this be optional?
): WrappedOverridableItemDeleted<T>[] {
	const removedItems: WrappedOverridableItemDeleted<T>[] = []

	// Find the items which have been deleted with an override
	for (const [id, output] of Object.entries<ReadonlyDeep<T | undefined>>(rawObject.defaults)) {
		if (!validItemIds.has(id) && output) {
			removedItems.push(
				literal<WrappedOverridableItemDeleted<T>>({
					type: 'deleted',
					id: id,
					computed: undefined,
					defaults: output,
					overrideOps: filterOverrideOpsForPrefix(rawObject.overrides, id).opsForPrefix,
				})
			)
		}
	}

	if (comparitor) removedItems.sort((a, b) => comparitor([a.id, a.defaults], [b.id, b.defaults]))

	return removedItems
}

/**
 * Compile a sorted array of all the items currently active in the ObjectWithOverrides
 * @param rawObject The ObjectWithOverrides to look at
 * @param comparitor Comparitor for sorting the items
 * @returns Sorted items
 */
export function getAllCurrentItemsFromOverrides<T extends object>(
	rawObject: ReadonlyDeep<ObjectWithOverrides<Record<string, T | undefined>>>,
	comparitor:
		| ((a: [id: string, obj: T | ReadonlyDeep<T>], b: [id: string, obj: T | ReadonlyDeep<T>]) => number)
		| null
): WrappedOverridableItemNormal<T>[] {
	const resolvedObject = applyAndValidateOverrides(rawObject).obj

	// Convert the items into an array
	const validItems: Array<[id: string, obj: T]> = []
	for (const [id, obj] of Object.entries<T | undefined>(resolvedObject)) {
		if (obj) validItems.push([id, obj])
	}

	if (comparitor) validItems.sort((a, b) => comparitor(a, b))

	// Sort and wrap in the return type
	const sortedItems = validItems.map(([id, obj]) =>
		literal<WrappedOverridableItemNormal<T>>({
			type: 'normal',
			id: id,
			computed: obj,
			defaults: rawObject.defaults[id],
			overrideOps: filterOverrideOpsForPrefix(rawObject.overrides, id).opsForPrefix,
		})
	)

	return sortedItems
}

type SaveOverridesFunction = (newOps: SomeObjectOverrideOp[]) => void

export type OverrideOpHelperForItemContents = () => OverrideOpHelperForItemContentsBatcher

export interface OverrideOpHelperForItemContentsBatcher {
	/**
	 * Clear all of the overrides for an value inside of an item
	 * This acts as a reset of property of its child properties
	 * Has no effect if there are no `overrideOps` on the `WrappedOverridableItemNormal`
	 */
	clearItemOverrides(itemId: string, subPath: string): this

	/**
	 * Set the value of a property of an item.
	 * Note: the id cannot be changed in this way
	 */
	setItemValue(itemId: string, subPath: string, value: unknown): this

	/**
	 * Finish the batch operation
	 */
	commit(): void
}

export interface OverrideOpHelperBatcher extends OverrideOpHelperForItemContentsBatcher {
	/**
	 * Clear all of the overrides for an item
	 * This acts as a reset to defaults or undelete
	 * Has no effect if there are no `overrideOps` on the `WrappedOverridableItemNormal`
	 */
	resetItem(itemId: string): this

	/**
	 * Delete an item from the object
	 */
	deleteItem(itemId: string): this

	/**
	 * Change the id of an item.
	 * This is only possible for ones which were created by an override, and does not exist in the defaults
	 * Only possible when the item being renamed does not exist in the defaults
	 */
	changeItemId(oldItemId: string, newItemId: string): this

	/**
	 * Replace a whole item with a new object
	 * Note: the id cannot be changed in this way
	 */
	replaceItem(itemId: string, value: any): this

	/**
	 * Finish the batch operation
	 */
	commit(): void
}

export type OverrideOpHelper = () => OverrideOpHelperBatcher

export class OverrideOpHelperImpl implements OverrideOpHelperBatcher {
	readonly #saveOverrides: SaveOverridesFunction | null
	readonly #object: ObjectWithOverrides<any>

	constructor(
		saveOverrides: SaveOverridesFunction | null,
		object: ObjectWithOverrides<any> | ReadonlyDeep<ObjectWithOverrides<any>>
	) {
		this.#saveOverrides = saveOverrides
		this.#object = { defaults: object.defaults, overrides: [...object.overrides] }
	}

	clearItemOverrides = (itemId: string, subPath: string): this => {
		const opPath = `${itemId}.${subPath}`

		const newOps = filterOverrideOpsForPrefix(this.#object.overrides, opPath).otherOps

		this.#object.overrides = newOps

		return this
	}

	resetItem = (itemId: string): this => {
		const newOps = filterOverrideOpsForPrefix(this.#object.overrides, itemId).otherOps

		this.#object.overrides = newOps

		return this
	}

	deleteItem = (itemId: string): this => {
		const newOps = filterOverrideOpsForPrefix(this.#object.overrides, itemId).otherOps
		if (this.#object.defaults[itemId]) {
			// If it was from the defaults, we need to mark it deleted
			newOps.push(
				literal<ObjectOverrideDeleteOp>({
					op: 'delete',
					path: itemId,
				})
			)
		}

		this.#object.overrides = newOps

		return this
	}

	changeItemId = (oldItemId: string, newItemId: string): this => {
		const { otherOps: newOps, opsForPrefix: opsForId } = filterOverrideOpsForPrefix(
			this.#object.overrides,
			oldItemId
		)

		if (!newItemId || newOps.find((op) => op.path === newItemId) || this.#object.defaults[newItemId]) {
			throw new Error('Id is invalid or already in use')
		}

		if (this.#object.defaults[oldItemId]) {
			// Future: should we be able to handle this?
			throw new Error("Can't change id of object with defaults")
		} else {
			// Change the id prefix of the ops
			for (const op of opsForId) {
				const newPath = `${newItemId}${op.path.substring(oldItemId.length)}`

				const newOp = {
					...op,
					path: newPath,
				}
				newOps.push(newOp)

				if (newOp.path === newItemId && newOp.op === 'set') {
					newOp.value._id = newItemId
				}
			}

			this.#object.overrides = newOps

			return this
		}
	}

	setItemValue = (itemId: string, subPath: string, value: unknown): this => {
		if (subPath === '_id') {
			throw new Error('Item id cannot be changed through this helper')
		} else {
			// Set a property
			const { otherOps: newOps, opsForPrefix: opsForId } = filterOverrideOpsForPrefix(
				this.#object.overrides,
				itemId
			)

			const setRootOp = opsForId.find((op) => op.path === itemId)
			if (setRootOp && setRootOp.op === 'set') {
				// This is as its base an override, so modify that instead
				const newOp = clone(setRootOp)

				objectPathSet(newOp.value, subPath, value)

				newOps.push(newOp)
			} else {
				// Look for a op which encompasses this new value
				const parentOp = findParentOpToUpdate(opsForId, subPath)
				if (parentOp) {
					// Found an op at a higher level that can be modified instead
					objectPathSet(parentOp.op.value, parentOp.newSubPath, value)
				} else {
					// Insert new op
					const newOp = literal<ObjectOverrideSetOp>({
						op: 'set',
						path: `${itemId}.${subPath}`,
						value: value,
					})

					const newOpAsPrefix = `${newOp.path}.`

					// Preserve any other overrides
					for (const op of opsForId) {
						if (op.path === newOp.path || op.path.startsWith(newOpAsPrefix)) {
							// ignore, as op has been replaced by the one at a higher path
						} else {
							// Retain unrelated op
							newOps.push(op)
						}
					}
					// Add the new override
					newOps.push(newOp)
				}
			}

			this.#object.overrides = newOps

			return this
		}
	}

	replaceItem = (itemId: string, value: unknown): this => {
		// Set a property
		const { otherOps: newOps } = filterOverrideOpsForPrefix(this.#object.overrides, itemId)

		// TODO - is this too naive?

		newOps.push(
			literal<ObjectOverrideSetOp>({
				op: 'set',
				path: `${itemId}`,
				value: value,
			})
		)

		this.#object.overrides = newOps

		return this
	}

	commit = (): void => {
		if (!this.#saveOverrides) throw new Error('Cannot commit changes without a save function')

		this.#saveOverrides(this.#object.overrides)
	}

	getPendingOps = (): SomeObjectOverrideOp[] => {
		return this.#object.overrides
	}
}
