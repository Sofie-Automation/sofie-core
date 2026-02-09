import React, { useCallback, useContext, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import ClassNames from 'classnames'
import Escape from '../../../lib/Escape'
import Tooltip from 'rc-tooltip'
import { NavLink } from 'react-router-dom'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { Rundown, getRundownNrcsName } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { ContextMenu, MenuItem, ContextMenuTrigger } from '@jstarpl/react-contextmenu'
import { PieceUi } from '../../SegmentTimeline/SegmentTimelineContainer'
import { RundownSystemStatus } from '../RundownSystemStatus'
import { getHelpMode } from '../../../lib/localStorage'
import { reloadRundownPlaylistClick } from '../RundownNotifier'
import { useRundownViewEventBusListener } from '../../../lib/lib'
import { RundownLayoutRundownHeader } from '@sofie-automation/meteor-lib/dist/collections/RundownLayouts'
import { contextMenuHoldToDisplayTime } from '../../../lib/lib'
import {
	ActivateRundownPlaylistEvent,
	DeactivateRundownPlaylistEvent,
	IEventContext,
	RundownViewEvents,
} from '@sofie-automation/meteor-lib/dist/triggers/RundownViewEventBus'
import { RundownLayoutsAPI } from '../../../lib/rundownLayouts'
import { DBShowStyleVariant } from '@sofie-automation/corelib/dist/dataModel/ShowStyleVariant'
import { BucketAdLibItem } from '../../Shelf/RundownViewBuckets'
import { IAdLibListItem } from '../../Shelf/AdLibListItem'
import { ShelfDashboardLayout } from '../../Shelf/ShelfDashboardLayout'
import { UIStudio } from '@sofie-automation/meteor-lib/dist/api/studios'
import { RundownId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { UIShowStyleBase } from '@sofie-automation/meteor-lib/dist/api/showStyles'
import { UserPermissionsContext } from '../../UserPermissions'
import * as RundownResolver from '../../../lib/RundownResolver'
import Navbar from 'react-bootstrap/Navbar'
import { WarningDisplay } from '../WarningDisplay'
import { TimingDisplay } from './TimingDisplay'
import { checkRundownTimes, useRundownPlaylistOperations } from './useRundownPlaylistOperations'

interface IRundownHeaderProps {
	playlist: DBRundownPlaylist
	showStyleBase: UIShowStyleBase
	showStyleVariant: DBShowStyleVariant
	currentRundown: Rundown | undefined
	studio: UIStudio
	rundownIds: RundownId[]
	firstRundown: Rundown | undefined
	onActivate?: (isRehearsal: boolean) => void
	inActiveRundownView?: boolean
	layout: RundownLayoutRundownHeader | undefined
}

export function RundownHeader({
	playlist,
	showStyleBase,
	showStyleVariant,
	currentRundown,
	studio,
	rundownIds,
	firstRundown,
	inActiveRundownView,
	layout,
}: IRundownHeaderProps): JSX.Element {
	const { t } = useTranslation()

	const userPermissions = useContext(UserPermissionsContext)

	const [selectedPiece, setSelectedPiece] = useState<BucketAdLibItem | IAdLibListItem | PieceUi | undefined>(undefined)
	const [shouldQueueAdlibs, setShouldQueueAdlibs] = useState(false)

	const operations = useRundownPlaylistOperations()

	const eventActivate = useCallback(
		(e: ActivateRundownPlaylistEvent) => {
			if (e.rehearsal) {
				operations.activateRehearsal(e.context)
			} else {
				operations.activate(e.context)
			}
		},
		[operations]
	)
	const eventDeactivate = useCallback(
		(e: DeactivateRundownPlaylistEvent) => operations.deactivate(e.context),
		[operations]
	)
	const eventResync = useCallback((e: IEventContext) => operations.reloadRundownPlaylist(e.context), [operations])
	const eventTake = useCallback((e: IEventContext) => operations.take(e.context), [operations])
	const eventResetRundownPlaylist = useCallback((e: IEventContext) => operations.resetRundown(e.context), [operations])
	const eventCreateSnapshot = useCallback((e: IEventContext) => operations.takeRundownSnapshot(e.context), [operations])

	useRundownViewEventBusListener(RundownViewEvents.ACTIVATE_RUNDOWN_PLAYLIST, eventActivate)
	useRundownViewEventBusListener(RundownViewEvents.DEACTIVATE_RUNDOWN_PLAYLIST, eventDeactivate)
	useRundownViewEventBusListener(RundownViewEvents.RESYNC_RUNDOWN_PLAYLIST, eventResync)
	useRundownViewEventBusListener(RundownViewEvents.TAKE, eventTake)
	useRundownViewEventBusListener(RundownViewEvents.RESET_RUNDOWN_PLAYLIST, eventResetRundownPlaylist)
	useRundownViewEventBusListener(RundownViewEvents.CREATE_SNAPSHOT_FOR_DEBUG, eventCreateSnapshot)

	useEffect(() => {
		reloadRundownPlaylistClick.set(operations.reloadRundownPlaylist)
	}, [operations.reloadRundownPlaylist])

	const canClearQuickLoop =
		!!studio.settings.enableQuickLoop &&
		!RundownResolver.isLoopLocked(playlist) &&
		RundownResolver.isAnyLoopMarkerDefined(playlist)

	const rundownTimesInfo = checkRundownTimes(playlist.timing)

	return (
		<>
			<Escape to="document">
				<ContextMenu id="rundown-context-menu">
					<div className="react-contextmenu-label">{playlist && playlist.name}</div>
					{userPermissions.studio ? (
						<React.Fragment>
							{!(playlist.activationId && playlist.rehearsal) ? (
								!rundownTimesInfo.shouldHaveStarted && !playlist.activationId ? (
									<MenuItem onClick={operations.activateRehearsal}>
										{t('Prepare Studio and Activate (Rehearsal)')}
									</MenuItem>
								) : (
									<MenuItem onClick={operations.activateRehearsal}>{t('Activate (Rehearsal)')}</MenuItem>
								)
							) : (
								<MenuItem onClick={operations.activate}>{t('Activate (On-Air)')}</MenuItem>
							)}
							{rundownTimesInfo.willShortlyStart && !playlist.activationId && (
								<MenuItem onClick={operations.activate}>{t('Activate (On-Air)')}</MenuItem>
							)}
							{playlist.activationId ? <MenuItem onClick={operations.deactivate}>{t('Deactivate')}</MenuItem> : null}
							{studio.settings.allowAdlibTestingSegment && playlist.activationId ? (
								<MenuItem onClick={operations.activateAdlibTesting}>{t('AdLib Testing')}</MenuItem>
							) : null}
							{playlist.activationId ? <MenuItem onClick={operations.take}>{t('Take')}</MenuItem> : null}
							{studio.settings.allowHold && playlist.activationId ? (
								<MenuItem onClick={operations.hold}>{t('Hold')}</MenuItem>
							) : null}
							{playlist.activationId && canClearQuickLoop ? (
								<MenuItem onClick={operations.clearQuickLoop}>{t('Clear QuickLoop')}</MenuItem>
							) : null}
							{!(playlist.activationId && !playlist.rehearsal && !studio.settings.allowRundownResetOnAir) ? (
								<MenuItem onClick={operations.resetRundown}>{t('Reset Rundown')}</MenuItem>
							) : null}
							<MenuItem onClick={operations.reloadRundownPlaylist}>
								{t('Reload {{nrcsName}} Data', {
									nrcsName: getRundownNrcsName(firstRundown),
								})}
							</MenuItem>
							<MenuItem onClick={operations.takeRundownSnapshot}>{t('Store Snapshot')}</MenuItem>
						</React.Fragment>
					) : (
						<React.Fragment>
							<MenuItem>{t('No actions available')}</MenuItem>
						</React.Fragment>
					)}
				</ContextMenu>
			</Escape>
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
				<ContextMenuTrigger
					id="rundown-context-menu"
					attributes={{
						className: 'flex-col col-timing horizontal-align-center',
					}}
					holdToDisplay={contextMenuHoldToDisplayTime()}
				>
					<WarningDisplay
						studioMode={userPermissions.studio}
						inActiveRundownView={inActiveRundownView}
						playlist={playlist}
						oneMinuteBeforeAction={(e, noResetOnActivate) =>
							noResetOnActivate ? operations.activateRundown(e) : operations.resetAndActivateRundown(e)
						}
					/>
					<div className="header-row flex-row first-row super-dark">
						<div className="flex-col left horizontal-align-left">
							<div className="badge-sofie mt-4 mb-3 mx-4">
								<Tooltip
									overlay={t('Add ?studio=1 to the URL to enter studio mode')}
									visible={getHelpMode() && !userPermissions.studio}
									placement="bottom"
								>
									<div className="media-elem me-2 sofie-logo" />
								</Tooltip>
							</div>
						</div>
						{layout && RundownLayoutsAPI.isDashboardLayout(layout) ? (
							<ShelfDashboardLayout
								rundownLayout={layout}
								playlist={playlist}
								showStyleBase={showStyleBase}
								showStyleVariant={showStyleVariant}
								studio={studio}
								studioMode={userPermissions.studio}
								shouldQueue={shouldQueueAdlibs}
								onChangeQueueAdLib={setShouldQueueAdlibs}
								selectedPiece={selectedPiece}
								onSelectPiece={setSelectedPiece}
							/>
						) : (
							<>
								<TimingDisplay
									rundownPlaylist={playlist}
									currentRundown={currentRundown}
									rundownCount={rundownIds.length}
									layout={layout}
								/>
								<RundownSystemStatus studioId={studio._id} playlistId={playlist._id} firstRundown={firstRundown} />
							</>
						)}
						<div className="flex-col right horizontal-align-right">
							<div className="links close">
								<NavLink to="/rundowns" title={t('Exit')}>
									<FontAwesomeIcon icon="close" size="xl" />
								</NavLink>
							</div>
						</div>
					</div>
				</ContextMenuTrigger>
			</Navbar>
		</>
	)
}
