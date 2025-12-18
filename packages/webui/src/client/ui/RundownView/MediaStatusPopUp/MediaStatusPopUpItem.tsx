import { useCallback, JSX } from 'react'
import { PartId, PartInstanceId, SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { SourceLayerType } from '@sofie-automation/blueprints-integration'
import { PieceStatusCode } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { TimingDataResolution, TimingTickResolution, useTiming } from '../RundownTiming/withTiming.js'
import { RundownUtils } from '../../../lib/rundown.js'
import classNames from 'classnames'
import { MediaStatusIndicator } from '../../MediaStatus/MediaStatusIndicator.js'
import { scrollToPart, scrollToSegment } from '../../../lib/viewPort.js'
import { logger } from '../../../lib/logging.js'

interface IMediaStatusPopUpItemProps {
	partId: PartId | undefined
	segmentId: SegmentId | undefined
	partInstanceId: PartInstanceId | undefined
	status: PieceStatusCode
	isWorkingOn: boolean
	statusOverlay?: string | undefined
	sourceLayerType?: SourceLayerType | undefined
	sourceLayerName?: string | undefined
	segmentIdentifier?: string | undefined
	partIdentifier?: string | undefined
	invalid?: boolean | undefined
	label: string
	isAdLib: boolean
	isLive: boolean
	isNext: boolean
}

export function MediaStatusPopUpItem({
	partId,
	partInstanceId,
	segmentId,
	status,
	isWorkingOn,
	statusOverlay,
	sourceLayerType,
	sourceLayerName,
	segmentIdentifier,
	partIdentifier,
	invalid,
	label,
	isAdLib,
	isLive,
	isNext,
}: IMediaStatusPopUpItemProps): JSX.Element {
	const timingDurations = useTiming(TimingTickResolution.Low, TimingDataResolution.Synced)

	const timingId = unprotectString(partInstanceId ?? partId)
	const thisPartCountdown = timingId ? timingDurations.partCountdown?.[timingId] : undefined

	const sourceLayerClassName =
		sourceLayerType !== undefined ? RundownUtils.getSourceLayerClassName(sourceLayerType) : undefined

	const onPartIdentifierClick = useCallback(() => {
		if (!segmentId || !partId) return

		scrollToPart(partId, false, false, false).catch(logger.error)
	}, [segmentId, partId])

	const onSegmentIdentifierClick = useCallback(() => {
		if (!segmentId) return

		scrollToSegment(segmentId, false, false).catch(logger.error)
	}, [segmentId])

	return (
		<tr className="media-status-popup-item">
			<td className="media-status-popup-item__playout-indicator">
				{isNext && !isLive ? <div className="media-status-popup-item__next-indicator"></div> : null}
				{isLive ? <div className="media-status-popup-item__live-indicator"></div> : null}
			</td>
			<td className="media-status-popup-item__countdown">
				{!isAdLib && thisPartCountdown ? RundownUtils.formatTimeToShortTime(thisPartCountdown) : null}
			</td>
			<td className="media-status-popup-item__identifiers">
				{segmentIdentifier ? (
					<button className="media-status-popup-item__segment-identifier" onClick={onSegmentIdentifierClick}>
						{segmentIdentifier}
					</button>
				) : null}
				{partIdentifier ? (
					<button className="media-status-popup-item__part-identifier" onClick={onPartIdentifierClick}>
						{partIdentifier}
					</button>
				) : null}
			</td>
			<td className="media-status-popup-item__status">
				<MediaStatusIndicator status={status} overlay={statusOverlay} isWorking={isWorkingOn} />
			</td>
			<td className="media-status-popup-item__source-layer">
				<div
					data-status={status}
					className={classNames('media-status-popup-item__source-layer-indicator', sourceLayerClassName, {
						'source-missing': status === PieceStatusCode.SOURCE_MISSING || status === PieceStatusCode.SOURCE_NOT_SET,
						'source-unknown-state': status === PieceStatusCode.SOURCE_UNKNOWN_STATE,
						'source-broken': status === PieceStatusCode.SOURCE_BROKEN,
						'source-not-ready': status === PieceStatusCode.SOURCE_NOT_READY,
					})}
				>
					{invalid && <div className={'media-status-popup-item__source-layer-overlay invalid'}></div>}
					<div className="media-status-popup-item__source-layer-label">{sourceLayerName}</div>
				</div>
			</td>
			<td className="media-status-popup-item__label">{label}</td>
		</tr>
	)
}
