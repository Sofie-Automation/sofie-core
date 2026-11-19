import { RundownUtils } from '../../../lib/rundown.js'
import type { PartId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { TimingTickResolution } from './RundownTiming.js'
import { TimerValueMode, usePartTimingValue } from './usePlaylistTimingValue.js'

interface IPartElapsedProps {
	currentPartId: PartId | undefined
	className?: string
}

/**
 * A presentational component that will render the elapsed duration of the current part
 */
export function CurrentPartElapsed({ currentPartId, className }: IPartElapsedProps): JSX.Element {
	const displayTimecode = usePartTimingValue(currentPartId, 'played', TimerValueMode.CountUp, {
		tickResolution: TimingTickResolution.High,
	})

	return (
		<span className={className} role="timer">
			{RundownUtils.formatDiffToTimecodeCountdown(displayTimecode ?? 0)}
		</span>
	)
}
