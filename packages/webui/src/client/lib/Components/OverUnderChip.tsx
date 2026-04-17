import { type CSSProperties } from 'react'
import classNames from 'classnames'
import { RundownUtils } from '../rundown.js'
import './OverUnderChip.scss'
import { useTiming } from '../../ui/RundownView/RundownTiming/withTiming.js'
import { getPlaylistTimingDiff } from '../rundownTiming.js'
import { DBRundownPlaylist } from '@sofie-automation/corelib/src/dataModel/RundownPlaylist/RundownPlaylist.js'

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
	const timingDurations = useTiming()
	const valueMs = getPlaylistTimingDiff(props.rundownPlaylist, timingDurations)
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
				return RundownUtils.formatDiffToTimecode(Math.abs(valueMs), false, false, true, true, true)
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
