import { useSubscription } from '../lib/ReactMeteorData/react-meteor-data'
import { useTranslation } from 'react-i18next'
import { Route, Switch, Redirect, NavLink } from 'react-router-dom'
import { SystemStatus } from './Status/SystemStatus/SystemStatus'
import { MediaManagerStatus } from './Status/MediaManager'
import { ExternalMessages } from './Status/ExternalMessages'
import { UserActivity } from './Status/UserActivity'
import { EvaluationView } from './Status/Evaluations'
import { MeteorPubSub } from '@sofie-automation/meteor-lib/dist/api/pubsub'
import { ExpectedPackagesStatus } from './Status/package-status'
import { MediaStatus } from './Status/media-status'
import { CorelibPubSub } from '@sofie-automation/corelib/dist/pubsub'

interface IStatusMenuProps {
	match?: any
}
function StatusMenu(_props: Readonly<IStatusMenuProps>): JSX.Element {
	const { t } = useTranslation()

	return (
		<div className="tight-xs htight-xs text-s">
			<NavLink
				activeClassName="selectable-selected"
				className="status-menu__status-menu-item selectable clickable"
				to={'/status/system'}
			>
				<h3>{t('System')}</h3>
			</NavLink>
			<NavLink
				activeClassName="selectable-selected"
				className="status-menu__status-menu-item selectable clickable"
				to={'/status/media'}
			>
				<h3>{t('Media')}</h3>
			</NavLink>
			<NavLink
				activeClassName="selectable-selected"
				className="status-menu__status-menu-item selectable clickable"
				to={'/status/expected-packages'}
			>
				<h3>{t('Packages')}</h3>
			</NavLink>
			<NavLink
				activeClassName="selectable-selected"
				className="status-menu__status-menu-item selectable clickable"
				to={'/status/messages'}
			>
				<h3>{t('Messages')}</h3>
			</NavLink>
			<NavLink
				activeClassName="selectable-selected"
				className="status-menu__status-menu-item selectable clickable"
				to={'/status/userLog'}
			>
				<h3>{t('User Log')}</h3>
			</NavLink>
			<NavLink
				activeClassName="selectable-selected"
				className="status-menu__status-menu-item selectable clickable"
				to={'/status/evaluations'}
			>
				<h3>{t('Evaluations')}</h3>
			</NavLink>
		</div>
	)
}

interface IStatusProps {
	match?: any
}
export default function Status(props: Readonly<IStatusProps>): JSX.Element {
	useSubscription(CorelibPubSub.peripheralDevices, null)
	useSubscription(MeteorPubSub.uiStudio, null)
	useSubscription(CorelibPubSub.showStyleBases, null)
	useSubscription(CorelibPubSub.showStyleVariants, null, null)

	return (
		<div className="container-fluid header-clear">
			<div className="mtl gutter has-statusbar">
				{/* <header className='mvs'>
					<h1>{t('Status')}</h1>
				</header> */}
				<div className="mod mvl mhs">
					<div className="flex-row hide-m-up">
						<div className="flex-col c12 rm-c1 status-menu">
							<StatusMenu match={props.match} />
						</div>
					</div>
					<div className="flex-row">
						<div className="flex-col c12 rm-c1 show-m-up status-menu">
							<StatusMenu match={props.match} />
						</div>
						<div className="flex-col c12 rm-c11 status-dialog">
							<Switch>
								{/* <Route path='/status' exact component={WelcomeToStatus} /> */}
								<Route path="/status/messages" component={ExternalMessages} />
								<Route path="/status/media" component={MediaStatus} />
								<Route path="/status/media-legacy" component={MediaManagerStatus} />
								<Route path="/status/expected-packages" component={ExpectedPackagesStatus} />
								<Route path="/status/system" component={SystemStatus} />
								<Route path="/status/userLog" component={UserActivity} />
								<Route path="/status/evaluations" component={EvaluationView} />
								<Redirect to="/status/system" />
							</Switch>
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}
