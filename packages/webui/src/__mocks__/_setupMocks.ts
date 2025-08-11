/* eslint-disable @typescript-eslint/no-require-imports */
import { resetRandomId } from './random.js'

// This file is run before all tests start.

// 'Mock' the random string generator
jest.mock('nanoid', (...args) => require('./random').setup(args), { virtual: true })

// Add references to all "meteor" mocks below, so that jest resolves the imports properly.

jest.mock('meteor/meteor', (...args) => require('./meteor').setup(args), { virtual: true })
jest.mock('meteor/tracker', (...args) => require('./tracker').setup(args), { virtual: true })
// jest.mock('meteor/ejson', (...args) => require('./ejson').setup(args), { virtual: true })
// jest.mock('meteor/reactive-var', (...args) => require('./reactive-var').setup(args), { virtual: true })

jest.mock('meteor/mongo', (...args) => require('./mongo').setup(args), { virtual: true })

beforeEach(() => {
	// put setLogLevel('info') in the beginning of your test to see logs

	resetRandomId()
})
