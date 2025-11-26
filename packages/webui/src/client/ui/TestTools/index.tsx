import { useTranslation } from 'react-i18next'
import { useSubscription } from '../../lib/ReactMeteorData/react-meteor-data.js'
import { Route, Switch, NavLink, Redirect } from 'react-router-dom'
import { TimelineView, TimelineStudioSelect } from './Timeline.js'
import { MeteorPubSub } from '@sofie-automation/meteor-lib/dist/api/pubsub'
import { MappingsStudioSelect, MappingsView } from './Mappings.js'
import { TimelineDatastoreStudioSelect, TimelineDatastoreView } from './TimelineDatastore.js'
import { DeviceTriggersDeviceSelect, DeviceTriggersView } from './DeviceTriggers.js'
import { CorelibPubSub } from '@sofie-automation/corelib/dist/pubsub'
import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'
import { IngestRundownStatusSelect, IngestRundownStatusView } from './IngestRundownStatus'
import Container from 'react-bootstrap/esm/Container'

function StatusMenu() {
	const { t } = useTranslation()

	return (
		<div className="tight-xs htight-xs">
			<NavLink
				activeClassName="selectable-selected"
				className="testTools-menu__testTools-menu-item selectable clickable"
				to={'/testTools/timeline'}
			>
				<h3>{t('Timeline')}</h3>
			</NavLink>
			<NavLink
				activeClassName="selectable-selected"
				className="testTools-menu__testTools-menu-item selectable clickable"
				to={'/testTools/timelinedatastore'}
			>
				<h3>{t('Timeline Datastore')}</h3>
			</NavLink>
			<NavLink
				activeClassName="selectable-selected"
				className="testTools-menu__testTools-menu-item selectable clickable"
				to={'/testTools/mappings'}
			>
				<h3>{t('Mappings')}</h3>
			</NavLink>
			<NavLink
				activeClassName="selectable-selected"
				className="testTools-menu__testTools-menu-item selectable clickable"
				to={'/testTools/devicetriggers'}
			>
				<h3>{t('Device Triggers')}</h3>
			</NavLink>
			<NavLink
				activeClassName="selectable-selected"
				className="testTools-menu__testTools-menu-item selectable clickable"
				to={'/testTools/ingestRundownStatus'}
			>
				<h3>{t('Ingest Rundown Statuses')}</h3>
			</NavLink>
		</div>
	)
}

export default function Status(): JSX.Element {
	// Subscribe to data:
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
							<Route path="/testTools/timeline/:studioId" component={TimelineView} />
							<Route path="/testTools/timeline" component={TimelineStudioSelect} />
							<Route path="/testTools/mappings/:studioId" component={MappingsView} />
							<Route path="/testTools/mappings" component={MappingsStudioSelect} />
							<Route path="/testTools/timelinedatastore/:studioId" component={TimelineDatastoreView} />
							<Route path="/testTools/timelinedatastore" component={TimelineDatastoreStudioSelect} />
							<Route path="/testTools/devicetriggers/:peripheralDeviceId" component={DeviceTriggersView} />
							<Route path="/testTools/devicetriggers" component={DeviceTriggersDeviceSelect} />
							<Route path="/testTools/ingestRundownStatus/:peripheralDeviceId" component={IngestRundownStatusView} />
							<Route path="/testTools/ingestRundownStatus" component={IngestRundownStatusSelect} />
							<Redirect to="/testTools/timeline" />
						</Switch>
					</Col>
				</Row>
			</div>
		</Container>
	)
}
