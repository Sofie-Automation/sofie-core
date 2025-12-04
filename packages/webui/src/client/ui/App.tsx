import React, { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import 'moment/min/locales'
import { parse as queryStringParse } from 'query-string'
import Header from './Header.js'
import {
	setAllowSpeaking,
	setAllowVibrating,
	setHelpMode,
	setUIZoom,
	getUIZoom,
	setShowHiddenSourceLayers,
	setIgnorePieceContentStatus,
	setShelfFollowsOnAir,
	setReportNotifications,
	unsetReportNotifications,
	getShelfFollowsOnAir,
	getAllowSpeaking,
	getAllowVibrating,
	getShowHiddenSourceLayers,
	getIgnorePieceContentStatus,
	getHelpMode,
	getReportNotifications,
} from '../lib/localStorage.js'
import Status from './Status.js'
import { Settings as SettingsView } from './Settings.js'
import TestTools from './TestTools/index.js'
import { RundownList } from './RundownList.js'
import { RundownView } from './RundownView.js'
import { ActiveRundownView } from './ActiveRundownView.js'
import { ClockView } from './ClockView/ClockView.js'
import { ConnectionStatusNotification } from '../lib/ConnectionStatusNotification.js'
import { BrowserRouter as Router, Route, Switch, Redirect } from 'react-router-dom'
import { ErrorBoundary } from '../lib/ErrorBoundary.js'
import { PrompterView } from './Prompter/PrompterView.js'
import { ModalDialogGlobalContainer, doModalDialog } from '../lib/ModalDialog.js'
import { Settings } from '../lib/Settings.js'
import { DocumentTitleProvider } from '../lib/DocumentTitleProvider.js'
import { catchError, firstIfArray, isRunningInPWA } from '../lib/lib.js'
import { protectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import { useUserPermissions, UserPermissionsContext } from './UserPermissions.js'
import { relativeToSiteRootUrl, ROOT_URL_PATH_PREFIX } from '../url.js'

const NullComponent = () => null

const CRON_INTERVAL = 30 * 60 * 1000
const LAST_RESTART_LATENCY = 3 * 60 * 60 * 1000
const WINDOW_START_HOUR = 3
const WINDOW_END_HOUR = 5

export const App: React.FC = function App() {
	const { t } = useTranslation()

	const [lastStart] = useState(Date.now())

	const [roles, _rolesReady] = useUserPermissions()
	const featureFlags = useFeatureFlags()

	useEffect(() => {
		function cronJob() {
			const now = new Date()
			const hour = now.getHours() + now.getMinutes() / 60
			// if the time is between 3 and 5
			if (
				hour >= WINDOW_START_HOUR &&
				hour < WINDOW_END_HOUR &&
				// and the previous restart happened more than 3 hours ago
				Date.now() - lastStart > LAST_RESTART_LATENCY &&
				// and not in an active rundown
				document.querySelector('.rundown.active') === null
			) {
				// @ts-expect-error forceReload is marked as deprecated, but it's still usable
				setTimeout(() => window.location.reload(true), 1)
			}
		}

		const interval = setInterval(cronJob, CRON_INTERVAL)

		return () => {
			clearInterval(interval)
		}
	}, [lastStart])

	const mountPWAFullScreenTrigger = useCallback(() => {
		document.addEventListener(
			'mousedown',
			(event) => {
				event.preventDefault()

				document.documentElement
					.requestFullscreen({
						navigationUI: 'auto',
					})
					.then(() => {
						document.addEventListener('fullscreenchange', mountPWAFullScreenTrigger, {
							once: true,
						})
					})
					.catch(catchError('documentElement.requestFullscreen'))

				// Use Keyboard API to lock the keyboard and disable all browser shortcuts
				if (!('keyboard' in navigator))
					return // but we check for its availability, so it should be fine.
					// Keyboard Lock: https://wicg.github.io/keyboard-lock/
				;(navigator.keyboard as any).lock().catch(catchError('keyboard.lock'))
			},
			{
				once: true,
				passive: false,
			}
		)
	}, [])

	useEffect(() => {
		if (Settings.customizationClassName) {
			document.body.classList.add(Settings.customizationClassName)
		}
		const uiZoom = featureFlags.zoom
		if (uiZoom !== 1) {
			document.documentElement.style.fontSize = uiZoom * 16 + 'px'
		}
	}, [featureFlags.zoom])

	useEffect(() => {
		if (isRunningInPWA()) {
			mountPWAFullScreenTrigger()
		} else {
			window.addEventListener('appinstalled', mountPWAFullScreenTrigger)

			return () => {
				window.removeEventListener('appinstalled', mountPWAFullScreenTrigger)
			}
		}
	}, [mountPWAFullScreenTrigger])

	const onNavigationUserConfirmation = useCallback((message: string, callback: (result: boolean) => void) => {
		doModalDialog({
			title: t('Are you sure?'),
			message,
			onAccept: () => {
				callback(true)
			},
			onDiscard: () => {
				callback(false)
			},
		})
	}, [])

	return (
		<UserPermissionsContext.Provider value={roles}>
			<Router getUserConfirmation={onNavigationUserConfirmation} basename={ROOT_URL_PATH_PREFIX}>
				<div
					style={{
						// @ts-expect-error custom variable
						'--sofie-logo-url': `url(${relativeToSiteRootUrl('/images/sofie-logo.svg')})`,
					}}
				>
					{/* Header switch - render the usual header for all pages but the rundown view */}
					<ErrorBoundary>
						<Switch>
							<Route path="/rundown/:playlistId" component={NullComponent} />
							{/* The ClockView index should show heders. Any pages inside should not */}
							<Route path="/countdowns/:studioId/:page" component={NullComponent} />
							<Route path="/activeRundown" component={NullComponent} />
							<Route path="/prompter/:studioId" component={NullComponent} />
							<Route
								path="/"
								render={(props) => (
									<Header
										{...props}
										allowConfigure={roles.configure}
										allowTesting={roles.testing}
										allowDeveloper={roles.developer}
									/>
								)}
							/>
						</Switch>
					</ErrorBoundary>
					{/* Main app switch */}
					<ErrorBoundary>
						<Switch>
							<Route exact path="/" component={RundownList} />
							<Route path="/rundowns" render={() => <RundownList />} />
							<Route
								path="/rundown/:playlistId/shelf"
								exact
								render={(props) => (
									<RundownView
										playlistId={protectString(decodeURIComponent(props.match.params.playlistId))}
										onlyShelf={true}
									/>
								)}
							/>
							<Route
								path="/rundown/:playlistId"
								render={(props) => (
									<RundownView playlistId={protectString(decodeURIComponent(props.match.params.playlistId))} />
								)}
							/>
							<Route
								path="/activeRundown/:studioId"
								render={(props) => (
									<ActiveRundownView studioId={protectString(decodeURIComponent(props.match.params.studioId))} />
								)}
							/>
							<Route
								path="/prompter/:studioId"
								render={(props) => (
									<PrompterView studioId={protectString(decodeURIComponent(props.match.params.studioId))} />
								)}
							/>
							{/* We switch to the general ClockView component, and allow it to do the switch between various types of countdowns */}
							<Route
								path="/countdowns/:studioId"
								render={(props) => (
									<ClockView studioId={protectString(decodeURIComponent(props.match.params.studioId))} />
								)}
							/>
							<Route path="/status" render={() => <Status />} />
							<Route path="/settings" render={() => <SettingsView />} />
							<Route path="/testTools" render={() => <TestTools />} />
							<Route>
								<Redirect to="/" />
							</Route>
						</Switch>
					</ErrorBoundary>
					<ErrorBoundary>
						<Switch>
							{/* Put views that should NOT have the Notification center here: */}
							<Route path="/countdowns/:studioId" component={NullComponent} />
							<Route path="/prompter/:studioId" component={NullComponent} />
							<Route path="/" component={ConnectionStatusNotification} />
						</Switch>
					</ErrorBoundary>
					<ErrorBoundary>
						<DocumentTitleProvider />
					</ErrorBoundary>
					<ErrorBoundary>
						<ModalDialogGlobalContainer />
					</ErrorBoundary>
				</div>
			</Router>
		</UserPermissionsContext.Provider>
	)
}

function useFeatureFlags() {
	const location = window.location

	const [featureFlags, setFeatureFlags] = useState({
		shelfFollowsOnAir: getShelfFollowsOnAir(),
		speak: getAllowSpeaking(),
		vibrate: getAllowVibrating(),
		help: getHelpMode(),
		zoom: getUIZoom(),
		showHiddenSourceLayers: getShowHiddenSourceLayers(),
		ignorePieceContentStatus: getIgnorePieceContentStatus(),
		reportNotifications: getReportNotifications(),
	})

	useEffect(() => {
		if (!location.search) return

		const params = queryStringParse(location.search)

		if (params['shelffollowsonair']) setShelfFollowsOnAir(params['shelffollowsonair'] === '1')
		if (params['speak']) setAllowSpeaking(params['speak'] === '1')
		if (params['vibrate']) setAllowVibrating(params['vibrate'] === '1')
		if (params['help']) setHelpMode(params['help'] === '1')
		if (params['zoom'] && typeof params['zoom'] === 'string') {
			setUIZoom(parseFloat(firstIfArray(params['zoom']) || '1') / 100 || 1)
		}
		if (params['show_hidden_source_layers']) {
			setShowHiddenSourceLayers(params['show_hidden_source_layers'] === '1')
		}
		if (params['ignore_piece_content_status']) {
			setIgnorePieceContentStatus(params['ignore_piece_content_status'] === '1')
		}
		if (params['reportNotificationsId'] && params['reportNotificationsId'] !== '0') {
			const notificationsId = firstIfArray(params['reportNotificationsId'])
			if (notificationsId) setReportNotifications(notificationsId)
		} else if (params['reportNotificationsId'] === '0') {
			unsetReportNotifications()
		}

		setFeatureFlags({
			shelfFollowsOnAir: getShelfFollowsOnAir(),
			speak: getAllowSpeaking(),
			vibrate: getAllowVibrating(),
			help: getHelpMode(),
			zoom: getUIZoom(),
			showHiddenSourceLayers: getShowHiddenSourceLayers(),
			ignorePieceContentStatus: getIgnorePieceContentStatus(),
			reportNotifications: getReportNotifications(),
		})
	}, [location.search])

	return featureFlags
}

export default App
