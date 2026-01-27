import { Rundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { DBRundownPlaylist, RundownHoldState } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { PlaylistTiming } from '@sofie-automation/corelib/dist/playout/rundownTiming'
import { RundownLayoutRundownHeader } from '@sofie-automation/meteor-lib/dist/collections/RundownLayouts'
import { useTranslation } from 'react-i18next'
import * as RundownResolver from '../../../lib/RundownResolver.js'
import { AutoNextStatus } from '../RundownTiming/AutoNextStatus.js'
import { CurrentPartOrSegmentRemaining } from '../RundownTiming/CurrentPartOrSegmentRemaining.js'
import { NextBreakTiming } from '../RundownTiming/NextBreakTiming.js'
import { PlaylistEndTiming } from '../RundownTiming/PlaylistEndTiming.js'
import { PlaylistStartTiming } from '../RundownTiming/PlaylistStartTiming.js'
import { RundownName } from '../RundownTiming/RundownName.js'
import { TimeOfDay } from '../RundownTiming/TimeOfDay.js'
import { useTiming } from '../RundownTiming/withTiming.js'

interface ITimingDisplayProps {
	rundownPlaylist: DBRundownPlaylist
	currentRundown: Rundown | undefined
	rundownCount: number
	layout: RundownLayoutRundownHeader | undefined
}
export function TimingDisplay({
	rundownPlaylist,
	currentRundown,
	rundownCount,
	layout,
}: ITimingDisplayProps): JSX.Element | null {
	const { t } = useTranslation()

	const timingDurations = useTiming()

	if (!rundownPlaylist) return null

	const expectedStart = PlaylistTiming.getExpectedStart(rundownPlaylist.timing)
	const expectedEnd = PlaylistTiming.getExpectedEnd(rundownPlaylist.timing)
	const expectedDuration = PlaylistTiming.getExpectedDuration(rundownPlaylist.timing)
	const showEndTiming =
		!timingDurations.rundownsBeforeNextBreak ||
		!layout?.showNextBreakTiming ||
		(timingDurations.rundownsBeforeNextBreak.length > 0 &&
			(!layout?.hideExpectedEndBeforeBreak || (timingDurations.breakIsLastRundown && layout?.lastRundownIsNotBreak)))
	const showNextBreakTiming =
		rundownPlaylist.startedPlayback &&
		timingDurations.rundownsBeforeNextBreak?.length &&
		layout?.showNextBreakTiming &&
		!(timingDurations.breakIsLastRundown && layout.lastRundownIsNotBreak)

	return (
		<div className="timing">
			<div className="timing__header__left">
				<PlaylistStartTiming rundownPlaylist={rundownPlaylist} hideDiff={true} />
				<RundownName rundownPlaylist={rundownPlaylist} currentRundown={currentRundown} rundownCount={rundownCount} />
			</div>
			<div className="timing__header__center">
				<TimeOfDay />
			</div>
			<div className="timing__header__right">
				<div className="timing__header__right__left">
					{rundownPlaylist.currentPartInfo && (
						<span className="timing-clock current-remaining">
							<CurrentPartOrSegmentRemaining
								currentPartInstanceId={rundownPlaylist.currentPartInfo.partInstanceId}
								heavyClassName="overtime"
								preferSegmentTime={true}
							/>
							<AutoNextStatus />
							{rundownPlaylist.holdState && rundownPlaylist.holdState !== RundownHoldState.COMPLETE ? (
								<div className="rundown__header-status rundown__header-status--hold">{t('Hold')}</div>
							) : null}
						</span>
					)}
				</div>
				<div className="timing__header__right__right">
					{showNextBreakTiming ? (
						<NextBreakTiming
							rundownsBeforeBreak={timingDurations.rundownsBeforeNextBreak!}
							breakText={layout?.nextBreakText}
							lastChild={!showEndTiming}
						/>
					) : null}
					{showEndTiming ? (
						<PlaylistEndTiming
							rundownPlaylist={rundownPlaylist}
							loop={RundownResolver.isLoopRunning(rundownPlaylist)}
							expectedStart={expectedStart}
							expectedEnd={expectedEnd}
							expectedDuration={expectedDuration}
							endLabel={layout?.plannedEndText}
						/>
					) : null}
				</div>
			</div>
		</div>
	)
}
