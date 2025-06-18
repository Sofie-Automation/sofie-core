import React, { PropsWithChildren, useMemo } from 'react'
import { PartId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { TimingDataResolution, TimingTickResolution, withTiming } from '../../RundownView/RundownTiming/withTiming'
import { protectStringArray } from '@sofie-automation/corelib/dist/protectedString'

export const OrderedPartsContext = React.createContext<PartId[]>([])

export const OrderedPartsProvider = withTiming<PropsWithChildren<{}>, {}>({
	dataResolution: TimingDataResolution.Synced,
	tickResolution: TimingTickResolution.Low,
})(function OrderedPartsProvider({ timingDurations, children }) {
	const orderedPartIds = useMemo(
		() => protectStringArray<PartId>(timingDurations.partCountdown ? Object.keys(timingDurations.partCountdown) : []),
		[Object.keys(timingDurations.partCountdown ?? {}).join(',')]
	)

	return <OrderedPartsContext.Provider value={orderedPartIds}>{children}</OrderedPartsContext.Provider>
})
