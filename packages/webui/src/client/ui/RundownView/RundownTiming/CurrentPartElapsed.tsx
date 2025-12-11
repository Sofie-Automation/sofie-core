import { TimingDataResolution, TimingTickResolution, useTiming } from './withTiming.js'
import { RundownUtils } from '../../../lib/rundown.js'
import { unprotectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import { PartId } from '@sofie-automation/corelib/dist/dataModel/Ids'

interface IPartElapsedProps {
	currentPartId: PartId | undefined
	className?: string
}

/**
 * A presentational component that will render the elapsed duration of the current part
 */
export function CurrentPartElapsed({ currentPartId, className }: IPartElapsedProps): JSX.Element {
	const timingDurations = useTiming(TimingTickResolution.High, TimingDataResolution.High)

	const displayTimecode =
		currentPartId && timingDurations.partPlayed ? timingDurations.partPlayed[unprotectString(currentPartId)] || 0 : 0

	return (
		<span className={className} role="timer">
			{RundownUtils.formatDiffToTimecode(displayTimecode || 0, true, false, true, false, true, '', false, true)}
		</span>
	)
}
