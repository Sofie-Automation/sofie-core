import { setLogLevel } from '../logging'
import { resetRandomId } from './random'
import { LogLevel } from '@sofie-automation/meteor-lib/dist/lib'
import { SupressLogMessages } from './suppressLogging'

// This file is run before all tests start.

// 'Mock' the random string generator
jest.mock('nanoid', (...args) => require('./random').setup(args), { virtual: true })

// Add references to all "meteor" mocks below, so that jest resolves the imports properly.

jest.mock('../api/integration/slack', (...args) => require('./slack').setup(args), { virtual: true })
jest.mock('../worker/worker', (...args) => require('./worker').setup(args), { virtual: true })

// The job worker's clock, as the job worker's own tests mock it, so that a test driving its jobs sets the time of each
// job. Until a test sets a time it reads the real clock
jest.mock('@sofie-automation/job-worker/dist/lib/time', (...args) =>
	require('../../../job-worker/src/__mocks__/time').setup(args)
)

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
