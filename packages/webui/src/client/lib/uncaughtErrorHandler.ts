import { Meteor } from 'meteor/meteor'
import { Tracker } from 'meteor/tracker'
import { Time } from '@sofie-automation/blueprints-integration'
import { getCurrentTime } from './systemTime.js'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'
import { MeteorCall } from '../lib/meteorApi.js'

interface LoggedError {
	location: string
	stringContent: string
	added: Time
}

let errorCache: Array<LoggedError> = []
const MAX_ERROR_CACHE_COUNT = 10

try {
	errorCache = JSON.parse(localStorage.getItem('errorCache') || '[]')
} catch (_e) {
	errorCache = []
}

function sendErrorToCore(errorLog: LoggedError) {
	MeteorCall.client
		.clientErrorReport(errorLog.added, errorLog.stringContent, errorLog.location)
		.then(() => {
			const sentIdx = errorCache.indexOf(errorLog)
			if (sentIdx >= 0) {
				errorCache.splice(sentIdx, 1)
			}
			localStorage.setItem('errorCache', JSON.stringify(errorCache))
		})
		.catch(() => {
			// fail silently, so that we don't erase useful logs with multiple 'failed to send' messages
			return
		})
}

function uncaughtErrorHandler(errorObj: any, context: string) {
	if (!errorObj) return // Nothing to report..

	// To get the textual content of Error('my Error')
	let stringContent = `${context}: `
	if (Array.isArray(errorObj)) {
		stringContent += errorObj.map((err) => stringifyError(err)).join(',')
	} else {
		stringContent += stringifyError(errorObj)
	}

	// Ignore any react deprecation warnings, as they add a lot of noise
	if (stringContent.includes('will be removed in the next major release')) return

	const caughtErrorStack = new Error('')
	if (caughtErrorStack.stack) {
		stringContent += `\nCaught stack: ${caughtErrorStack.stack}`
	}

	const errorLog: LoggedError = {
		location: window.location.href,
		stringContent: stringContent,
		added: getCurrentTime(),
	}

	errorCache.push(errorLog)

	if (errorCache.length > MAX_ERROR_CACHE_COUNT) {
		errorCache.shift()
	}

	localStorage.setItem('errorCache', JSON.stringify(errorCache))

	// Send the error to the server, for logging:
	if (Meteor.status().connected) {
		sendErrorToCore(errorLog)
	}
}

const originalConsoleError = console.error
console.error = (...args: any[]) => {
	try {
		uncaughtErrorHandler(args, 'console.error')
	} catch (_e) {
		// well, we can't do much then...
	}
	originalConsoleError(...args)
}

const IGNORED_ERRORS = [
	// This error is benign. https://stackoverflow.com/questions/49384120/resizeobserver-loop-limit-exceeded
	'ResizeObserver loop limit exceeded',
	// This error is benign. https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver#observation_errors
	'ResizeObserver loop completed with undelivered notifications',
].map((error) => new RegExp(error, 'i'))

const originalOnError = window.onerror
window.onerror = (event, source, line, col, error) => {
	if (event) {
		// eslint-disable-next-line @typescript-eslint/no-base-to-string
		const eventString = event.toString()
		const ignored = IGNORED_ERRORS.find((errorPattern) => !!eventString.match(errorPattern))
		if (ignored) return
	}

	const errorObj: any = {
		type: 'window.onerror',
		event,
		source,
		line,
		col,
		error,
	}

	try {
		uncaughtErrorHandler(errorObj, 'window.onerror')
	} catch (e) {
		// well, we can't do much if THAT goes wrong...
		console.log('Error when trying to report an error', e, 'Original error', errorObj)
	}
	if (originalOnError) {
		originalOnError(event, source, line, col, error)
	}
}

Meteor.startup(() => {
	let resendNextAutorun = false

	Tracker.autorun(() => {
		if (!Meteor.status().connected) {
			resendNextAutorun = true
		} else if (Meteor.status().connected && resendNextAutorun) {
			resendNextAutorun = false
			const copy = errorCache.concat()
			copy.forEach((item) => sendErrorToCore(item))
		}
	})
})
