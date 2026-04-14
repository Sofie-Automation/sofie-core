import React from 'react'
import classNames from 'classnames'
import { RundownUtils } from '../../lib/rundown.js'
import { useTiming } from '../RundownView/RundownTiming/withTiming.js'
import { getPlaylistTimingDiff } from '../../lib/rundownTiming.js'
import { DBRundownPlaylist } from '@sofie-automation/corelib/src/dataModel/RundownPlaylist/RundownPlaylist.js'

type OverUnderTimerBaseProps = {
	/** Optional wrapper around the badge, useful for screens that style via container font-size (eg. director). */
	containerClassName?: string
	className?: string
	style?: React.CSSProperties
}

type OverUnderTimerValueProps =
	| {
			valueMs: number | undefined
			rundownPlaylist?: never
	  }
	| {
			valueMs?: never
			rundownPlaylist: DBRundownPlaylist
	  }

type OverUnderTimerInnerProps = OverUnderTimerBaseProps & { valueMs: number | undefined }

/**
 * Over/under "pill" timer.
 * Can either take a direct `valueMs` or a `rundownPlaylist` (requires RundownTiming context).
 */
export function OverUnderTimer(
	props: Readonly<OverUnderTimerBaseProps & OverUnderTimerValueProps>
): JSX.Element | null {
	if ('valueMs' in props) {
		return <OverUnderTimerInner {...props} valueMs={props.valueMs} />
	} else {
		return <OverUnderTimerFromPlaylist {...props} rundownPlaylist={props.rundownPlaylist} />
	}
}

function OverUnderTimerFromPlaylist(
	props: Readonly<OverUnderTimerBaseProps & { rundownPlaylist: DBRundownPlaylist }>
): JSX.Element | null {
	const timingDurations = useTiming()
	const valueMs = getPlaylistTimingDiff(props.rundownPlaylist, timingDurations) ?? 0
	return <OverUnderTimerInner {...props} valueMs={valueMs} />
}

function OverUnderTimerInner(props: Readonly<OverUnderTimerInnerProps>): JSX.Element | null {
	const valueMs = props.valueMs
	if (valueMs === undefined) return null

	const isOver = valueMs > 0

	const badge = (
		<span
			style={props.style}
			className={classNames(
				'over-under-timer',
				{
					'over-under-timer--over': isOver,
					'over-under-timer--under': !isOver,
				},
				props.className
			)}
		>
			{isOver ? '+' : '\u2013'}
			{RundownUtils.formatDiffToTimecode(Math.abs(valueMs), false, true, true, false, true)}
		</span>
	)

	return props.containerClassName ? <div className={props.containerClassName}>{badge}</div> : badge
}
