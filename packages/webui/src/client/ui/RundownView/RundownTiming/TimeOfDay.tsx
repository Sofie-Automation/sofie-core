import { useTiming } from './withTiming.js'
import Moment from 'react-moment'

export function TimeOfDay(): JSX.Element {
	const timingDurations = useTiming()

	return (
		<span className="timing-clock time-now">
			<Moment interval={0} format="HH:mm:ss" date={timingDurations.currentTime || 0} />
		</span>
	)
}
