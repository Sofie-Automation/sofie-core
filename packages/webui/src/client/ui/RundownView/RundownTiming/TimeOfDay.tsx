import { withTiming, WithTiming } from './withTiming'
import Moment from 'react-moment'

export const TimeOfDay = withTiming<{}, {}>()(function TimeOfDay({ timingDurations }: WithTiming<{}>) {
	return (
		<span className="timing-clock time-now">
			<Moment interval={0} format="HH:mm:ss" date={timingDurations.currentTime || 0} />
		</span>
	)
})
