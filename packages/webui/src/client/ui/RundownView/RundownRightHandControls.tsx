import React, { useEffect, useState } from 'react'
import { AnimatePresence } from 'motion/react'
import {
	StudioRouteSet,
	StudioRouteBehavior,
	StudioRouteSetExclusivityGroup,
} from '@sofie-automation/corelib/dist/dataModel/Studio'
import { RewindAllSegmentsIcon } from '../../lib/ui/icons/rewindAllSegmentsIcon.js'

import { Lottie } from '@crello/react-lottie'
import { NotificationCenterPanelToggle } from '../../lib/notifications/NotificationCenterPanel.js'

import * as On_Air_MouseOut from './On_Air_MouseOut.json'
import * as On_Air_MouseOver from './On_Air_MouseOver.json'
import { SupportPopUpToggle } from '../SupportPopUp.js'
import classNames from 'classnames'
import { NoticeLevel } from '../../lib/notifications/notifications.js'
import { SwitchboardIcon, RouteSetOverrideIcon } from '../../lib/ui/icons/switchboard.js'
import { SwitchboardPopUp } from './SwitchboardPopUp.js'
import { useTranslation } from 'react-i18next'
import { SegmentViewMode } from '../../lib/ui/icons/listView.js'
import { RundownPlaylistId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { MediaStatusPopUp } from './MediaStatusPopUp/index.js'
import { MediaStatusIcon } from '../../lib/ui/icons/mediaStatus.js'
import { SelectedElementsContext } from './SelectedElementsContext.js'
import { UserEditsCloseIcon, UserEditsIcon } from '../../lib/ui/icons/useredits.js'
import { RundownRightHandButton } from './RundownRightHandButton.js'

interface IProps {
	playlistId: RundownPlaylistId
	studioRouteSets: {
		[id: string]: StudioRouteSet
	}
	studioRouteSetExclusivityGroups: {
		[id: string]: StudioRouteSetExclusivityGroup
	}
	isFollowingOnAir: boolean
	onFollowOnAir?: () => void
	onRewindSegments?: () => void
	isNotificationCenterOpen: NoticeLevel | undefined
	isSupportPanelOpen: boolean
	isStudioMode: boolean
	isUserEditsEnabled: boolean
	onToggleNotifications?: (e: React.MouseEvent<HTMLButtonElement>, filter: NoticeLevel) => void
	onToggleSupportPanel?: (e: React.MouseEvent<HTMLButtonElement>) => void
	onTake?: (e: React.MouseEvent<HTMLButtonElement>) => void
	onStudioRouteSetSwitch?: (
		e: React.ChangeEvent<HTMLElement>,
		routeSetId: string,
		routeSet: StudioRouteSet,
		state: boolean
	) => void
	onSegmentViewMode?: (e: React.MouseEvent<HTMLButtonElement>) => void
	hideRundownHeader?: boolean
}

const ANIMATION_TEMPLATE = {
	loop: false,
	autoplay: true,
	animationData: {},
	rendererSettings: {
		preserveAspectRatio: 'xMidYMid meet',
	},
}

const ONAIR_OUT = {
	...ANIMATION_TEMPLATE,
	animationData: On_Air_MouseOut,
}
const ONAIR_OVER = {
	...ANIMATION_TEMPLATE,
	animationData: On_Air_MouseOver,
}

export function RundownRightHandControls(props: Readonly<IProps>): JSX.Element {
	const { t } = useTranslation()
	const [onAirHover, setOnAirHover] = useState(false)
	const [switchboardOpen, setSwitchboardOpen] = useState(false)
	const [mediaStatusOpen, setMediaStatusOpen] = useState(false)

	const {
		onFollowOnAir: onOnAirClick,
		onRewindSegments: onRewindClick,
		onTake: onTakeClick,
		onSegmentViewMode: onSegmentViewModeClick,
	} = props

	useEffect(() => {
		if (onAirHover && props.isFollowingOnAir) {
			setOnAirHover(false)
		}
	}, [props.isFollowingOnAir, onAirHover])

	const onOnAirMouseEnter = () => {
		setOnAirHover(true)
	}

	const onOnAirMouseLeave = () => {
		setOnAirHover(false)
	}

	const onRouteSetsToggle = (_e: React.MouseEvent<HTMLButtonElement>) => {
		setSwitchboardOpen(!switchboardOpen)
		setMediaStatusOpen(false)
	}

	const onMediaStatusToggle = (_e: React.MouseEvent<HTMLButtonElement>) => {
		setMediaStatusOpen(!mediaStatusOpen)
		setSwitchboardOpen(false)
	}

	const availableRouteSets = Object.entries<StudioRouteSet>(props.studioRouteSets)
		.filter(([_id, routeSet]) => routeSet.behavior !== StudioRouteBehavior.HIDDEN)
		.sort((a, b) => {
			if (a[1].name < b[1].name) return -1
			if (a[1].name > b[1].name) return 1
			return 0
		})
	const nonDefaultRoutes = availableRouteSets.filter(
		([_id, routeSet]) => routeSet.defaultActive !== undefined && routeSet.active !== routeSet.defaultActive
	).length
	const exclusivityGroups: {
		[id: string]: Array<[string, StudioRouteSet]>
	} = {}
	for (const [id, routeSet] of availableRouteSets) {
		const group = routeSet.exclusivityGroup || '__noGroup'
		if (exclusivityGroups[group] === undefined) exclusivityGroups[group] = []
		exclusivityGroups[group].push([id, routeSet])
	}

	return (
		<>
			{mediaStatusOpen && <MediaStatusPopUp key="mediaStatusPopUp" playlistId={props.playlistId} />}
			{switchboardOpen && (
				<SwitchboardPopUp
					key="switchboardPopUp"
					availableRouteSets={availableRouteSets}
					studioRouteSetExclusivityGroups={props.studioRouteSetExclusivityGroups}
					onStudioRouteSetSwitch={props.onStudioRouteSetSwitch}
				/>
			)}
			<div
				className={classNames('status-bar', {
					'status-bar--no-rundown-header': props.hideRundownHeader,
				})}
			>
				<div className="status-bar__cell status-bar__cell--align-start">
					<AnimatePresence initial={false}>
						<NotificationCenterPanelToggle
							key="critical"
							onClick={(e) => props.onToggleNotifications?.(e, NoticeLevel.CRITICAL)}
							isOpen={props.isNotificationCenterOpen === NoticeLevel.CRITICAL}
							filter={NoticeLevel.CRITICAL}
							className="type-critical"
							title={t('Critical Problems')}
						/>
						<NotificationCenterPanelToggle
							key="warning"
							onClick={(e) => props.onToggleNotifications?.(e, NoticeLevel.WARNING)}
							isOpen={props.isNotificationCenterOpen === NoticeLevel.WARNING}
							filter={NoticeLevel.WARNING}
							className="type-warning"
							title={t('Warnings')}
						/>
						<NotificationCenterPanelToggle
							key="notification"
							onClick={(e) => props.onToggleNotifications?.(e, NoticeLevel.NOTIFICATION | NoticeLevel.TIP)}
							isOpen={props.isNotificationCenterOpen === ((NoticeLevel.NOTIFICATION | NoticeLevel.TIP) as NoticeLevel)}
							filter={NoticeLevel.NOTIFICATION | NoticeLevel.TIP}
							className="type-notification"
							title={t('Notes')}
						/>
						{props.isUserEditsEnabled && (
							<PropertiesPanelToggle key="properties" isNotificationCenterOpen={props.isNotificationCenterOpen} />
						)}
						<button
							key="rewind"
							className="status-bar__controls__button"
							role="button"
							onClick={onRewindClick}
							tabIndex={0}
							aria-label={t('Rewind all Segments')}
						>
							<RewindAllSegmentsIcon />
						</button>
						<div>
							{!props.isFollowingOnAir && (
								<button
									key="followingOnAir"
									className="status-bar__controls__button"
									role="button"
									onMouseEnter={onOnAirMouseEnter}
									onMouseLeave={onOnAirMouseLeave}
									onClick={onOnAirClick}
									tabIndex={0}
									aria-label={t('Go to On Air Segment')}
								>
									{onAirHover ? <Lottie config={ONAIR_OVER} /> : <Lottie config={ONAIR_OUT} />}
								</button>
							)}
						</div>
					</AnimatePresence>
				</div>
				<div className="status-bar__cell status-bar__cell--align-end">
					<AnimatePresence>
						{props.isStudioMode && (
							<RundownRightHandButton
								key="take"
								className="status-bar__controls__button status-bar__controls__button--take"
								role="button"
								onClick={onTakeClick}
								tabIndex={0}
								aria-label={t('Take')}
							>
								Take
							</RundownRightHandButton>
						)}
						<RundownRightHandButton
							key="mediaStatus"
							className={classNames(
								'status-bar__controls__button',
								'status-bar__controls__button--media-status',
								'notifications-s notifications-text',
								{
									'status-bar__controls__button--open': mediaStatusOpen,
								}
							)}
							role="button"
							onClick={onMediaStatusToggle}
							tabIndex={0}
							aria-label={t('Media Status')}
							aria-haspopup="dialog"
							aria-pressed={mediaStatusOpen ? 'true' : 'false'}
						>
							<MediaStatusIcon />
						</RundownRightHandButton>
						<RundownRightHandButton
							key="segmentViewMode"
							className="status-bar__controls__button status-bar__controls__button--segment-view-mode"
							role="button"
							onClick={onSegmentViewModeClick}
							tabIndex={0}
							aria-label={t('Switch Segment View Mode')}
						>
							<SegmentViewMode />
						</RundownRightHandButton>
						{props.isStudioMode &&
							props.studioRouteSets &&
							props.onStudioRouteSetSwitch &&
							availableRouteSets.length > 0 && (
								<>
									<RundownRightHandButton
										key="switchboard"
										className={classNames(
											'status-bar__controls__button',
											'status-bar__controls__button--switchboard-panel',
											'notifications-s notifications-text',
											{
												'status-bar__controls__button--open': switchboardOpen,
											}
										)}
										role="button"
										onClick={onRouteSetsToggle}
										tabIndex={0}
										aria-label={t('Switchboard Panel')}
										aria-haspopup="dialog"
										aria-pressed={switchboardOpen ? 'true' : 'false'}
									>
										<SwitchboardIcon />
										{nonDefaultRoutes > 0 && (
											<RouteSetOverrideIcon className="status-bar__controls__button--switchboard-panel__notification" />
										)}
									</RundownRightHandButton>
								</>
							)}
						<SupportPopUpToggle
							key="supportPopUp"
							onClick={props.onToggleSupportPanel}
							isOpen={props.isSupportPanelOpen}
							title={t('Toggle Support Panel')}
						/>
					</AnimatePresence>
				</div>
			</div>
		</>
	)
}

function PropertiesPanelToggle(props: { isNotificationCenterOpen: NoticeLevel | undefined }) {
	return (
		<SelectedElementsContext.Consumer>
			{(context) => {
				const isOpen = context.listSelectedElements().length > 0 && !props.isNotificationCenterOpen
				return (
					<button
						onClick={context.clearSelections}
						className={classNames('status-bar__controls__button', {
							'status-bar__controls__button--open': isOpen,
						})}
					>
						{isOpen ? <UserEditsIcon /> : <UserEditsCloseIcon />}
					</button>
				)
			}}
		</SelectedElementsContext.Consumer>
	)
}
