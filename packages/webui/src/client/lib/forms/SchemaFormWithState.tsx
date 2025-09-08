import { useCallback, useMemo } from 'react'
import {
	OverrideOpHelperForItemContentsBatcher,
	WrappedOverridableItemNormal,
} from '../../ui/Settings/util/OverrideOpHelper.js'
import { SchemaFormCommonProps } from './schemaFormUtil.js'
import { SchemaFormWithOverrides } from './SchemaFormWithOverrides.js'
import { literal, objectPathSet } from '@sofie-automation/corelib/dist/lib'
import { AnyARecord } from 'dns'

interface SchemaFormWithStateProps extends Omit<SchemaFormCommonProps, 'isRequired'> {
	object: any

	onUpdate: (object: any) => void
}

export function SchemaFormWithState({
	object,
	onUpdate,
	...commonProps
}: Readonly<SchemaFormWithStateProps>): JSX.Element {
	const helper = useCallback(
		() =>
			new OverrideOpHelperWithState(object, (object) => {
				onUpdate(object)
			}),
		[object, onUpdate]
	)

	const wrappedItem = useMemo(
		() =>
			literal<WrappedOverridableItemNormal<any>>({
				type: 'normal',
				id: 'not-used',
				computed: object,
				defaults: undefined,
				overrideOps: [],
			}),
		[object]
	)

	return <SchemaFormWithOverrides {...commonProps} attr="" item={wrappedItem} overrideHelper={helper} isRequired />
}

/**
 * An alternate OverrideOpHelper designed to directly mutate an object, instead of using the `ObjectWithOverrides` system.
 * This allows us to have one SchemaForm implementation that can handle working with `ObjectWithOverrides`, and simpler options
 */
class OverrideOpHelperWithState implements OverrideOpHelperForItemContentsBatcher {
	readonly #object: any
	readonly #onUpdate: (object: any) => void

	constructor(object: AnyARecord, onUpdate: (object: any) => void) {
		this.#object = object
		this.#onUpdate = onUpdate
	}

	clearItemOverrides(_itemId: string, _subPath: string): this {
		// Not supported as this is faking an item with overrides

		return this
	}
	setItemValue(_itemId: string, subPath: string, value: any): this {
		objectPathSet(this.#object, subPath, value)

		return this
	}

	commit(): void {
		this.#onUpdate(this.#object)
	}
}
