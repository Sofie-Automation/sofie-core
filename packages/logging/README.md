# Sofie: The Modern TV News Studio Automation System (Logging library)

[![npm](https://img.shields.io/npm/v/@sofie-automation/logger)](https://www.npmjs.com/package/@sofie-automation/logger)

This is a part of the [**Sofie** TV News Studio Automation System](https://github.com/Sofie-Automation/Sofie-TV-automation/).

## What is it?

This is a thin wrapper around the LogTape library (https://logtape.org) with some Sofie-recommended defaults and restrictions.

The reason for using this package is:

- To have a unified logging setup across the Sofie Automation projects
- To ensure logs are easily parsable by log collectors such as Elasticsearch by avoiding logging arbitrary data structures.

## Usage

_Note: The official LogTape documentation applies to this as well, see https://logtape.org_

### In application: Configuration

#### Configure and initialize logging at startup

_It is mandatory that the application sets the configuration upon standup_

```typescript
import { loggingConfigureWithDefault, getDefaultConfiguration, loggingConfigure } from '@sofie-automation/logger'

await loggingConfigureWithDefault() // Sets up logging with Sofie-recommended defaults

// or:

await loggingConfigureWithDefault({
	logLevel: 'debug', // Set a log level
	logPath: '/var/logs/my-application', // Enable logging to disk
})

// or:

// This is equivalent to calling loggingConfigureWithDefault():
const config = getDefaultConfiguration()
await loggingConfigure(config)
```

#### Reconfigure logging at runtime

```typescript
import { loggingConfigureWithDefault } from '@sofie-automation/logger'

// Example: Change the log level:
await loggingConfigureWithDefault({
	reset: true, // Reset previous configuration
	logLevel: 'debug', // Set a log level
})

// Note: If you have a custom logging configuration, you have to instead modify modify it and pass it into loggingConfigure() again.
```

### Logging

```typescript
import { getLogger, SofieLogger } from '@sofie-automation/logger'

class MyLibraryClass {
	logger: SofieLogger
	constructor() {
		// Setup a logger for this class.
		// Set the category so that the origin of the logs can be identified:
		this.logger = getLogger(['my-library', 'MyLibraryClass'])
	}
	logAMessage() {
		logger.info('Hello world!')
	}
}
```

It is possible to provide the logger with additional context data.
By default, only the `data` field is allowed:

```typescript
const logger = getLogger(['my-test-category'])
logger.info('got some data', { data: myDataObject }) // The `data` field is always converted to JSON-string before logged.
```

If you want to log some custom data fields, you need to extend the SofieLogger type to allow those fields:

```typescript
declare module '@sofie-automation/logger' {
	interface SofieLoggerContext {
		userId?: string
		sessionId?: string
	}
}

const logger = getLogger(['my-test-category'])
logger.info('user logged in', {
	// These fields are now allowed:
	userId: 'user-1234',
	session: 'session-5678',
})
```

The reason for not allowing any data in the context (as is the LogTape way),
it turns out that logging arbitrary data structures can lead to issues with log collectors,
as they may not be able to parse and index all data structures correctly.

#### Inheritance and contextual loggers

```typescript
import { getLogger } from '@sofie-automation/logger'
declare module '@sofie-automation/logger' {
	interface SofieLoggerContext {
		userId?: string
	}
}

const parentLogger = getLogger('my-library')

// Example of creating a child logger with a sub-category:
const childLogger = parentLogger.getChild('child-category')
childLogger.info('This is from the child logger') // outputs category "my-library.child-category"

// Example of creating a contextual logger:
const withContextLogger = parentLogger.with({ userId: 'user-1234' })
withContextLogger.info('User did something') // outputs with userId in the log context
```

#### Advanced: Custom filters

An application may implement custom log filters, for example to omit logs from certain categories.

```typescript
import { getLogger, getDefaultConfiguration, loggingConfigure } from '@sofie-automation/logger'

const config = getDefaultConfiguration({
	reset: true,
	logLevel: 'debug', // debug and above
})

// Add a filter:
const filters = (config.filters = config.filters ?? {})
filters.myCustomFilter = (log) => {
	if (log.category.includes('special-category')) return false // Don't log this
	return true
}

// Assign the filter to all loggers:
config.loggers.forEach((logger) => (logger.filters = [...(logger.filters || []), 'myCustomFilter']))

await loggingConfigure(config)

const logger = getLogger('my-category')
const specialLogger = logger.getChild('special-category')

logger.info('This message will appear')
specialLogger.info('This message will NOT appear')
```
