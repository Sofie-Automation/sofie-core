import { literal } from '@sofie-automation/corelib/dist/lib'
import { ProtectedString } from '@sofie-automation/corelib/dist/protectedString'
import {
	ObjectOverrideDeleteOp,
	ObjectOverrideSetOp,
} from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { useCallback, useMemo } from 'react'
import { MongoCollection } from '../../collections/lib.js'
import {
	WrappedOverridableItemNormal,
	OverrideOpHelperForItemContentsBatcher,
} from '../../ui/Settings/util/OverrideOpHelper.js'
import { SchemaFormCommonProps } from './schemaFormUtil.js'
import { SchemaFormWithOverrides } from './SchemaFormWithOverrides.js'
import { MongoModifier } from '@sofie-automation/corelib/dist/mongo'

interface SchemaFormForCollectionProps extends Omit<SchemaFormCommonProps, 'isRequired'> {
	/** The collection to operate on */
	collection: MongoCollection<any>
	/** Id of the document in the collection */
	objectId: ProtectedString<any>
	/** Base path of the schema within the document */
	basePath: string
	/** The portion of the document where the schema applies, that will be modified */
	object: any

	/**
	 * If set, this form is to build a Partial object of overrides to apply over the provided object
	 * Note: this requires the schema to be shallow, and to not use any sub-objects
	 */
	partialOverridesForObject?: any
}

export function SchemaFormForCollection({
	object,
	basePath,
	collection,
	objectId,
	partialOverridesForObject,
	...commonProps
}: Readonly<SchemaFormForCollectionProps>): JSX.Element {
	const helper = useCallback(
		() => new OverrideOpHelperCollection(collection, objectId, basePath),
		[collection, objectId, basePath]
	)

	const wrappedItem = useMemo(() => {
		if (partialOverridesForObject) {
			// Note: this assumes it to be using a shallow object. If it is not then the logic becomes a lot more complex, and more than we want to handle here
			const computed = {
				...partialOverridesForObject,
				...object,
			}

			// Note: these ops use a prefix of `0.` to satisfy how the objectWithOverrides expects them to look
			const overrideOps = Object.entries<any>(object).map(([key, val]) =>
				val === undefined
					? literal<ObjectOverrideDeleteOp>({
							op: 'delete',
							path: `0.${key}`,
						})
					: literal<ObjectOverrideSetOp>({
							op: 'set',
							path: `0.${key}`,
							value: val,
						})
			)

			return literal<WrappedOverridableItemNormal<any>>({
				type: 'normal',
				id: '0',
				computed: computed,
				defaults: partialOverridesForObject,
				overrideOps,
			})
		} else {
			return literal<WrappedOverridableItemNormal<any>>({
				type: 'normal',
				id: 'not-used',
				computed: object,
				defaults: undefined,
				overrideOps: [],
			})
		}
	}, [object, partialOverridesForObject])

	return <SchemaFormWithOverrides {...commonProps} attr={''} item={wrappedItem} overrideHelper={helper} isRequired />
}

/**
 * An alternate OverrideOpHelper designed to directly mutate a collection, instead of using the `ObjectWithOverrides` system.
 * This allows us to have one SchemaForm implementation that can handle working with `ObjectWithOverrides`, and basic objects in mongodb
 */
class OverrideOpHelperCollection implements OverrideOpHelperForItemContentsBatcher {
	readonly #collection: MongoCollection<any>
	readonly #objectId: ProtectedString<any>
	readonly #basePath: string

	#changes: MongoModifier<any> | undefined

	constructor(collection: MongoCollection<any>, objectId: ProtectedString<any>, basePath: string) {
		this.#collection = collection
		this.#objectId = objectId
		this.#basePath = basePath
	}

	clearItemOverrides(_itemId: string, subPath: string): this {
		if (!this.#changes) this.#changes = {}
		if (!this.#changes.$unset) this.#changes.$unset = {}

		this.#changes.$unset[`${this.#basePath}.${subPath}`] = 1

		return this
	}
	setItemValue(_itemId: string, subPath: string, value: any): this {
		if (!this.#changes) this.#changes = {}

		if (value === undefined) {
			if (!this.#changes.$unset) this.#changes.$unset = {}
			this.#changes.$unset[`${this.#basePath}.${subPath}`] = 1
		} else {
			if (!this.#changes.$set) this.#changes.$set = {}
			this.#changes.$set[`${this.#basePath}.${subPath}`] = value
		}

		return this
	}

	commit(): void {
		if (this.#changes) {
			const changesToSave = this.#changes
			this.#changes = undefined

			this.#collection.update(this.#objectId, changesToSave)
		}
	}
}
