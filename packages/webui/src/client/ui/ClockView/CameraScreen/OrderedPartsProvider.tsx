import React, { type PropsWithChildren } from 'react'
import type { PartId, RundownPlaylistId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { useOrderedPartIds } from '../../RundownView/RundownTiming/usePlaylistTimingValue.js'

export const OrderedPartsContext = React.createContext<PartId[]>([])

export function OrderedPartsProvider({
	playlistId,
	children,
}: PropsWithChildren<{ playlistId: RundownPlaylistId | undefined }>): JSX.Element {
	const orderedPartIds = useOrderedPartIds(playlistId)

	return <OrderedPartsContext.Provider value={orderedPartIds}>{children}</OrderedPartsContext.Provider>
}
