import React from 'react'
import { TimingTickResolution } from '../../RundownView/RundownTiming/RundownTiming.js'
import { TimerValueMode, usePartTimingValue } from '../../RundownView/RundownTiming/usePlaylistTimingValue.js'
import type { PartId } from '@sofie-automation/corelib/dist/dataModel/Ids'

export const LiveLineIsPast = React.memo(function LiveLineIsPast({
	partId,
	time,
	children,
}: {
	partId: PartId
	time: number
	children?: (isPast: boolean) => JSX.Element | null
}) {
	// The played time only moves while this part is on air, so only then is this redrawn on every tick
	const livePosition =
		usePartTimingValue(partId, 'played', TimerValueMode.CountUp, {
			tickResolution: TimingTickResolution.High,
			tickResolutionWhileHolding: TimingTickResolution.None,
		}) ?? 0

	return children ? children(livePosition > time) : null
})
