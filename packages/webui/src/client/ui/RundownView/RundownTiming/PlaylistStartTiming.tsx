import React from 'react'
import { useTranslation } from 'react-i18next'
import Moment from 'react-moment'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { RundownUtils } from '../../../lib/rundown.js'
import { getCurrentTime } from '../../../lib/systemTime.js'
import ClassNames from 'classnames'
import { PlaylistTiming } from '@sofie-automation/corelib/dist/playout/rundownTiming'

interface IStartTimingProps {
	rundownPlaylist: DBRundownPlaylist
	hidePlannedStart?: boolean
	hideDiff?: boolean
	plannedStartText?: string
}

export function PlaylistStartTiming({
	rundownPlaylist,
	hidePlannedStart,
	hideDiff,
	plannedStartText,
}: IStartTimingProps): JSX.Element {
	const { t } = useTranslation()

	const playlistExpectedStart = PlaylistTiming.getExpectedStart(rundownPlaylist.timing)
	const playlistExpectedEnd = PlaylistTiming.getExpectedEnd(rundownPlaylist.timing)
	const playlistExpectedDuration = PlaylistTiming.getExpectedDuration(rundownPlaylist.timing)
	const expectedStart = playlistExpectedStart
		? playlistExpectedStart
		: playlistExpectedDuration && playlistExpectedEnd
			? playlistExpectedEnd - playlistExpectedDuration
			: undefined

	return (
		<React.Fragment>
			{!hidePlannedStart &&
				(rundownPlaylist.startedPlayback && rundownPlaylist.activationId && !rundownPlaylist.rehearsal ? (
					<span className="timing-clock plan-start left" role="timer">
						<span className="timing-clock-label left">{t('Started')}</span>
						<Moment interval={0} format="HH:mm:ss" date={rundownPlaylist.startedPlayback} />
					</span>
				) : playlistExpectedStart ? (
					<span className="timing-clock plan-start left" role="timer">
						<span className="timing-clock-label left">{plannedStartText || t('Planned Start')}</span>
						<Moment interval={0} format="HH:mm:ss" date={playlistExpectedStart} />
					</span>
				) : playlistExpectedEnd && playlistExpectedDuration ? (
					<span className="timing-clock plan-start left" role="timer">
						<span className="timing-clock-label left">{plannedStartText || t('Expected Start')}</span>
						<Moment interval={0} format="HH:mm:ss" date={playlistExpectedEnd - playlistExpectedDuration} />
					</span>
				) : null)}
			{!hideDiff && expectedStart && (
				<span
					className={ClassNames('timing-clock heavy-light left', {
						heavy: getCurrentTime() > expectedStart,
						light: getCurrentTime() <= expectedStart,
					})}
					role="timer"
				>
					<span className="timing-clock-label">{t('Diff')}</span>
					{rundownPlaylist.startedPlayback
						? RundownUtils.formatDiffToTimecode(
								rundownPlaylist.startedPlayback - expectedStart,
								true,
								false,
								true,
								true,
								true
							)
						: RundownUtils.formatDiffToTimecode(getCurrentTime() - expectedStart, true, false, true, true, true)}
				</span>
			)}
		</React.Fragment>
	)
}
