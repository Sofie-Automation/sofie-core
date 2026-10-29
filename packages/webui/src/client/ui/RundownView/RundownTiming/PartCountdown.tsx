import type { ReactNode } from 'react'
import Moment from 'react-moment'
import { RundownUtils } from '../../../lib/rundown.js'
import type { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist/RundownPlaylist'
import type { PartId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { TimerValueMode, usePartCountdownValue, usePlaylistTimingValue } from './usePlaylistTimingValue.js'

interface IPartCountdownProps {
	partId?: PartId
	hideOnZero?: boolean
	label?: ReactNode
	useWallClock?: boolean
	playlist: DBRundownPlaylist
}

/**
 * A presentational component that will render a countdown to a given Part
 */
export function PartCountdown(props: IPartCountdownProps): JSX.Element | null {
	// absent when the Part will probably not be played out, if played in order
	const thisPartCountdown = usePartCountdownValue(props.partId, TimerValueMode.Duration)
	// the countdown read as the time of day it reaches zero, at the same moment as the countdown itself
	const thisPartStartTime = usePartCountdownValue(props.partId, TimerValueMode.Timestamp)
	const plannedStart = usePlaylistTimingValue(props.playlist._id, 'plannedStart', TimerValueMode.Timestamp)

	if (thisPartCountdown === null || thisPartStartTime === null || (props.hideOnZero === true && thisPartCountdown <= 0))
		return null

	return (
		<>
			{props.label}
			<span role="timer">
				{props.useWallClock ? (
					<Moment
						interval={0}
						format="HH:mm:ss"
						date={
							props.playlist.activationId
								? // if show is activated, count from the current time
									thisPartStartTime
								: // if show is not activated, count from the planned start or the current time, whichever is later
									Math.max((plannedStart ?? 0) + thisPartCountdown, thisPartStartTime)
						}
					/>
				) : (
					RundownUtils.formatTimeToShortTime(thisPartCountdown)
				)}
			</span>
		</>
	)
}
