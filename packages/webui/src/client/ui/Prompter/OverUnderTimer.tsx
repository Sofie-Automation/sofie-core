import * as React from 'react'
import { useTiming } from '../RundownView/RundownTiming/withTiming.js'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { RundownUtils } from '../../lib/rundown.js'
import ClassNames from 'classnames'
import { getPlaylistTimingDiff } from '../../lib/rundownTiming.js'

interface IProps {
	rundownPlaylist: DBRundownPlaylist
	style?: React.CSSProperties | undefined
}

/**
 * Shows an over/under timer for the rundownPlaylist. Requires a RundownTimingContext from the RundownTimingProvider
 */
export function OverUnderTimer({ rundownPlaylist, style }: IProps): JSX.Element {
	const timingDurations = useTiming()

	const overUnderClock = getPlaylistTimingDiff(rundownPlaylist, timingDurations) ?? 0

	return (
		<span
			style={style}
			className={ClassNames('prompter-timing-clock heavy-light', {
				light: Math.floor(overUnderClock / 1000) < 0,
				heavy: Math.floor(overUnderClock / 1000) >= 0,
			})}
		>
			{RundownUtils.formatDiffToTimecode(overUnderClock, true, false, true, true, true, undefined, true, true)}
		</span>
	)
}
