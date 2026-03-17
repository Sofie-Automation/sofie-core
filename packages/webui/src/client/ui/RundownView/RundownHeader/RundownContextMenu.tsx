import React, { useCallback, useContext, useEffect, useRef } from 'react'
import { useHistory } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Escape from '../../../lib/Escape'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { Rundown, getRundownNrcsName } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { ContextMenu, MenuItem, ContextMenuTrigger, hideMenu, showMenu } from '@jstarpl/react-contextmenu'
import { contextMenuHoldToDisplayTime, useRundownViewEventBusListener } from '../../../lib/lib'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBars, faTimes } from '@fortawesome/free-solid-svg-icons'
import {
	ActivateRundownPlaylistEvent,
	DeactivateRundownPlaylistEvent,
	IEventContext,
	RundownViewEvents,
} from '@sofie-automation/meteor-lib/dist/triggers/RundownViewEventBus'
import { UIStudio } from '@sofie-automation/meteor-lib/dist/api/studios'
import { UserPermissionsContext } from '../../UserPermissions'
import * as RundownResolver from '../../../lib/RundownResolver'
import { checkRundownTimes, useRundownPlaylistOperations } from './useRundownPlaylistOperations.js'
import { reloadRundownPlaylistClick } from '../RundownNotifier'

export const RUNDOWN_CONTEXT_MENU_ID = 'rundown-context-menu'

interface RundownContextMenuProps {
	playlist: DBRundownPlaylist
	studio: UIStudio
	firstRundown: Rundown | undefined
	onShow?: () => void
	onHide?: () => void
}

/**
 * The RundownContextMenu component renders both the context menu definition and the right-click
 * trigger area. It also registers event bus listeners for playlist operations (activate,
 * deactivate, take, reset, etc.) since these are tightly coupled to the menu actions.
 */
export function RundownContextMenu({
	playlist,
	studio,
	firstRundown,
	onShow,
	onHide,
}: Readonly<RundownContextMenuProps>): JSX.Element {
	const { t } = useTranslation()
	const history = useHistory()
	const userPermissions = useContext(UserPermissionsContext)
	const operations = useRundownPlaylistOperations()

	const canClearQuickLoop =
		!!studio.settings.enableQuickLoop &&
		!RundownResolver.isLoopLocked(playlist) &&
		RundownResolver.isAnyLoopMarkerDefined(playlist)

	const rundownTimesInfo = checkRundownTimes(playlist.timing)

	// --- Event bus listeners for playlist operations ---
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

	return (
		<Escape to="document">
			<ContextMenu id={RUNDOWN_CONTEXT_MENU_ID} onShow={onShow} onHide={onHide}>
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
							<MenuItem onClick={operations.activate}>{t('Activate On Air')}</MenuItem>
						)}
						{rundownTimesInfo.willShortlyStart && !playlist.activationId && (
							<MenuItem onClick={operations.activate}>{t('Activate On Air')}</MenuItem>
						)}
						{playlist.activationId ? (
							<MenuItem onClick={operations.deactivate}>{t('Deactivate Studio')}</MenuItem>
						) : null}
						{studio.settings.allowAdlibTestingSegment && playlist.activationId ? (
							<MenuItem onClick={operations.activateAdlibTesting}>{t('AdLib Testing')}</MenuItem>
						) : null}
						{playlist.activationId ? (
							<>
								<MenuItem divider />
								<MenuItem onClick={operations.take}>{t('Take')}</MenuItem>
							</>
						) : null}
						{studio.settings.allowHold && playlist.activationId ? (
							<MenuItem onClick={operations.hold}>{t('Hold')}</MenuItem>
						) : null}
						{playlist.activationId && canClearQuickLoop ? (
							<MenuItem onClick={operations.clearQuickLoop}>{t('Clear QuickLoop')}</MenuItem>
						) : null}
						{!(playlist.activationId && !playlist.rehearsal && !studio.settings.allowRundownResetOnAir) ? (
							<>
								<MenuItem divider />
								<MenuItem onClick={operations.resetRundown}>{t('Reset Rundown')}</MenuItem>
							</>
						) : null}
						<MenuItem onClick={operations.reloadRundownPlaylist}>
							{t('Reload {{nrcsName}} Data', {
								nrcsName: getRundownNrcsName(firstRundown),
							})}
						</MenuItem>
						<MenuItem onClick={operations.takeRundownSnapshot}>{t('Store Snapshot')}</MenuItem>
						<MenuItem divider />
						<MenuItem onClick={() => history.push('/')}>{t('Close Rundown')}</MenuItem>
					</React.Fragment>
				) : (
					<React.Fragment>
						<MenuItem>{t('No actions available')}</MenuItem>
					</React.Fragment>
				)}
			</ContextMenu>
		</Escape>
	)
}

interface RundownContextMenuTriggerProps {
	children: React.ReactNode
}

export function RundownHeaderContextMenuTrigger({ children }: Readonly<RundownContextMenuTriggerProps>): JSX.Element {
	return (
		<ContextMenuTrigger
			id={RUNDOWN_CONTEXT_MENU_ID}
			attributes={{
				className: 'rundown-header__trigger',
			}}
			holdToDisplay={contextMenuHoldToDisplayTime()}
		>
			{children}
		</ContextMenuTrigger>
	)
}

/**
 * A hamburger button that opens the context menu on left-click.
 */
export function RundownHamburgerButton({
	isOpen,
	disabled,
	onClose,
	onOpen,
}: Readonly<{ isOpen?: boolean; disabled?: boolean; onClose: () => void; onOpen?: () => void }>): JSX.Element {
	const { t } = useTranslation()
	const buttonRef = useRef<HTMLButtonElement | null>(null)

	const handleToggle = useCallback(
		(e: React.MouseEvent) => {
			e.preventDefault()
			e.stopPropagation()

			if (disabled) return

			if (isOpen) {
				hideMenu({ id: RUNDOWN_CONTEXT_MENU_ID })
				onClose()
				return
			}

			if (buttonRef.current) {
				const rect = buttonRef.current.getBoundingClientRect()
				showMenu({
					position: { x: rect.left, y: rect.bottom + 5 },
					id: RUNDOWN_CONTEXT_MENU_ID,
				})
				if (onOpen) onOpen()
			}
		},
		[isOpen, disabled, onClose, onOpen]
	)

	return (
		<button
			ref={buttonRef}
			className={`rundown-header__menu-btn ${isOpen ? 'active' : ''} ${disabled ? 'disabled' : ''}`}
			disabled={disabled}
			onMouseDown={handleToggle}
			onClick={(e) => {
				// Prevent double trigger if browser emits both mousedown and click
				e.preventDefault()
				e.stopPropagation()
			}}
			title={t('Menu')}
		>
			<FontAwesomeIcon icon={isOpen ? faTimes : faBars} fixedWidth />
		</button>
	)
}
