import type { CSSProperties } from 'react'
import classNames from 'classnames'
import { RundownUtils } from '../rundown.js'
import './OverUnderChip.scss'
import { TimerValueMode, usePlaylistTimingValue } from '../../ui/RundownView/RundownTiming/usePlaylistTimingValue.js'
import type { DBRundownPlaylist } from '@sofie-automation/corelib/src/dataModel/RundownPlaylist/RundownPlaylist.js'

export type OverUnderChipFormat = 'playlistDiff' | 'timerPostfix'

type OverUnderChipBaseProps = {
	className?: string
	style?: CSSProperties
	format?: OverUnderChipFormat
}

type OverUnderChipValueProps =
	| {
			valueMs: number | undefined
			rundownPlaylist?: never
	  }
	| {
			valueMs?: never
			rundownPlaylist: DBRundownPlaylist
	  }

type OverUnderChipInnerProps = OverUnderChipBaseProps & { valueMs: number | undefined }

/**
 * Over/under "chip" display.
 * Can either take a direct `valueMs` or a `rundownPlaylist` (requires RundownTiming context).
 */
export function OverUnderChip(props: Readonly<OverUnderChipBaseProps & OverUnderChipValueProps>): JSX.Element | null {
	if ('valueMs' in props) {
		return <OverUnderChipInner {...props} valueMs={props.valueMs} />
	} else {
		return <OverUnderChipFromPlaylist {...props} rundownPlaylist={props.rundownPlaylist} />
	}
}

function OverUnderChipFromPlaylist(
	props: Readonly<OverUnderChipBaseProps & { rundownPlaylist: DBRundownPlaylist }>
): JSX.Element | null {
	const timeInHand = usePlaylistTimingValue(props.rundownPlaylist._id, 'overUnder', TimerValueMode.Duration)
	// the published value is the time in hand; this display is over-positive
	const valueMs = timeInHand === null ? undefined : 0 - timeInHand
	return <OverUnderChipInner {...props} valueMs={valueMs} />
}

function OverUnderChipInner({ valueMs, format = 'playlistDiff', className, style }: Readonly<OverUnderChipInnerProps>) {
	if (valueMs === undefined) return null

	const isUnder = valueMs <= 0
	const timeStr = (() => {
		switch (format) {
			case 'timerPostfix':
				return RundownUtils.formatDiffToTimecode(Math.abs(valueMs), false, false, true, false, true)
			case 'playlistDiff':
			default:
				// late: the time past the plan rounds down, as a time since does, so a moment late shows +00:00;
				// early: the time in hand rounds up, and under 0.1 s it shows 00:00
				return valueMs > 0
					? RundownUtils.formatDiffToTimecode(valueMs, false, false, true, false, true, undefined, true)
					: RundownUtils.formatDiffToTimecode(Math.abs(valueMs), false, false, true, true, true)
		}
	})()

	return (
		<span
			className={classNames('over-under-chip', isUnder ? 'over-under-chip--under' : 'over-under-chip--over', className)}
			style={style}
		>
			{isUnder ? '−' : '+'}
			{timeStr}
		</span>
	)
}
