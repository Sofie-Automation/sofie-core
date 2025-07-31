import { useSubscription } from '../lib/ReactMeteorData/react-meteor-data.js'
import { useTranslation } from 'react-i18next'
import { Route, Switch, Redirect, NavLink } from 'react-router-dom'
import { SystemStatus } from './Status/SystemStatus/SystemStatus.js'
import { MediaManagerStatus } from './Status/MediaManager.js'
import { ExternalMessages } from './Status/ExternalMessages.js'
import { UserActivity } from './Status/UserActivity.js'
import { EvaluationView } from './Status/Evaluations.js'
import { MeteorPubSub } from '@sofie-automation/meteor-lib/dist/api/pubsub'
import { ExpectedPackagesStatus } from './Status/package-status/index.js'
import { MediaStatus } from './Status/media-status/index.js'
import { CorelibPubSub } from '@sofie-automation/corelib/dist/pubsub'
import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'
import Container from 'react-bootstrap/esm/Container'

function StatusMenu(): JSX.Element {
	const { t } = useTranslation()

	return (
		<div className="tight-xs htight-xs">
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

export default function Status(): JSX.Element {
	useSubscription(CorelibPubSub.peripheralDevices, null)
	useSubscription(MeteorPubSub.uiStudio, null)
	useSubscription(CorelibPubSub.showStyleBases, null)
	useSubscription(CorelibPubSub.showStyleVariants, null, null)

	return (
		<Container fluid className="header-clear">
			<div className="mt-5 mx-5 has-statusbar">
				<Row>
					<Col xs={12} sm={4} md={3} lg={2}>
						<StatusMenu />
					</Col>
					<Col xs={12} sm={8} md={9} lg={10}>
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
					</Col>
				</Row>
			</div>
		</Container>
	)
}
