import type { PartInstanceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { FreezeFrameIcon } from '../../../lib/ui/icons/freezeFrame'
import { useTracker } from '../../../lib/ReactMeteorData/ReactMeteorData'
import { PieceInstances } from '../../../collections'
import type { VTContent } from '@sofie-automation/blueprints-integration'
import { UIPartInstances } from '../../Collections'
import { TimerValueMode, usePartTimingValue } from '../RundownTiming/usePlaylistTimingValue'

export function HeaderFreezeFrameIcon({ partInstanceId }: { partInstanceId: PartInstanceId }): JSX.Element | null {
	const partId = useTracker(() => UIPartInstances.findOne(partInstanceId)?.part._id, [partInstanceId], undefined)

	// The exact display duration, just like VTSourceRenderer uses
	const publishedDisplayDuration = usePartTimingValue(partId, 'liveDisplayDuration', TimerValueMode.CountUp)
	const publishedDuration = usePartTimingValue(partId, 'duration', TimerValueMode.CountUp)

	const freezeFrameIcon = useTracker(
		() => {
			const partInstance = UIPartInstances.findOne(partInstanceId)
			if (!partInstance) return null

			// Fall back to the Part's own durations while nothing is published for it yet
			const partDisplayDuration =
				publishedDisplayDuration ?? partInstance.part.displayDuration ?? partInstance.part.expectedDuration ?? 0

			const partDuration = publishedDuration ?? partDisplayDuration

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
		[partInstanceId, publishedDisplayDuration, publishedDuration],
		null
	)

	return freezeFrameIcon
}
