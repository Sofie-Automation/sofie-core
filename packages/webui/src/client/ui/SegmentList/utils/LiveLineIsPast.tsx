import React from 'react'
import { RundownTimingConsumer } from '../../RundownView/RundownTiming/RundownTimingConsumer'
import { TimingDataResolution, TimingTickResolution } from '../../RundownView/RundownTiming/withTiming'

export const LiveLineIsPast = React.memo(function LiveLineIsPast({
	partTimingId,
	time,
	children,
}: {
	partTimingId: string
	time: number
	children?: (isPast: boolean) => JSX.Element | null
}) {
	return (
		<RundownTimingConsumer
			dataResolution={TimingDataResolution.High}
			tickResolution={TimingTickResolution.High}
			filter={(data) => data.partPlayed?.[partTimingId]}
		>
			{(timingContext) => {
				const livePosition = timingContext.partPlayed?.[partTimingId] ?? 0

				return children ? children(livePosition > time) : null
			}}
		</RundownTimingConsumer>
	)
})
