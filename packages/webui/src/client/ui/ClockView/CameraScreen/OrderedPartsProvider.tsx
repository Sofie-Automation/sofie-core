import React, { PropsWithChildren, useMemo } from 'react'
import { PartId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { TimingDataResolution, TimingTickResolution, useTiming } from '../../RundownView/RundownTiming/withTiming.js'
import { protectStringArray } from '@sofie-automation/corelib/dist/protectedString'

export const OrderedPartsContext = React.createContext<PartId[]>([])

export function OrderedPartsProvider({ children }: PropsWithChildren): JSX.Element {
	const timingDurations = useTiming(TimingTickResolution.Low, TimingDataResolution.Synced)

	const orderedPartIds = useMemo(
		() => protectStringArray<PartId>(timingDurations.partCountdown ? Object.keys(timingDurations.partCountdown) : []),
		[Object.keys(timingDurations.partCountdown ?? {}).join(',')]
	)

	return <OrderedPartsContext.Provider value={orderedPartIds}>{children}</OrderedPartsContext.Provider>
}
