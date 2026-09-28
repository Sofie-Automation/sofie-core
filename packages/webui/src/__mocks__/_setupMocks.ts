/* eslint-disable @typescript-eslint/no-require-imports */
import { beforeEach, vi } from 'vitest'
import { resetRandomId } from './random.js'

// This file is run before all tests start.

// 'Mock' the random string generator
vi.mock('nanoid', (...args) => require('./random').setup(args))

// Add references to all "meteor" mocks below, so that jest resolves the imports properly.

vi.mock('meteor/meteor', (...args) => require('./meteor').setup(args))
vi.mock('meteor/tracker', (...args) => require('./tracker').setup(args))
// vi.mock('meteor/ejson', (...args) => require('./ejson').setup(args))
// vi.mock('meteor/reactive-var', (...args) => require('./reactive-var').setup(args))

vi.mock('meteor/mongo', (...args) => require('./mongo').setup(args))

beforeEach(() => {
	// put setLogLevel('info') in the beginning of your test to see logs

	resetRandomId()
})
