import { beforeEach, afterEach, vi } from 'vitest'
import { setLogLevel } from '../logging'
import { resetRandomId } from './random'
import { LogLevel } from '@sofie-automation/meteor-lib/dist/lib'
import { SupressLogMessages } from './suppressLogging'

// This file is run before all tests start.

// 'Mock' the random string generator
vi.mock('nanoid', async () => (await import('./random')).setup())

// Add references to all "meteor" mocks below, so that jest resolves the imports properly.

vi.mock('../api/integration/slack', async () => (await import('./slack')).setup())
vi.mock('../worker/worker', async () => (await import('./worker')).setup())

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
