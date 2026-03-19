import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import ClassNames from 'classnames'
import { NavLink } from 'react-router-dom'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { Rundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { RundownLayoutRundownHeader } from '@sofie-automation/meteor-lib/dist/collections/RundownLayouts'
import { DBShowStyleVariant } from '@sofie-automation/corelib/dist/dataModel/ShowStyleVariant'
import { RundownId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import Navbar from 'react-bootstrap/Navbar'
import { RundownContextMenu, RundownHeaderContextMenuTrigger, RundownHamburgerButton } from './RundownContextMenu'
import { TimeOfDay } from '../RundownTiming/TimeOfDay'
import { RundownHeaderPartRemaining, RundownHeaderSegmentBudget } from '../RundownHeader/CurrentPartOrSegmentRemaining'
import { RundownHeaderTimers } from './RundownHeaderTimers'

import { PlaylistTiming } from '@sofie-automation/corelib/dist/playout/rundownTiming'
import { useTiming } from '../RundownTiming/withTiming'
import { RundownHeaderTimingDisplay } from './RundownHeaderTimingDisplay'
import { RundownHeaderPlannedStart } from './RundownHeaderPlannedStart'
import { RundownHeaderDurations } from './RundownHeaderDurations'
import { RundownHeaderExpectedEnd } from './RundownHeaderExpectedEnd'
import { HeaderFreezeFrameIcon } from './HeaderFreezeFrameIcon'
import './RundownHeader.scss'
import { UIShowStyleBase } from '@sofie-automation/corelib/src/dataModel/ShowStyleBase'
import { UIStudio } from '@sofie-automation/corelib/src/dataModel/Studio'

interface IRundownHeaderProps {
	playlist: DBRundownPlaylist
	showStyleBase: UIShowStyleBase
	showStyleVariant: DBShowStyleVariant
	currentRundown: Rundown | undefined
	studio: UIStudio
	rundownIds: RundownId[]
	firstRundown: Rundown | undefined
	rundownCount: number
	onActivate?: (isRehearsal: boolean) => void
	inActiveRundownView?: boolean
	layout: RundownLayoutRundownHeader | undefined
}

export function RundownHeader({
	playlist,
	studio,
	firstRundown,
	currentRundown,
	rundownCount,
}: IRundownHeaderProps): JSX.Element {
	const { t } = useTranslation()
	const timingDurations = useTiming()
	const [simplified, setSimplified] = useState(false)
	const [isMenuOpen, setIsMenuOpen] = useState(false)
	const [isContextMenuOpen, setIsContextMenuOpen] = useState(false)

	const expectedStart = PlaylistTiming.getExpectedStart(playlist.timing)
	const expectedEnd = PlaylistTiming.getExpectedEnd(playlist.timing)

	// const expectedDuration = PlaylistTiming.getExpectedDuration(playlist.timing)
	// @todo: this _should_ use PlaylistTiming.getExpectedDuration as show above,
	// but I don't dare changing its behaviour to return for PlaylistTimingType.None within the scope of this task
	// same issue in RundownHeaderDuration.tsx
	const expectedDuration = playlist.timing.expectedDuration

	const hasSimple = !!(expectedStart || expectedDuration || expectedEnd)

	// Fallback duration for untimed playlists
	const fallbackDuration = PlaylistTiming.isPlaylistTimingNone(playlist.timing)
		? Object.values<number>(timingDurations.partExpectedDurations || {}).reduce((a, b) => a + b, 0)
		: undefined

	const hasAdvanced = !!(
		playlist.startedPlayback ||
		expectedStart ||
		timingDurations.remainingPlaylistDuration ||
		fallbackDuration
	)

	const canToggle = simplified ? hasAdvanced : hasSimple
	const toggleSimplified = useCallback(() => {
		if (canToggle) {
			setSimplified((s) => !s)
		}
	}, [canToggle])

	const onMenuClose = useCallback(() => setIsMenuOpen(false), [setIsMenuOpen])

	return (
		<>
			<RundownContextMenu
				playlist={playlist}
				studio={studio}
				firstRundown={firstRundown}
				onShow={() => setIsContextMenuOpen(true)}
				onHide={() => {
					setIsMenuOpen(false)
					setIsContextMenuOpen(false)
				}}
			/>
			<Navbar
				data-bs-theme="dark"
				fixed="top"
				expand
				className={ClassNames('rundown-header', {
					active: !!playlist.activationId,
					'not-active': !playlist.activationId,
					rehearsal: playlist.rehearsal,
				})}
			>
				<RundownHeaderContextMenuTrigger>
					<div className="rundown-header__content">
						<div className="rundown-header__left">
							<RundownHamburgerButton
								isOpen={isMenuOpen}
								disabled={isContextMenuOpen && !isMenuOpen}
								onOpen={() => setIsMenuOpen(true)}
								onClose={onMenuClose}
							/>
							<div className="rundown-header__left-context-menu-wrapper">
								{playlist.currentPartInfo && (
									<div className="rundown-header__onair">
										<RundownHeaderSegmentBudget
											currentPartInstanceId={playlist.currentPartInfo.partInstanceId}
											label={t('Seg. Budg.')}
										/>
										<span className="rundown-header__timers-onair-remaining">
											<span className="rundown-header__timers-onair-remaining__label">{t('On Air')}</span>
											<RundownHeaderPartRemaining
												currentPartInstanceId={playlist.currentPartInfo.partInstanceId}
												heavyClassName="overtime"
											/>
											<HeaderFreezeFrameIcon partInstanceId={playlist.currentPartInfo.partInstanceId} />
										</span>
									</div>
								)}
								<RundownHeaderTimers tTimers={playlist.tTimers} />
							</div>
						</div>

						<div className="rundown-header__clocks">
							<div className="rundown-header__clocks-clock-group">
								<div className="rundown-header__clocks-top-row">
									<RundownHeaderTimingDisplay playlist={playlist} />
									<TimeOfDay className="rundown-header__clocks-time-now" />
								</div>
								<div className="rundown-header__clocks-playlist-name">
									{rundownCount > 1 ? (
										<span className="playlist-name">{playlist.name}</span>
									) : (
										<span className="rundown-name">{(currentRundown ?? firstRundown)?.name}</span>
									)}
								</div>
							</div>
						</div>

						<div className="rundown-header__right">
							<button
								className={ClassNames('rundown-header__show-timers', {
									'rundown-header__show-timers--simplified': simplified,
									'rundown-header__show-timers--disabled': !canToggle,
								})}
								type="button"
								onClick={toggleSimplified}
							>
								<RundownHeaderPlannedStart playlist={playlist} simplified={simplified} />
								<RundownHeaderDurations playlist={playlist} simplified={simplified} />
								<RundownHeaderExpectedEnd playlist={playlist} simplified={simplified} />
							</button>
							<NavLink to="/" title={t('Exit')} className="rundown-header__close-btn">
								<FontAwesomeIcon icon="close" size="xl" />
							</NavLink>
						</div>
					</div>
				</RundownHeaderContextMenuTrigger>
			</Navbar>
		</>
	)
}
