import * as React from 'react'
import { WithTranslation } from 'react-i18next'
import { NavLink, Link } from 'react-router-dom'
import { NotificationCenterPanelToggle, NotificationCenterPanel } from '../lib/notifications/NotificationCenterPanel'
import { NotificationCenter, NoticeLevel } from '../lib/notifications/notifications'
import { ErrorBoundary } from '../lib/ErrorBoundary'
import { SupportPopUpToggle, SupportPopUp } from './SupportPopUp'
import { translateWithTracker, Translated } from '../lib/ReactMeteorData/ReactMeteorData'
import { CoreSystem } from '../collections'
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
							isOpen={this.state.isNotificationCenterOpen === (NoticeLevel.NOTIFICATION | NoticeLevel.TIP)}
							filter={NoticeLevel.NOTIFICATION | NoticeLevel.TIP}
							className="type-notification"
							title={t('Notes')}
						/>
						<SupportPopUpToggle onClick={this.onToggleSupportPanel} isOpen={this.state.isSupportPanelOpen} />
					</div>
				</ErrorBoundary>
				<div className="header dark">
					<div className="gutter frow va-middle ha-between phm">
						<div className="fcol">
							<div className="frow">
								<Link className="badge" to="/">
									<div>
										<div className="media-elem mrs sofie-logo" />
										<div className="bd mls">
											<span className="logo-text">Sofie {this.props.name ? ' - ' + this.props.name : null}</span>
										</div>
									</div>
								</Link>
							</div>
						</div>
						<div className="fcol">
							<div className="frow ha-right">
								<nav className="links mod">
									{/* <NavLink to='/' activeClassName='active'>{t('Home')}</NavLink> */}
									<NavLink to="/rundowns" activeClassName="active">
										{t('Rundowns')}
									</NavLink>
									{this.props.allowTesting && (
										<NavLink to="/testTools" activeClassName="active">
											{t('Test Tools')}
										</NavLink>
									)}
									<NavLink to="/status" activeClassName="active">
										{t('Status')}
									</NavLink>
									{this.props.allowConfigure && (
										<NavLink to="/settings" activeClassName="active">
											{t('Settings')}
										</NavLink>
									)}
								</nav>
							</div>
						</div>
					</div>
				</div>
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
