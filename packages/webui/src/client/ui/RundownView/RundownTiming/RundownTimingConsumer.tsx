import { RundownTimingContext } from '../../../lib/rundownTiming'
import { TimingDataResolution, TimingTickResolution, WithTiming, withTiming } from './withTiming'

interface IProps {
	filter?: (timingDurations: RundownTimingContext) => any
	dataResolution?: TimingDataResolution
	tickResolution?: TimingTickResolution
	children?: (timingDurations: RundownTimingContext) => JSX.Element | null
}

export const RundownTimingConsumer = withTiming<IProps, {}>((props) => ({
	filter: props.filter,
	dataResolution: props.dataResolution ?? TimingDataResolution.Synced,
	tickResolution: props.tickResolution ?? TimingTickResolution.Synced,
}))(({ timingDurations, children }: WithTiming<IProps>) => {
	return children ? children(timingDurations) : null
})
