import * as React from 'react'
import { WithTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { NotificationCenterPanelToggle, NotificationCenterPanel } from '../lib/notifications/NotificationCenterPanel.js'
import { NotificationCenter, NoticeLevel } from '../lib/notifications/notifications.js'
import { ErrorBoundary } from '../lib/ErrorBoundary.js'
import { SupportPopUpToggle, SupportPopUp } from './SupportPopUp.js'
import { translateWithTracker, Translated } from '../lib/ReactMeteorData/ReactMeteorData.js'
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

interface ITrackedPropsHeader {
	name: string | undefined
}

interface IStateHeader {
	isNotificationCenterOpen: NoticeLevel | undefined
	isSupportPanelOpen: boolean
}

class Header extends React.Component<Translated<IPropsHeader & ITrackedPropsHeader>, IStateHeader> {
	constructor(props: Translated<IPropsHeader & ITrackedPropsHeader>) {
		super(props)

		this.state = {
			isNotificationCenterOpen: undefined,
			isSupportPanelOpen: false,
		}
	}

	onToggleNotifications = (_e: React.MouseEvent<HTMLButtonElement>, filter: NoticeLevel | undefined) => {
		if (this.state.isNotificationCenterOpen === filter) {
			filter = undefined
		}
		NotificationCenter.isOpen = filter !== undefined ? true : false

		this.setState({
			isNotificationCenterOpen: filter,
		})
	}

	onToggleSupportPanel = () => {
		this.setState({
			isSupportPanelOpen: !this.state.isSupportPanelOpen,
		})
	}

	render(): JSX.Element {
		const { t } = this.props

		return (
			<React.Fragment>
				<ErrorBoundary>
					<AnimatePresence>
						{this.state.isNotificationCenterOpen !== undefined && (
							<NotificationCenterPanel limitCount={15} filter={this.state.isNotificationCenterOpen} />
						)}
						{this.state.isSupportPanelOpen && <SupportPopUp />}
					</AnimatePresence>
				</ErrorBoundary>
				<ErrorBoundary>
					<div className="status-bar">
						<NotificationCenterPanelToggle
							onClick={(e) => this.onToggleNotifications(e, NoticeLevel.CRITICAL)}
							isOpen={this.state.isNotificationCenterOpen === NoticeLevel.CRITICAL}
							filter={NoticeLevel.CRITICAL}
							className="type-critical"
							title={t('Critical Problems')}
						/>
						<NotificationCenterPanelToggle
							onClick={(e) => this.onToggleNotifications(e, NoticeLevel.WARNING)}
							isOpen={this.state.isNotificationCenterOpen === NoticeLevel.WARNING}
							filter={NoticeLevel.WARNING}
							className="type-warning"
							title={t('Warnings')}
						/>
						<NotificationCenterPanelToggle
							onClick={(e) => this.onToggleNotifications(e, NoticeLevel.NOTIFICATION | NoticeLevel.TIP)}
							isOpen={
								this.state.isNotificationCenterOpen === ((NoticeLevel.NOTIFICATION | NoticeLevel.TIP) as NoticeLevel)
							}
							filter={NoticeLevel.NOTIFICATION | NoticeLevel.TIP}
							className="type-notification"
							title={t('Notes')}
						/>
						<SupportPopUpToggle onClick={this.onToggleSupportPanel} isOpen={this.state.isSupportPanelOpen} />
					</div>
				</ErrorBoundary>
				<Navbar data-bs-theme="dark" fixed="top" expand className="bg-body-tertiary">
					<Container fluid className="mx-5">
						<Navbar.Brand>
							<Link className="badge-sofie" to="/">
								<div className="media-elem me-2 sofie-logo" />
								<div className="logo-text">Sofie {this.props.name ? ' - ' + this.props.name : null}</div>
							</Link>
						</Navbar.Brand>
						<Nav className="justify-content-end">
							<LinkContainer to="/rundowns" activeClassName="active">
								<Nav.Link>{t('Rundowns')}</Nav.Link>
							</LinkContainer>
							{this.props.allowTesting && (
								<LinkContainer to="/testTools" activeClassName="active">
									<Nav.Link> {t('Test Tools')}</Nav.Link>
								</LinkContainer>
							)}
							<LinkContainer to="/status" activeClassName="active">
								<Nav.Link> {t('Status')}</Nav.Link>
							</LinkContainer>
							{this.props.allowConfigure && (
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
}

export default translateWithTracker((_props: IPropsHeader & WithTranslation): ITrackedPropsHeader => {
	const coreSystem = CoreSystem.findOne()
	let name: string | undefined = undefined

	if (coreSystem) {
		name = coreSystem.name
	}

	return {
		name,
	}
})(Header)
