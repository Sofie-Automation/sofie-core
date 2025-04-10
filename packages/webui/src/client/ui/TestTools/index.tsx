import { useTranslation } from 'react-i18next'
import { useSubscription } from '../../lib/ReactMeteorData/react-meteor-data'
import { Route, Switch, NavLink, Redirect } from 'react-router-dom'
import { TimelineView, TimelineStudioSelect } from './Timeline'
import { MeteorPubSub } from '@sofie-automation/meteor-lib/dist/api/pubsub'
import { MappingsStudioSelect, MappingsView } from './Mappings'
import { TimelineDatastoreStudioSelect, TimelineDatastoreView } from './TimelineDatastore'
import { DeviceTriggersDeviceSelect, DeviceTriggersView } from './DeviceTriggers'
import { CorelibPubSub } from '@sofie-automation/corelib/dist/pubsub'

interface IStatusMenuProps {
	match?: any
}
function StatusMenu(_props: Readonly<IStatusMenuProps>) {
	const { t } = useTranslation()

	return (
		<div className="tight-xs htight-xs text-s">
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
		</div>
	)
}

interface IStatusProps {
	match?: any
}
export default function Status(props: Readonly<IStatusProps>): JSX.Element {
	// Subscribe to data:
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
								<Route path="/testTools/timeline/:studioId" component={TimelineView} />
								<Route path="/testTools/timeline" component={TimelineStudioSelect} />
								<Route path="/testTools/mappings/:studioId" component={MappingsView} />
								<Route path="/testTools/mappings" component={MappingsStudioSelect} />
								<Route path="/testTools/timelinedatastore/:studioId" component={TimelineDatastoreView} />
								<Route path="/testTools/timelinedatastore" component={TimelineDatastoreStudioSelect} />
								<Route path="/testTools/devicetriggers/:peripheralDeviceId" component={DeviceTriggersView} />
								<Route path="/testTools/devicetriggers" component={DeviceTriggersDeviceSelect} />
								<Redirect to="/testTools/timeline" />
							</Switch>
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}
