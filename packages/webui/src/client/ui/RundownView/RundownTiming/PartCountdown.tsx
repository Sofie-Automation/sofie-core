import { ReactNode } from 'react'
import Moment from 'react-moment'
import { withTiming, WithTiming } from './withTiming'
import { unprotectString } from '../../../lib/tempLib'
import { RundownUtils } from '../../../lib/rundown'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { PlaylistTiming } from '@sofie-automation/corelib/dist/playout/rundownTiming'
import { PartId } from '@sofie-automation/corelib/dist/dataModel/Ids'

interface IPartCountdownProps {
	partId?: PartId
	hideOnZero?: boolean
	label?: ReactNode
	useWallClock?: boolean
	playlist: DBRundownPlaylist
}

/**
 * A presentational component that will render a countdown to a given Part
 * @function PartCountdown
 * @extends React.Component<WithTiming<IPartCountdownProps>>
 */
export const PartCountdown = withTiming<IPartCountdownProps, {}>()(function PartCountdown(
	props: WithTiming<IPartCountdownProps>
) {
	if (!props.partId || !props.timingDurations?.partCountdown) return null
	const thisPartCountdown: number | undefined =
		props.timingDurations.partCountdown[unprotectString(props.partId)] ?? undefined

	if (thisPartCountdown !== undefined && (props.hideOnZero !== true || thisPartCountdown > 0)) {
		return (
			<>
				{props.label}
				<span role="timer">
					{props.useWallClock ? (
						<Moment
							interval={0}
							format="HH:mm:ss"
							date={
								(props.playlist.activationId
									? // if show is activated, use currentTime as base
									  props.timingDurations.currentTime ?? 0
									: // if show is not activated, use expectedStart or currentTime, whichever is later
									  Math.max(
											PlaylistTiming.getExpectedStart(props.playlist.timing) ?? 0,
											props.timingDurations.currentTime ?? 0
									  )) + (thisPartCountdown || 0)
							}
						/>
					) : (
						RundownUtils.formatTimeToShortTime(
							thisPartCountdown // shouldShow will be false if thisPartCountdown is undefined
						)
					)}
				</span>
			</>
		)
	} else {
		return null
	}
})
