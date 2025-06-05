import { useSubscription } from '../lib/ReactMeteorData/react-meteor-data.js'
import { Route, Switch, Redirect } from 'react-router-dom'
import { ErrorBoundary } from '../lib/ErrorBoundary.js'
import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'

import StudioSettings from './Settings/StudioSettings.js'
import DeviceSettings from './Settings/DeviceSettings.js'
import ShowStyleSettings from './Settings/ShowStyleBaseSettings.js'
import SnapshotsView from './Settings/SnapshotsView.js'
import BlueprintSettings from './Settings/BlueprintSettings.js'
import SystemManagement from './Settings/SystemManagement.js'

import { MigrationView } from './Settings/Migration.js'
import { SettingsMenu } from './Settings/SettingsMenu.js'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { CorelibPubSub } from '@sofie-automation/corelib/dist/pubsub'
import Container from 'react-bootstrap/esm/Container'

export function Settings(): JSX.Element | null {
	useSubscription(CorelibPubSub.peripheralDevices, null)
	useSubscription(CorelibPubSub.studios, null)
	useSubscription(CorelibPubSub.showStyleBases, null)
	useSubscription(CorelibPubSub.showStyleVariants, null, null)
	useSubscription(CorelibPubSub.blueprints, null)

	return (
		<Container fluid className="header-clear">
			<div className="mx-5 mt-5 has-statusbar">
				<Row>
					<Col xs={12} sm={5} md={4} lg={3} className="settings-menu mb-4">
						<ErrorBoundary>
							<SettingsMenu />
						</ErrorBoundary>
					</Col>
					<Col xs={12} sm={7} md={8} lg={9} className="settings-dialog">
						<ErrorBoundary>
							<Switch>
								<Route path="/settings" exact component={WelcomeToSettings} />
								<Route path="/settings/studio/:studioId" component={StudioSettings} />
								<Route path="/settings/showStyleBase/:showStyleBaseId" component={ShowStyleSettings} />
								<Route path="/settings/peripheralDevice/:deviceId" component={DeviceSettings} />
								<Route
									path="/settings/blueprint/:blueprintId"
									render={(props) => (
										<BlueprintSettings
											blueprintId={protectString(decodeURIComponent(props.match.params.blueprintId))}
										/>
									)}
								/>
								<Route path="/settings/tools/snapshots" component={SnapshotsView} />
								<Route path="/settings/tools/migration" component={MigrationView} />
								<Route path="/settings/tools/system" component={SystemManagement} />
								<Redirect to="/settings" />
							</Switch>
						</ErrorBoundary>
					</Col>
				</Row>
			</div>
		</Container>
	)
}

function WelcomeToSettings(): JSX.Element {
	return <div></div>
}
