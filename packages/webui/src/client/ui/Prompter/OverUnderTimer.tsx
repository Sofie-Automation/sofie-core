import * as React from 'react'
import { withTiming, WithTiming } from '../RundownView/RundownTiming/withTiming'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { RundownUtils } from '../../lib/rundown'
import ClassNames from 'classnames'
import { getPlaylistTimingDiff } from '../../lib/rundownTiming'

interface IProps {
	rundownPlaylist: DBRundownPlaylist
	style?: React.CSSProperties | undefined
}

/**
 * Shows an over/under timer for the rundownPlaylist. Requires a RundownTimingContext from the RundownTimingProvider
 */
export const OverUnderTimer = withTiming<IProps, {}>()(function OverUnderTimer({
	rundownPlaylist,
	style,
	timingDurations,
}: WithTiming<IProps>) {
	const overUnderClock = getPlaylistTimingDiff(rundownPlaylist, timingDurations) ?? 0

	return (
		<span
			style={style}
			className={ClassNames('prompter-timing-clock heavy-light', {
				heavy: Math.floor(overUnderClock / 1000) < 0,
				light: Math.floor(overUnderClock / 1000) >= 0,
			})}
		>
			{RundownUtils.formatDiffToTimecode(overUnderClock, true, false, true, true, true, undefined, true, true)}
		</span>
	)
})
