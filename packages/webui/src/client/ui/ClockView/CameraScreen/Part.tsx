import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import classNames from 'classnames'
import { useContext } from 'react'
import { AreaZoom } from '.'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { PieceExtended } from '../../../lib/RundownResolver'
import { getAllowSpeaking, getAllowVibrating } from '../../../lib/localStorage'
import { getPartInstanceTimingValue } from '../../../lib/rundownTiming'
import { AutoNextStatus } from '../../RundownView/RundownTiming/AutoNextStatus'
import { CurrentPartOrSegmentRemaining } from '../../RundownView/RundownTiming/CurrentPartOrSegmentRemaining'
import { PartCountdown } from '../../RundownView/RundownTiming/PartCountdown'
import { PartDisplayDuration } from '../../RundownView/RundownTiming/PartDuration'
import { TimingDataResolution, TimingTickResolution, withTiming } from '../../RundownView/RundownTiming/withTiming'
import { PartUi } from '../../SegmentContainer/withResolvedSegment'
import { Piece } from './Piece'

interface IProps {
	part: PartUi
	piece: PieceExtended
	playlist: DBRundownPlaylist
	isLive: boolean
	isNext: boolean
}

export const Part = withTiming<IProps, {}>({
	tickResolution: TimingTickResolution.High,
	dataResolution: TimingDataResolution.High,
})(function Part({ playlist, part, piece, timingDurations, isLive, isNext }): JSX.Element | null {
	const areaZoom = useContext(AreaZoom)

	let left =
		(timingDurations.partCountdown?.[unprotectString(part.partId)] ?? 0) -
		(getPartInstanceTimingValue(timingDurations.partPlayed, part.instance) || 0)
	let width: number | null = getPartInstanceTimingValue(timingDurations.partDisplayDurations, part.instance) ?? null

	if (isLive) {
		left = 0
		width =
			timingDurations.remainingTimeOnCurrentPart !== undefined
				? Math.max(0, timingDurations.remainingTimeOnCurrentPart)
				: null
	}

	if (!part.instance.part.expectedDuration && !part.instance.part.displayDurationGroup) {
		width = null
	}

	return (
		<div
			className={classNames('camera-screen__part', { live: isLive, next: isNext })}
			data-obj-id={part.instance._id}
			data-part-id={part.instance.part._id}
		>
			{piece && (
				<Piece
					partId={part.instance.part._id}
					piece={piece}
					left={left}
					width={width}
					zoom={areaZoom}
					isLive={isLive}
				/>
			)}
			<div className="camera-screen__countdown">
				<PartCountdown playlist={playlist} partId={part.partId} />
			</div>
			<div className="camera-screen__part-duration-left">
				{isLive && (
					<>
						<span className="camera-screen__part-take-mode">
							<AutoNextStatus />
						</span>
						<CurrentPartOrSegmentRemaining
							currentPartInstanceId={part.instance._id}
							speaking={getAllowSpeaking()}
							vibrating={getAllowVibrating()}
							heavyClassName="overtime"
						/>
					</>
				)}
				{!isLive && <PartDisplayDuration part={part} />}
			</div>
		</div>
	)
})
