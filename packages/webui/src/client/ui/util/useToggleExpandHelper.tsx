import { ProtectedString, unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { useState, useCallback } from 'react'

export function useToggleExpandHelper(): {
	toggleExpanded: (id: ProtectedString<any> | string | number, forceState?: boolean) => void
	isExpanded: (id: ProtectedString<any> | string | number) => boolean
} {
	const [expandedItemIds, setExpandedItemIds] = useState<Record<string, boolean>>({})

	const toggleExpanded = useCallback((id0: ProtectedString<any> | string | number, forceState?: boolean) => {
		const id = typeof id0 !== 'number' && typeof id0 !== 'string' ? unprotectString(id0) : id0
		setExpandedItemIds((oldExpanded) => {
			// This will leak entries as layers are added and removed, but not fast enough to be a problem
			return {
				...oldExpanded,
				[id]: forceState ?? !oldExpanded[id],
			}
		})
	}, [])

	const isExpanded = (id0: ProtectedString<any> | string | number): boolean => {
		const id = typeof id0 !== 'number' && typeof id0 !== 'string' ? unprotectString(id0) : id0
		return !!expandedItemIds[id]
	}

	return {
		toggleExpanded,
		isExpanded,
	}
}
