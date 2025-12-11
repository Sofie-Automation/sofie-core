/* eslint-disable @typescript-eslint/no-require-imports */

import './_extendJest.js'

// This file is run before all tests start.

// Mock random ids to be predictable. Imports have to be relative, not via package nmmes for some reason..
jest.mock('nanoid')

jest.mock('../lib/time.js', (...args) => require('./time').setup(args), {
	virtual: true,
})

jest.mock('../events/integration/rabbitMQ.js', (...args) => require('./rabbitMQ').setup(args), { virtual: true })
jest.mock('../events/integration/slack.js', (...args) => require('./slack').setup(args), { virtual: true })
