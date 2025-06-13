import { getCurrentTime } from './systemTime.js'
import { Meteor } from 'meteor/meteor'
import { Tracker } from 'meteor/tracker'
import _ from 'underscore'
import { MeteorCall } from '../lib/meteorApi.js'
import { ClientCollections, PublicationCollections } from '../collections/lib.js'
import { logger } from './logging.js'

// Note: These things are convenience functions to be used during development:

const windowAny: any = window

Meteor.startup(() => {
	// Perform on a delay, to ensure the collections are setup
	setTimeout(() => {
		windowAny['Collections'] = Object.fromEntries(ClientCollections.entries())
		windowAny['PublicationCollections'] = Object.fromEntries(PublicationCollections.entries())
	}, 1000)
})

windowAny['getCurrentTime'] = getCurrentTime

function setDebugData() {
	Tracker.autorun(() => {
		const stats: Record<string, number> = {}
		for (const [name, collection] of ClientCollections.entries()) {
			stats[name] = collection.find().count()
		}
		console.log(
			_.map(stats, (count: any, name: string) => {
				return name + ': ' + count
			}).join('\n')
		)
	})
}
windowAny['setDebugData'] = setDebugData
const debugData = false
if (debugData) {
	console.log('Debug: comment out this!')
	setDebugData()
}
windowAny['MeteorCall'] = MeteorCall
windowAny['logger'] = logger
