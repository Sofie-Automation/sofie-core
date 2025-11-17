import type { Time } from '@sofie-automation/shared-lib/dist/lib/lib'
import { getCurrentTime } from './systemTime.js'
import { Meteor } from 'meteor/meteor'
import { Tracker } from 'meteor/tracker'

const getCurrentTimeReactiveDep = new Tracker.Dependency()
export function getCurrentTimeReactive(): Time {
	getCurrentTimeReactiveDep.depend()
	return getCurrentTime()
}
const updateCurrentTimeReactive = () => {
	const time = getCurrentTime()

	getCurrentTimeReactiveDep.changed()

	let timeToNextSecond = Math.floor(1000 - (time % 1000))
	if (timeToNextSecond < 200) timeToNextSecond += 1000

	setTimeout(() => {
		updateCurrentTimeReactive()
	}, timeToNextSecond)
}
Meteor.startup(() => {
	updateCurrentTimeReactive()
})
