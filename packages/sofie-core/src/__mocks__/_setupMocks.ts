import { beforeEach, afterEach, vi } from 'vitest'
import { setLogLevel } from '../logging'
import { resetRandomId } from './random'
import { LogLevel } from '@sofie-automation/meteor-lib/dist/lib'
import { SupressLogMessages } from './suppressLogging'

// This file is run before all tests start.

// 'Mock' the random string generator
// eslint-disable-next-line n/file-extension-in-import -- dynamic import() in a commonjs package needs the extension
vi.mock('nanoid', async () => (await import('./random.js')).setup())

// Mock the ntp client, so that determineDiffTime doesn't use the network. jest applied this automatically from
// src/api/__mocks__, vitest needs it to be explicit. The module object is copied, as systemTime assigns to it
// eslint-disable-next-line n/file-extension-in-import -- dynamic import() in a commonjs package needs the extension
vi.mock('ntp-client', async () => ({ default: { ...(await import('../api/__mocks__/ntp-client.js')) } }))

// eslint-disable-next-line n/file-extension-in-import -- dynamic import() in a commonjs package needs the extension
vi.mock('../api/integration/slack', async () => (await import('./slack.js')).setup())
// eslint-disable-next-line n/file-extension-in-import -- dynamic import() in a commonjs package needs the extension
vi.mock('../worker/worker', async () => (await import('./worker.js')).setup())

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
