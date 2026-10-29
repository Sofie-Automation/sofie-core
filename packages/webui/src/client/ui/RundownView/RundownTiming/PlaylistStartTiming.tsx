import React from 'react'
import { useTranslation } from 'react-i18next'
import Moment from 'react-moment'
import type { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist/RundownPlaylist'
import { RundownUtils } from '../../../lib/rundown.js'
import ClassNames from 'classnames'
import { TimerValueMode, usePlaylistTimingValue, useTimingNow } from './usePlaylistTimingValue.js'

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

	// The published planned start already applies the `expectedEnd - expectedDuration` derivation
	// for the timing types where that is how a start is arrived at
	const expectedStart = usePlaylistTimingValue(rundownPlaylist._id, 'plannedStart', TimerValueMode.Timestamp)
	const now = useTimingNow()

	return (
		<React.Fragment>
			{!hidePlannedStart &&
				(rundownPlaylist.startedPlayback && rundownPlaylist.activationId && !rundownPlaylist.rehearsal ? (
					<span className="timing-clock plan-start left" role="timer">
						<span className="timing-clock-label left">{t('Started')}</span>
						<Moment interval={0} format="HH:mm:ss" date={rundownPlaylist.startedPlayback} />
					</span>
				) : expectedStart !== null ? (
					<span className="timing-clock plan-start left" role="timer">
						<span className="timing-clock-label left">{plannedStartText || t('Planned Start')}</span>
						<Moment interval={0} format="HH:mm:ss" date={expectedStart} />
					</span>
				) : null)}
			{!hideDiff && expectedStart !== null && (
				<span
					className={ClassNames('timing-clock heavy-light left', {
						heavy: now > expectedStart,
						light: now <= expectedStart,
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
						: RundownUtils.formatDiffToTimecode(now - expectedStart, true, false, true, true, true)}
				</span>
			)}
		</React.Fragment>
	)
}
