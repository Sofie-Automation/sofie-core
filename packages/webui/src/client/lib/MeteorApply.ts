import { Meteor } from 'meteor/meteor'
import { logger } from './logging.js'

/*
 * MeteorApply is a wrapper around Meteor.apply(), and logs a warning if the method is sent late.
 *
 * Because Meteor methods are generally executed in order, it might be useful to know if a method is sent late.
 * ref: https://guide.meteor.com/methods#methods-vs-rest
 *
 * This only works if all method-calls on the client are done through this function,
 * as separate calls to Meteor.apply() or Meteor.call() will bypass the queueing, and cause the
 * time-measurements and logged warnings to be incorrect or omitted.
 */

/**
 * Synonym for Meteor.apply.
 * Logs a warning if the method is sent late
 */
export async function MeteorApply(
	callName: Parameters<typeof Meteor.apply>[0],
	args: Parameters<typeof Meteor.apply>[1],
	options?: Parameters<typeof Meteor.apply>[2],
	sendOptions?: SendOptions
): Promise<any> {
	return new Promise((resolve, reject) => {
		const queuedMethod: QueuedMeteorMethod = {
			queueTime: Date.now(),
			running: false,
			callName,
			args,
			options,
			sendOptions,
			reject,
			resolve,
		}
		meteorMethodQueue.push(queuedMethod)
		checkMethodQueue()
	})
}
const meteorMethodQueue: QueuedMeteorMethod[] = []

function checkMethodQueue() {
	const nextMethod = meteorMethodQueue[0]
	if (!nextMethod) return
	if (!nextMethod.running) {
		// Time to send the method
		nextMethod.running = true

		const sendTime = Date.now()
		const timeBetweenTriggerAndSend = sendTime - nextMethod.queueTime
		if (timeBetweenTriggerAndSend > (nextMethod.sendOptions?.warnSendTime ?? 1000)) {
			logWarning(
				`Method "${
					nextMethod.callName
				}" was sent ${timeBetweenTriggerAndSend}ms after it was triggered (at ${new Date().toISOString()})`
			)
		}

		Meteor.apply(nextMethod.callName, nextMethod.args, nextMethod.options, (err, res) => {
			meteorMethodQueue.shift()
			setTimeout(() => {
				checkMethodQueue()
			}, 0)

			const completeTime = Date.now()
			const timeBetweenSendAndComplete = completeTime - sendTime
			if (timeBetweenSendAndComplete > (nextMethod.sendOptions?.warnCompleteTime ?? 1000)) {
				logWarning(
					`Method "${
						nextMethod.callName
					}" was completed ${timeBetweenSendAndComplete}ms after it was sent (at ${new Date().toISOString()})`
				)
			}

			if (err) {
				nextMethod.reject(err)
			} else {
				nextMethod.resolve(res)
			}
		})
	}
}

let loggedWarningCount = 0
let tooManyWarnings = false
let skippedWarningCount = 0
const MAX_LOG_COUNT = 10
const SKIP_WARNING_COOL_DOWN = 60 * 5 // seconds
function logWarning(message: string) {
	if (!tooManyWarnings) {
		loggedWarningCount++

		if (loggedWarningCount > MAX_LOG_COUNT) {
			// To avoid a flood of warnings (which, when sent to server via a method call, can cause slowness itself),
			// we will only log the first {MAX_LOG_COUNT} warnings, and then ignore further warnings for a while.

			logger.warn(
				`Has logged too many warnings (${loggedWarningCount}) about late Meteor methods. Will ignore further warnings for ${SKIP_WARNING_COOL_DOWN} seconds.`
			)
			tooManyWarnings = true
			setTimeout(() => {
				if (skippedWarningCount > 0) {
					logger.warn(
						`Will start logging warnings about late Meteor methods again. (Ignored ${skippedWarningCount} warnings.)`
					)
				}
				tooManyWarnings = false
				skippedWarningCount = 0
				loggedWarningCount = 0
			}, SKIP_WARNING_COOL_DOWN * 1000)
		} else {
			logger.warn(message)
		}
	} else {
		// Ignore the warning
		skippedWarningCount++
	}
}
// Clear the warning count every hour, just to avoid
setInterval(() => {
	if (!tooManyWarnings) {
		loggedWarningCount = 0
	}
}, 3600 * 1000)

interface QueuedMeteorMethod {
	callName: Parameters<typeof Meteor.apply>[0]
	args: Parameters<typeof Meteor.apply>[1]
	options?: Parameters<typeof Meteor.apply>[2]

	reject: (reason: any) => void
	resolve: (value: unknown) => void

	sendOptions?: SendOptions

	queueTime: number
	running: boolean
}
export interface SendOptions {
	/** Log a warning if the method was sent later than this time. Defaults to 1000. [milliseconds] */
	warnSendTime?: number
	/** Log a warning if the method was completed later than this time. Defaults to 1000. [milliseconds] */
	warnCompleteTime?: number
}

// @ts-expect-error hack for dev
window.MeteorApply = MeteorApply
