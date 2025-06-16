import { clone, objectPathSet } from '@sofie-automation/corelib/dist/lib'
import { OverrideOpHelperForItemContentsBatcher } from '../../../ui/Settings/util/OverrideOpHelper.js'

/**
 * The OverrideOp system does not support Arrays currently.
 * This is intended to be a break point to avoid tables from attempting to define operations on arrays,
 * and instead make the table be treated as a single blob.
 */
export class OverrideOpHelperArrayTable implements OverrideOpHelperForItemContentsBatcher {
	readonly #baseHelper: OverrideOpHelperForItemContentsBatcher
	readonly #itemId: string
	readonly #currentRows: unknown[]
	readonly #path: string

	constructor(
		baseHelper: OverrideOpHelperForItemContentsBatcher,
		itemId: string,
		currentRows: unknown[],
		path: string
	) {
		this.#baseHelper = baseHelper
		this.#itemId = itemId
		this.#currentRows = currentRows
		this.#path = path
	}

	clearItemOverrides(_itemId: string, _subPath: string): this {
		// Not supported as this is faking an item with overrides

		return this
	}
	deleteRow(rowId: string): this {
		// Delete the row
		const newObj = clone(this.#currentRows)
		newObj.splice(Number(rowId), 1)

		// Send it onwards
		this.#baseHelper.setItemValue(this.#itemId, this.#path, newObj)

		return this
	}
	setItemValue(rowId: string, subPath: string, value: unknown): this {
		// Build the new object
		const newObj = clone(this.#currentRows)
		objectPathSet(newObj, `${rowId}.${subPath}`, value)

		// Send it onwards
		this.#baseHelper.setItemValue(this.#itemId, this.#path, newObj)

		return this
	}

	commit(): void {
		this.#baseHelper.commit()
	}
}
