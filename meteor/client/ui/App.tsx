import * as React from 'react'
import { translate, InjectedI18nProps } from 'react-i18next'
import * as m from 'moment'
import 'moment/min/locales'
import { parse as queryStringParse } from 'query-string'
import Header from './Header'
import {
	setStudioMode,
	setAdminMode,
	getStudioMode,
	getAdminMode,
	setDeveloperMode,
	setTestingMode,
	getTestingMode,
	getDeveloperMode,
	setSpeakingMode
} from '../lib/localStorage'
import Status from './Status'
import Settings from './Settings'
import TestTools from './TestTools'
import { RundownList } from './RundownList'
import { RundownView } from './RundownView'
import { ActiveRundownView } from './ActiveRundownView'
import { ClockView } from './ClockView'
import { ConnectionStatusNotification } from './ConnectionStatusNotification'
import {
  BrowserRouter as Router,
  Route,
  Switch,
  Redirect
} from 'react-router-dom'
import { ErrorBoundary } from '../lib/ErrorBoundary'
import { PrompterView } from './Prompter/PrompterView'
import { ModalDialogGlobalContainer } from '../lib/ModalDialog'

interface IAppState {
	studioMode: boolean
	adminMode: boolean
	testingMode: boolean
	developerMode: boolean
}

const NullComponent = () => null

// App component - represents the whole app
class App extends React.Component<InjectedI18nProps, IAppState> {
	constructor (props) {
		super(props)

		const params = queryStringParse(location.search)

		if (params['studio']) 	setStudioMode(params['studio'] === '1')
		if (params['configure']) setAdminMode(params['configure'] === '1')
		if (params['develop']) setDeveloperMode(params['develop'] === '1')
		if (params['testing']) setTestingMode(params['testing'] === '1')
		if (params['speak']) setSpeakingMode(params['speak'] === '1')
		if (params['admin']) {
			const val = params['admin'] === '1'
			setStudioMode(val)
			setAdminMode(val)
			setDeveloperMode(val)
			setTestingMode(val)
		}

		this.state = {
			studioMode: getStudioMode(),
			adminMode: getAdminMode(),
			testingMode: getTestingMode(),
			developerMode: getDeveloperMode()
		}

	}

	componentDidMount () {
		const { i18n } = this.props

		m.locale(i18n.language)
	}

	render () {
		return (
			<Router>
				<div className='container-fluid'>
					{/* Header switch - render the usual header for all pages but the rundown view */}
					<ErrorBoundary>
						<Switch>
							<Route path='/rundown/:rundownId' component={NullComponent} />
							<Route path='/countdowns/:studioId/presenter' component={NullComponent} />
							<Route path='/countdowns/presenter' component={NullComponent} />
							<Route path='/activeRundown' component={NullComponent} />
							<Route path='/prompter/:studioId' component={NullComponent} />
							<Route path='/' render={(props) => <Header {...props} adminMode={this.state.adminMode} testingMode={this.state.testingMode} developerMode={this.state.developerMode} />} />
						</Switch>
					</ErrorBoundary>
					{/* Main app switch */}
					<ErrorBoundary>
						<Switch>
							{/* <Route exact path='/' component={Dashboard} /> */}
							<Route exact path='/' component={RundownList} />
							<Route path='/rundowns' component={RundownList} />
							<Route path='/rundown/:rundownId' component={RundownView} />
							<Route path='/activeRundown/:studioId' component={ActiveRundownView} />
							<Route path='/prompter/:studioId' component={PrompterView} />
							<Route path='/countdowns/:studioId/presenter' component={ClockView} />
							<Route path='/status' component={Status} />
							<Route path='/settings' component={Settings} />
							<Route path='/testTools' component={TestTools} />
							<Redirect to='/' />
						</Switch>
					</ErrorBoundary>
					<ErrorBoundary>
						<Switch>
							{/* Put views that should NOT have the Notification center here: */}
							<Route path='/countdowns/:studioId/presenter' component={NullComponent} />
							<Route path='/countdowns/presenter' component={NullComponent} />
							<Route path='/prompter/:studioId' component={NullComponent} />

							<Route path='/' component={ConnectionStatusNotification} />
						</Switch>
					</ErrorBoundary>
					<ErrorBoundary>
						<ModalDialogGlobalContainer />
					</ErrorBoundary>
				</div>
			</Router>
		)
	}
}

export default translate()(App)
