import { Meteor } from 'meteor/meteor'
import { Tracker } from 'meteor/tracker'
import { getRandomString } from './tempLib.js'
import { logger } from './logging.js'
import { getLocalAllowStudio } from './localStorage.js'

/*
 * This file sets up logging of the connection status, for troubleshooting purposes.
 */

/** A string which uniquely identifies each browser session */
const browserSessionId = getRandomString(8)

// Only log status for studio users
const logStatusEnable = getLocalAllowStudio() // Future: this needs to be setup to be reactive if this is wanted to work correctly in environments with authentication

const previouslyLogged: {
	connected?: boolean
	status?: string
	reason?: string
} = {}

function log(message: string) {
	const connectionSessionId = (Meteor as any).connection?._lastSessionId

	logger.info(`${new Date().toISOString()} ClientLog "${connectionSessionId}"/"${browserSessionId}": ${message}`)
}

if (logStatusEnable) {
	log('Starting up')

	Meteor.startup(() => {
		Tracker.autorun(() => {
			const meteorStatus = Meteor.status()

			if (previouslyLogged.connected !== meteorStatus.connected) {
				previouslyLogged.connected = meteorStatus.connected

				log(meteorStatus.connected ? 'Connected' : 'Disconnected')
			}
			if (previouslyLogged.status !== meteorStatus.status) {
				previouslyLogged.status = meteorStatus.status

				log(`Status "${meteorStatus.status}"`)
			}
			if (previouslyLogged.reason !== meteorStatus.reason) {
				previouslyLogged.reason = meteorStatus.reason

				log(`Reason "${meteorStatus.reason}"`)
			}
		})
	})
}
