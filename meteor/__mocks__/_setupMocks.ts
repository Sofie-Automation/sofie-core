import { setLogLevel } from '../server/logging'
import { resetRandomId } from './random'
import { LogLevel } from '@sofie-automation/meteor-lib/dist/lib'
import { SupressLogMessages } from './suppressLogging'

// This file is run before all tests start.

// 'Mock' the random string generator
jest.mock('nanoid', (...args) => require('./random').setup(args), { virtual: true })

// Add references to all "meteor" mocks below, so that jest resolves the imports properly.

jest.mock('../server/api/integration/slack', (...args) => require('./slack').setup(args), { virtual: true })
jest.mock('../server/worker/worker', (...args) => require('./worker').setup(args), { virtual: true })

SupressLogMessages.init()

beforeEach(() => {
	setLogLevel(LogLevel.WARN)
	// put setLogLevel('info') in the beginning of your test to see logs

	resetRandomId()
})
afterEach(() => {
	// Expect all log messages that have been explicitly supressed, to have been handled:
	SupressLogMessages.expectAllMessagesToHaveBeenHandled()
})
