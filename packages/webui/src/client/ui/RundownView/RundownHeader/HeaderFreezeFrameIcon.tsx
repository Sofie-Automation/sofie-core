import { PartInstanceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { FreezeFrameIcon } from '../../../lib/ui/icons/freezeFrame'
import { useTiming, TimingTickResolution, TimingDataResolution } from '../RundownTiming/withTiming'
import { useTracker } from '../../../lib/ReactMeteorData/ReactMeteorData'
import { PartInstances, PieceInstances } from '../../../collections'
import { VTContent } from '@sofie-automation/blueprints-integration'

export function HeaderFreezeFrameIcon({ partInstanceId }: { partInstanceId: PartInstanceId }): JSX.Element | null {
	const timingDurations = useTiming(TimingTickResolution.Synced, TimingDataResolution.Synced)

	const freezeFrameIcon = useTracker(
		() => {
			const partInstance = PartInstances.findOne(partInstanceId)
			if (!partInstance) return null

			// We use the exact display duration from the timing context just like VTSourceRenderer does.
			// Fallback to static displayDuration or expectedDuration if timing context is unavailable.
			const partDisplayDuration =
				(timingDurations.partDisplayDurations && timingDurations.partDisplayDurations[partInstanceId as any]) ??
				partInstance.part.displayDuration ??
				partInstance.part.expectedDuration ??
				0

			const partDuration = timingDurations.partDurations
				? timingDurations.partDurations[partInstanceId as any]
				: partDisplayDuration

			const pieceInstances = PieceInstances.find({ partInstanceId }).fetch()

			for (const pieceInstance of pieceInstances) {
				const piece = pieceInstance.piece
				if (piece.virtual) continue

				const content = piece.content as VTContent | undefined
				if (!content || content.loop || content.sourceDuration === undefined) {
					continue
				}

				const seek = content.seek || 0
				const renderedInPoint = typeof piece.enable.start === 'number' ? piece.enable.start : 0
				const pieceDuration = content.sourceDuration - seek

				const isAutoNext = partInstance.part.autoNext

				if (
					(isAutoNext && renderedInPoint + pieceDuration < partDuration) ||
					(!isAutoNext && Math.abs(renderedInPoint + pieceDuration - partDisplayDuration) > 500)
				) {
					return <FreezeFrameIcon className="freeze-frame-icon" />
				}
			}
			return null
		},
		[partInstanceId, timingDurations.partDisplayDurations, timingDurations.partDurations],
		null
	)

	return freezeFrameIcon
}
