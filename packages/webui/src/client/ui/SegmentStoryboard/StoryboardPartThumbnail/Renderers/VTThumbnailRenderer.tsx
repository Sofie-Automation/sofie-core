import classNames from 'classnames'
import { VTContent } from '@sofie-automation/blueprints-integration'
import { getNoticeLevelForPieceStatus } from '../../../../lib/notifications/notifications.js'
import { RundownUtils } from '../../../../lib/rundown.js'
import { IProps } from './ThumbnailRendererFactory.js'
import { unprotectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import { FreezeFrameIcon } from '../../../../lib/ui/icons/freezeFrame.js'
import { PieceStatusIcon } from '../../../../lib/ui/PieceStatusIcon.js'
import { FREEZE_FRAME_FLASH, PieceUi } from '../../../SegmentContainer/withResolvedSegment.js'
import { LoopingPieceIcon } from '../../../../lib/ui/icons/looping.js'
import { useContentStatusForPieceInstance } from '../../../SegmentTimeline/withMediaObjectStatus.js'
import { useTiming } from '../../../RundownView/RundownTiming/withTiming.js'
import { PartId } from '@sofie-automation/corelib/dist/dataModel/Ids.js'
import { PieceContentStatusObj } from '@sofie-automation/corelib/dist/dataModel/PieceContentStatus.js'

export function VTThumbnailRenderer(props: Readonly<IProps>): JSX.Element {
	const contentStatus = useContentStatusForPieceInstance(props.pieceInstance.instance)

	const noticeLevel = getNoticeLevelForPieceStatus(contentStatus?.status)

	return (
		<>
			<VTThumbnailRendererWithTiming {...props} contentStatus={contentStatus} />
			{props.pieceInstance.instance.piece.content?.loop && (
				<div className="segment-storyboard__thumbnail__countdown">
					<LoopingPieceIcon className="segment-storyboard__thumbnail__countdown-icon" playing={props.hovering} />
				</div>
			)}
			<div className="segment-storyboard__thumbnail__label">
				{noticeLevel !== null && <PieceStatusIcon noticeLevel={noticeLevel} />}
				{props.pieceInstance.instance.piece.name}
			</div>
		</>
	)
}

function VTThumbnailRendererWithTiming({
	partId,
	pieceInstance,
	partAutoNext,
	partPlannedStoppedPlayback,
	isLive,
	hovering,
	contentStatus,
}: {
	partId: PartId
	pieceInstance: PieceUi
	partAutoNext: boolean
	partPlannedStoppedPlayback: number | undefined
	isLive: boolean
	hovering: boolean
	contentStatus: PieceContentStatusObj | undefined
}) {
	const timingContext = useTiming(undefined, undefined, (timingContext) => ({
		partPlayed: timingContext.partPlayed && timingContext.partPlayed[unprotectString(partId)],
		partDisplayDurations:
			timingContext.partDisplayDurations && timingContext.partDisplayDurations[unprotectString(partId)],
		currentTime: timingContext.currentTime,
	}))

	const vtContent = pieceInstance.instance.piece.content as VTContent

	const previewUrl: string | undefined = contentStatus?.previewUrl
	const thumbnailUrl: string | undefined = contentStatus?.thumbnailUrl

	if (!timingContext.partPlayed || !timingContext.partDisplayDurations) return null
	if (pieceInstance.instance.piece.content?.loop) return null

	const partPlayed = timingContext.partPlayed[unprotectString(partId)] ?? 0
	const contentEnd = (vtContent?.sourceDuration ?? 0) - (vtContent?.seek ?? 0) + (pieceInstance.renderedInPoint ?? 0)

	const contentLeft = contentEnd - partPlayed

	const partExpectedDuration = timingContext.partDisplayDurations[unprotectString(partId)]

	const isFinished =
		!!partPlannedStoppedPlayback &&
		!!timingContext.currentTime &&
		partPlannedStoppedPlayback < timingContext.currentTime

	const partLeft = partExpectedDuration - partPlayed

	return !isFinished &&
		!(hovering && thumbnailUrl && previewUrl) &&
		(contentLeft < 10000 || contentEnd < partExpectedDuration) &&
		(!partAutoNext || partLeft > contentLeft) ? (
		<div
			className={classNames('segment-storyboard__thumbnail__countdown', {
				'segment-storyboard__thumbnail__countdown--playing': isLive,
			})}
		>
			<span
				className={classNames('segment-storyboard__thumbnail__countdown-icon', {
					'segment-storyboard__thumbnail__countdown-icon--flash': isLive && contentLeft < FREEZE_FRAME_FLASH,
				})}
			>
				<FreezeFrameIcon />
			</span>
			{contentLeft > 0 ? (
				<span>{RundownUtils.formatDiffToTimecode(contentLeft, false, false, true, false, true, '+')}</span>
			) : null}
		</div>
	) : null
}
