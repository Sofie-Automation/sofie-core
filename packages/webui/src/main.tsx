import { Meteor } from 'meteor/meteor'
import 'meteor/ddp'
import { createRoot } from 'react-dom/client'

import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import { SorensenContextProvider } from './client/lib/SorensenContext.js'

// Import some browser polyfills to handle rare features
import './client/lib/polyfill/polyfills.js'

import './client/ui/i18n.js'

// Import files that call Meteor.startup:
import './client/lib/currentTimeReactive.js'
import './client/lib/uncaughtErrorHandler.js'
import './client/lib/dev.js'
import './client/lib/systemTime.js'

import { relativeToSiteRootUrl } from './client/url.js'
import App from './client/ui/App.js'
import { logger } from './client/lib/logging.js'
import './client/lib/logStatus.js'

if ('serviceWorker' in navigator) {
	// Use the window load event to keep the page load performant
	window.addEventListener('load', () => {
		// in some versions of Chrome, registering the Service Worker over HTTP throws an arror
		if (window.location.protocol === 'https:' || window.location.hostname === 'localhost') {
			navigator.serviceWorker.register(relativeToSiteRootUrl('/sw.js')).catch((err) => {
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
