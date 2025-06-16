import { Meteor } from 'meteor/meteor'
import { Settings } from '../../Settings'
import { StatusCode } from '@sofie-automation/blueprints-integration'
import { setSystemStatus } from '../../systemStatus/systemStatus'
import { logger } from '../../logging'
import { determineDiffTime } from './systemTime'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'

const CHECK_INTERVAL = 60 * 1000

let failCount = 0

Meteor.startup(() => {
	if (Settings.enableNTPTimeChecker) {
		// Periodically checks an NTP-server for the diff in time, and raises a warning if the diff is too large.

		const enableNTPTimeChecker = Settings.enableNTPTimeChecker
		Meteor.setInterval(() => {
			determineDiffTime({
				host: enableNTPTimeChecker.host,
				port: enableNTPTimeChecker.port,
			})
				.then((result) => {
					failCount = 0

					// Note: Subtracting `mean` with `stdDev` is not really the right thing to do, but it helps avoiding warnings in bad network conditions...
					if (Math.abs(result.mean) - Math.abs(result.stdDev) > enableNTPTimeChecker.maxAllowedDiff) {
						logger.warn(`ntpTimeChecker: diff is ${result.mean} ms (stdDev=${result.stdDev})`)

						setSystemStatus('ntpTimeChecker', {
							statusCode: StatusCode.WARNING_MINOR,
							messages: [
								`Warning: The time of the server differs ${result.mean} ms from the NTP server (check the configuration of the OS that Sofie Core is running on)`,
							],
						})
					} else {
						setSystemStatus('ntpTimeChecker', { statusCode: StatusCode.GOOD, messages: [] })
					}
				})
				.catch((err) => {
					logger.error(`Error in determineDiffTime: ${stringifyError(err)}`)
					failCount++
					if (failCount > 10) {
						setSystemStatus('ntpTimeChecker', {
							statusCode: StatusCode.WARNING_MINOR,
							messages: [`Warning: Unable to get the NTP time from the server. Error: ${err}`],
						})
					}
				})
		}, CHECK_INTERVAL)

		setSystemStatus('ntpTimeChecker', { statusCode: StatusCode.GOOD, messages: [] })
	}
})
