import React from 'react'
import { TimingDataResolution, TimingTickResolution, useTiming } from '../../RundownView/RundownTiming/withTiming.js'

export const LiveLineIsPast = React.memo(function LiveLineIsPast({
	partTimingId,
	time,
	children,
}: {
	partTimingId: string
	time: number
	children?: (isPast: boolean) => JSX.Element | null
}) {
	const timingContext = useTiming(
		TimingTickResolution.High,
		TimingDataResolution.High,
		(data) => data.partPlayed?.[partTimingId]
	)

	const livePosition = timingContext.partPlayed?.[partTimingId] ?? 0

	return children ? children(livePosition > time) : null
})
