import type { Rundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import Moment from 'react-moment'
import { useClockValue } from './RundownTiming/usePlaylistTimingValue.js'
import { RundownUtils } from '../../lib/rundown.js'
import { useTranslation } from 'react-i18next'
import type { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist/RundownPlaylist'
import { PlaylistTiming } from '@sofie-automation/corelib/dist/playout/rundownTiming'

interface IProps {
	rundown: Pick<Rundown, '_id' | 'name' | 'timing'>
	playlist: DBRundownPlaylist
}

const QUATER_DAY = 6 * 60 * 60 * 1000

interface MarkerCountdownProps {
	markerTimestamp: number | undefined
	className?: string | undefined
}

/**
 * This is a countdown to the rundown's Expected Start or Expected End time. It shows nothing if the expectedStart is undefined
 * or the time to Expected Start/End from now is larger than 6 hours.
 */
export function MarkerCountdownText(props: MarkerCountdownProps): JSX.Element | null {
	const { t } = useTranslation()

	const markerTimestamp = props.markerTimestamp
	// drawn again at the moment the countdown's own second changes
	const time = useClockValue(markerTimestamp === undefined ? undefined : (now) => markerTimestamp - now)

	if (time === null) return null

	if (time < QUATER_DAY) {
		return (
			<span className={props.className}>
				{time > 0
					? t('(in: {{time}})', {
							// the time left rounds up, also in its last 0.1 s
							time: RundownUtils.formatDiffToTimecode(time, false, true, true, false, true),
						})
					: t('({{time}} ago)', {
							// the time since rounds down, as a stopwatch does
							time: `\u2013${RundownUtils.formatDiffToTimecode(-time, false, true, false, false, true, undefined, true)}`,
						})}
			</span>
		)
	}
	return null
}

/**
 * This is a component for showing the title of the rundown, it's expectedStart and expectedDuration and
 * icons for the notifications it's segments have produced. The counters for the notifications are
 * produced by filtering the notifications in the Notification Center based on the source being the
 * rundownId or one of the segmentIds.
 *
 * The component should be minimally reactive.
 */
export function RundownDividerHeader({ rundown, playlist }: IProps): JSX.Element {
	const { t } = useTranslation()

	const expectedStart = PlaylistTiming.getExpectedStart(rundown.timing)
	const expectedDuration = PlaylistTiming.getExpectedDuration(rundown.timing)
	const expectedEnd = PlaylistTiming.getExpectedEnd(rundown.timing)
	return (
		<div className="rundown-divider-timeline">
			<h2 className="rundown-divider-timeline__title">{rundown.name}</h2>
			{rundown.name !== playlist.name && <h3 className="rundown-divider-timeline__playlist-name">{playlist.name}</h3>}
			{expectedStart ? (
				<div className="rundown-divider-timeline__expected-start">
					<span>{t('Planned Start')}</span>&nbsp;
					<Moment
						interval={1000}
						calendar={{
							sameElse: 'lll',
						}}
					>
						{expectedStart}
					</Moment>
					&nbsp;
					<MarkerCountdownText
						className="rundown-divider-timeline__expected-start__countdown"
						markerTimestamp={expectedStart}
					/>
				</div>
			) : null}
			{expectedDuration ? (
				<div className="rundown-divider-timeline__expected-duration">
					<span>{t('Planned Duration')}</span>&nbsp;
					{RundownUtils.formatDiffToTimecodeHours(expectedDuration)}
				</div>
			) : null}
			{expectedEnd ? (
				<div className="rundown-divider-timeline__expected-end">
					<span>{t('Planned End')}</span>&nbsp;
					<Moment
						interval={1000}
						calendar={{
							sameElse: 'lll',
						}}
					>
						{expectedEnd}
					</Moment>
					&nbsp;
					<MarkerCountdownText
						className="rundown-divider-timeline__expected-end__countdown"
						markerTimestamp={expectedEnd}
					/>
				</div>
			) : null}
		</div>
	)
}
