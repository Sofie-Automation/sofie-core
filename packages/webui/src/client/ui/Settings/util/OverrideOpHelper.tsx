import { SomeObjectOverrideOp, ObjectWithOverrides } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { useRef, useEffect, useCallback } from 'react'
import { OverrideOpHelper, OverrideOpHelperImpl } from '@sofie-automation/corelib/dist/overrideOpHelper'

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
