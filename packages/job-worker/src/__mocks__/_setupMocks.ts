import { vi } from 'vitest'
import './_extendJest.js'

// This file is run before all tests start.

// Mock random ids to be predictable.
// vitest doesn't automatically apply mocks for node_modules from src/__mocks__, so this needs an explicit factory
vi.mock('nanoid', async () => import('./nanoid.js'))

vi.mock('../lib/time.js', async () => (await import('./time.js')).setup())

vi.mock('../events/integration/rabbitMQ.js', async () => (await import('./rabbitMQ.js')).setup())
vi.mock('../events/integration/slack.js', async () => (await import('./slack.js')).setup())
