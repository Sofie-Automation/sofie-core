import {
	SomeObjectOverrideOp,
	ObjectWithOverrides,
	applyAndValidateOverrides,
} from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { useRef, useEffect, useCallback, useMemo } from 'react'
import {
	OverrideOpHelper,
	OverrideOpHelperImpl,
	WrappedOverridableItemNormal,
} from '@sofie-automation/corelib/dist/overrideOpHelper'
import { ReadonlyDeep } from 'type-fest/source/readonly-deep'
import { literal } from '@sofie-automation/corelib/dist/lib'

export type * from '@sofie-automation/corelib/dist/overrideOpHelper'
export {
	getAllCurrentAndDeletedItemsFromOverrides,
	getAllCurrentItemsFromOverrides,
} from '@sofie-automation/corelib/dist/overrideOpHelper'

/**
 * A helper to work with modifying an ObjectWithOverrides<T>
 */
export function useOverrideOpHelper<T extends object>(
	saveOverrides: (newOps: SomeObjectOverrideOp[]) => void,
	objectWithOverrides: ObjectWithOverrides<T>
): OverrideOpHelper {
	const objectWithOverridesRef = useRef(objectWithOverrides)

	// Use a ref to minimise reactivity when it changes
	useEffect(() => {
		objectWithOverridesRef.current = objectWithOverrides
	}, [objectWithOverrides])

	return useCallback(() => {
		if (!objectWithOverridesRef.current) throw new Error('No current object!')
		return new OverrideOpHelperImpl(saveOverrides, objectWithOverridesRef.current)
	}, [saveOverrides, objectWithOverridesRef])
}

/**
 * A helper to work with modifying an ObjectWithOverrides<T> where T is a simple object (not an array of items)
 */
export function useOverrideOpHelperForSimpleObject<T extends object>(
	saveOverrides: (newOps: SomeObjectOverrideOp[]) => void,
	rawConfigObject: ReadonlyDeep<ObjectWithOverrides<T>>
): {
	wrappedItem: WrappedOverridableItemNormal<T>
	overrideHelper: OverrideOpHelper
} {
	const [wrappedItem, wrappedConfigObject] = useMemo(() => {
		const prefixedOps = rawConfigObject.overrides.map((op) => ({
			...op,
			// Fixup the paths to match the wrappedItem produced below
			path: `0.${op.path}`,
		}))

		const computedValue = applyAndValidateOverrides(rawConfigObject).obj

		const wrappedItem = literal<WrappedOverridableItemNormal<T>>({
			type: 'normal',
			id: '0',
			computed: computedValue,
			defaults: rawConfigObject.defaults,
			overrideOps: prefixedOps,
		})

		const wrappedConfigObject: ObjectWithOverrides<T> = {
			defaults: rawConfigObject.defaults as T,
			overrides: prefixedOps,
		}

		return [wrappedItem, wrappedConfigObject]
	}, [rawConfigObject])

	const overrideHelper = useOverrideOpHelper(saveOverrides, wrappedConfigObject)

	return {
		wrappedItem,
		overrideHelper,
	}
}
