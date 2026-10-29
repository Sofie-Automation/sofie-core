import classNames from 'classnames'
import { useContext } from 'react'
import { AreaZoom } from './index.js'
import type { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist/RundownPlaylist'
import { getAllowSpeaking, getAllowVibrating } from '../../../lib/localStorage.js'
import { AutoNextStatus } from '../../RundownView/RundownTiming/AutoNextStatus.js'
import { CurrentPartOrSegmentRemaining } from '../../RundownView/RundownHeader/CurrentPartOrSegmentRemaining.js'
import { PartCountdown } from '../../RundownView/RundownTiming/PartCountdown.js'
import { PartDisplayDuration } from '../../RundownView/RundownTiming/PartDuration.js'
import { TimingTickResolution } from '../../RundownView/RundownTiming/RundownTiming.js'
import {
	TimerValueMode,
	usePartCountdownValue,
	usePartTimingValue,
	usePlaylistTimingValue,
} from '../../RundownView/RundownTiming/usePlaylistTimingValue.js'
import type { PartUi } from '../../SegmentContainer/withResolvedSegment.js'
import { Piece } from './Piece.js'
import type { PieceExtended } from '@sofie-automation/corelib/src/dataModel/Piece.js'

interface IProps {
	part: PartUi
	piece: PieceExtended
	playlist: DBRundownPlaylist
	isLive: boolean
	isNext: boolean
}

export function Part({ playlist, part, piece, isLive, isNext }: IProps): JSX.Element | null {
	const areaZoom = useContext(AreaZoom)

	const highResolution = { tickResolution: TimingTickResolution.High }
	const countdown = usePartCountdownValue(part.partId, TimerValueMode.Duration, highResolution)
	const played = usePartTimingValue(part.partId, 'played', TimerValueMode.CountUp, highResolution)
	// the live display duration, which grows past the planned one while the part overruns
	const displayDuration = usePartTimingValue(part.partId, 'liveDisplayDuration', TimerValueMode.CountUp, highResolution)
	const remainingOnCurrentPart = usePlaylistTimingValue(
		playlist._id,
		'remainingOnCurrentPart',
		TimerValueMode.Duration,
		{ ...highResolution, forPartInstanceId: part.instance._id }
	)

	let left = (countdown ?? 0) - (played ?? 0)
	let width: number | null = displayDuration

	if (isLive) {
		left = 0
		width = remainingOnCurrentPart !== null ? Math.max(0, remainingOnCurrentPart) : null
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
}
