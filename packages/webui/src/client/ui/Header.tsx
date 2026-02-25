import React, { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { NotificationCenterPanelToggle, NotificationCenterPanel } from '../lib/notifications/NotificationCenterPanel.js'
import { NotificationCenter, NoticeLevel } from '../lib/notifications/notifications.js'
import { ErrorBoundary } from '../lib/ErrorBoundary.js'
import { SupportPopUpToggle, SupportPopUp } from './SupportPopUp.js'
import { useTracker } from '../lib/ReactMeteorData/ReactMeteorData.js'
import { CoreSystem } from '../collections/index.js'
import Container from 'react-bootstrap/Container'
import Nav from 'react-bootstrap/Nav'
import Navbar from 'react-bootstrap/Navbar'
import { LinkContainer } from 'react-router-bootstrap'
import { AnimatePresence } from 'motion/react'

interface IPropsHeader {
	allowConfigure?: boolean
	allowTesting?: boolean
	allowDeveloper?: boolean
}

export default function Header({ allowConfigure, allowTesting }: IPropsHeader): JSX.Element {
	const { t } = useTranslation()

	const sofieName = useTracker(() => {
		const coreSystem = CoreSystem.findOne()

		return coreSystem?.name
	}, [])

	const [isNotificationCenterOpen, setIsNotificationCenterOpen] = useState<NoticeLevel | undefined>(undefined)
	const onToggleNotifications = useCallback(
		(_e: React.MouseEvent<HTMLButtonElement>, filter: NoticeLevel | undefined) => {
			setIsNotificationCenterOpen((isNotificationCenterOpen) => {
				if (isNotificationCenterOpen === filter) {
					filter = undefined
				}
				NotificationCenter.isOpen = filter !== undefined ? true : false

				return filter
			})
		},
		[]
	)

	const [isSupportPanelOpen, setIsSupportPanelOpen] = useState(false)
	const onToggleSupportPanel = useCallback(() => setIsSupportPanelOpen((prev) => !prev), [])

	return (
		<React.Fragment>
			<ErrorBoundary>
				<AnimatePresence>
					{isNotificationCenterOpen !== undefined && (
						<NotificationCenterPanel limitCount={15} filter={isNotificationCenterOpen} />
					)}
					{isSupportPanelOpen && <SupportPopUp />}
				</AnimatePresence>
			</ErrorBoundary>
			<ErrorBoundary>
				<div className="status-bar">
					<NotificationCenterPanelToggle
						onClick={(e) => onToggleNotifications(e, NoticeLevel.CRITICAL)}
						isOpen={isNotificationCenterOpen === NoticeLevel.CRITICAL}
						filter={NoticeLevel.CRITICAL}
						className="type-critical"
						title={t('Critical Problems')}
					/>
					<NotificationCenterPanelToggle
						onClick={(e) => onToggleNotifications(e, NoticeLevel.WARNING)}
						isOpen={isNotificationCenterOpen === NoticeLevel.WARNING}
						filter={NoticeLevel.WARNING}
						className="type-warning"
						title={t('Warnings')}
					/>
					<NotificationCenterPanelToggle
						onClick={(e) => onToggleNotifications(e, NoticeLevel.NOTIFICATION | NoticeLevel.TIP)}
						isOpen={isNotificationCenterOpen === ((NoticeLevel.NOTIFICATION | NoticeLevel.TIP) as NoticeLevel)}
						filter={NoticeLevel.NOTIFICATION | NoticeLevel.TIP}
						className="type-notification"
						title={t('Notes')}
					/>
					<SupportPopUpToggle onClick={onToggleSupportPanel} isOpen={isSupportPanelOpen} />
				</div>
			</ErrorBoundary>
			<Navbar data-bs-theme="dark" fixed="top" expand className="bg-body-tertiary">
				<Container fluid className="mx-5">
					<Navbar.Brand>
						<Link className="badge-sofie" to="/">
							<div className="media-elem me-2 sofie-logo" />
							<div className="logo-text">Sofie {sofieName ? ' - ' + sofieName : null}</div>
						</Link>
					</Navbar.Brand>
					<Nav className="justify-content-end">
						<LinkContainer to="/rundowns" activeClassName="active">
							<Nav.Link>{t('Rundowns')}</Nav.Link>
						</LinkContainer>
						{allowTesting && (
							<LinkContainer to="/testTools" activeClassName="active">
								<Nav.Link> {t('Test Tools')}</Nav.Link>
							</LinkContainer>
						)}
						<LinkContainer to="/status" activeClassName="active">
							<Nav.Link> {t('Status')}</Nav.Link>
						</LinkContainer>
						{allowConfigure && (
							<LinkContainer to="/settings" activeClassName="active">
								<Nav.Link> {t('Settings')}</Nav.Link>
							</LinkContainer>
						)}
					</Nav>
				</Container>
			</Navbar>
		</React.Fragment>
	)
}
