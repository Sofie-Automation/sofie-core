import { clone, joinObjectPathFragments, objectPathSet } from '@sofie-automation/corelib/dist/lib'
import {
	OverrideOpHelperForItemContentsBatcher,
	WrappedOverridableItem,
} from '../../../ui/Settings/util/OverrideOpHelper.js'

/**
 * The OverrideOp system does not support tables of objects currently.
 * This is intended to be a break point to allow tables to provide their nested schemaForms with a way to work with this
 */
export class OverrideOpHelperObjectTable implements OverrideOpHelperForItemContentsBatcher {
	readonly #baseHelper: OverrideOpHelperForItemContentsBatcher
	readonly #parentItem: WrappedOverridableItem<object>
	readonly #currentRows: WrappedOverridableItem<object>[]
	readonly #path: string

	constructor(
		baseHelper: OverrideOpHelperForItemContentsBatcher,
		parentItem: WrappedOverridableItem<object>,
		currentRows: WrappedOverridableItem<object>[],
		path: string
	) {
		this.#baseHelper = baseHelper
		this.#parentItem = parentItem
		this.#currentRows = currentRows
		this.#path = path
	}

	clearItemOverrides(rowId: string, subPath: string): this {
		this.#baseHelper.clearItemOverrides(this.#parentItem.id, joinObjectPathFragments(this.#path, rowId, subPath))

		return this
	}
	insertRow(rowId: string, value: unknown): this {
		this.#baseHelper.setItemValue(this.#parentItem.id, joinObjectPathFragments(this.#path, rowId), value)

		return this
	}
	deleteRow(rowId: string): this {
		const rowPath = joinObjectPathFragments(this.#path, rowId)

		// Clear any existing overrides
		this.#baseHelper.clearItemOverrides(this.#parentItem.id, rowPath)

		// If row was not user created (it has defaults), then don't store `undefined`
		const row = this.#currentRows.find((r) => r.id === rowId)
		if (!this.#parentItem.defaults || row?.defaults) {
			// This is a bit of a hack, but it isn't possible to create a delete op from here
			this.#baseHelper.setItemValue(this.#parentItem.id, rowPath, undefined)
		}

		return this
	}
	setItemValue(rowId: string, subPath: string, value: unknown): this {
		const currentRow = this.#currentRows.find((r) => r.id === rowId)
		if (!currentRow || currentRow.type === 'deleted') return this // Unable to set value

		if (currentRow.defaults) {
			// has defaults, so override the single value
			this.#baseHelper.setItemValue(this.#parentItem.id, joinObjectPathFragments(this.#path, rowId, subPath), value)
		} else {
			// no defaults, replace the whole object
			// Ensure there arent existing overrides
			this.#baseHelper.clearItemOverrides(this.#parentItem.id, joinObjectPathFragments(this.#path, rowId))

			// replace with a new override
			const newObj = clone(currentRow.computed)
			objectPathSet(newObj, subPath, value)
			this.#baseHelper.setItemValue(this.#parentItem.id, joinObjectPathFragments(this.#path, rowId), newObj)
		}

		return this
	}

	commit(): void {
		this.#baseHelper.commit()
	}
}
