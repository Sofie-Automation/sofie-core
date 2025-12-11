import { ReactNode } from 'react'
import Moment from 'react-moment'
import { useTiming } from './withTiming.js'
import { unprotectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import { RundownUtils } from '../../../lib/rundown.js'
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
 */
export function PartCountdown(props: IPartCountdownProps): JSX.Element | null {
	const timingDurations = useTiming()

	if (!props.partId || !timingDurations?.partCountdown) return null
	const thisPartCountdown: number | undefined =
		timingDurations.partCountdown[unprotectString(props.partId)] ?? undefined

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
										(timingDurations.currentTime ?? 0)
									: // if show is not activated, use expectedStart or currentTime, whichever is later
										Math.max(
											PlaylistTiming.getExpectedStart(props.playlist.timing) ?? 0,
											timingDurations.currentTime ?? 0
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
}
