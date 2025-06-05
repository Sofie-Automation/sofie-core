import { Meteor } from 'meteor/meteor'
import 'meteor/ddp'
import { createRoot } from 'react-dom/client'

import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import { SorensenContextProvider } from './client/lib/SorensenContext'

// Import some browser polyfills to handle rare features
import './client/lib/polyfill/polyfills'

import './client/ui/i18n'

// Import files that call Meteor.startup:
import './client/lib/currentTimeReactive'
import './client/lib/uncaughtErrorHandler'
import './client/lib/dev'
import './client/lib/systemTime'

import App from './client/ui/App'
import { logger } from './client/lib/logging'
import './client/lib/logStatus'

if ('serviceWorker' in navigator) {
	// Use the window load event to keep the page load performant
	window.addEventListener('load', () => {
		// in some versions of Chrome, registering the Service Worker over HTTP throws an arror
		if (window.location.protocol === 'https:' || window.location.hostname === 'localhost') {
			navigator.serviceWorker.register('/sw.js').catch((err) => {
				logger.error('Error registering serviceWorker', err)
			})
		}
	})
}

Meteor.startup(() => {
	const targetEl = document.getElementById('render-target')

	if (!targetEl) {
		logger.error('Could not find target element for mounting UI')
		return
	}

	const root = createRoot(targetEl)

	root.render(
		<DndProvider backend={HTML5Backend}>
			<SorensenContextProvider>
				<App />
			</SorensenContextProvider>
		</DndProvider>
	)
})
