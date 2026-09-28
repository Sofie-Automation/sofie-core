/* eslint-disable @typescript-eslint/no-require-imports */

import { vi } from 'vitest'
import './_extendJest.js'

// This file is run before all tests start.

// Mock random ids to be predictable. Imports have to be relative, not via package nmmes for some reason..
vi.mock('nanoid')

vi.mock('../lib/time.js', (...args) => require('./time').setup(args))

vi.mock('../events/integration/rabbitMQ.js', (...args) => require('./rabbitMQ').setup(args))
vi.mock('../events/integration/slack.js', (...args) => require('./slack').setup(args))
