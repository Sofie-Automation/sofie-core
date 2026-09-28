import { beforeEach, vi } from 'vitest'
import { resetRandomId } from './random.js'

// This file is run before all tests start.

// 'Mock' the random string generator
vi.mock('nanoid', async () => (await import('./random.js')).setup())

// Add references to all "meteor" mocks below, so that jest resolves the imports properly.

vi.mock('meteor/meteor', async () => (await import('./meteor.js')).setup())
vi.mock('meteor/tracker', async () => (await import('./tracker.js')).setup())
// vi.mock('meteor/ejson', async () => (await import('./ejson.js')).setup())
// vi.mock('meteor/reactive-var', async () => (await import('./reactive-var.js')).setup())

vi.mock('meteor/mongo', async () => (await import('./mongo.js')).setup())

beforeEach(() => {
	// put setLogLevel('info') in the beginning of your test to see logs

	resetRandomId()
})
