# Sofie: The Modern TV News Studio Automation System (Server Core Integration)

[![npm](https://img.shields.io/npm/v/@sofie-automation/server-core-integration)](https://www.npmjs.com/package/@sofie-automation/server-core-integration)

This library is used to connect to the [**Sofie Server Core**](https://github.com/Sofie-Automation/sofie-core) from other Node processes.

This is a part of the [**Sofie** TV News Studio Automation System](https://github.com/Sofie-Automation/Sofie-TV-automation/).

Note: This library does not follow semver. It is recommended to add it in your package json like `"@sofie-automation/server-core-integration": "~1.16.0"` matching the version of sofie core you are running

# Getting started

## Typescript

```typescript
import { CoreConnection, PeripheralDeviceAPI } from '@sofie-automation/server-core-integration'

// Set up our basic credentials:
let core = new CoreConnection({
	deviceId: 'device01', // Unique id
	deviceToken: 'mySecretToken', // secret token, used to authenticate this device
	deviceType: PeripheralDeviceAPI.DeviceType.PLAYOUT,
	deviceName: 'My peripheral device',
})
core.on('error', console.log)
// Initiate connection to Core:
core
	.init({
		host: '127.0.0.1',
		port: 3000,
	})
	.then(() => {
		// Connection has been established
		console.log('Connected!')
		// Set device status:
		return core.setStatus({
			statusCode: PeripheralDeviceAPI.StatusCode.GOOD,
			messages: ['Everything is awesome!'],
		})
	})
	.catch((err) => {
		console.log(err)
	})
```

## Development

This library is developed as part of [Sofie Server Core](https://github.com/Sofie-Automation/sofie-core). See there for more instructions

- Build
  - Build, `yarn build`
  - Run tests, `yarn test`
  - Run tests & watch, `yarn watch`

## DDP Client

This library has a self-contained DDP client that can be used independently of the rest of the module.

```typescript
import { DDPClient, DDPConnectorOptions } from '@sofie-automation/server-integration'

let options: DDPConnectorOptions = {
	host: '127.0.0.1',
	port: 5432
}

let ddp = new DDPClient(options)
ddp.on('connected', /* ... */ )
ddp.connect((err: any) => {
	if (err) {
		/* ... handle error ... */
		return
	}
	let subId = ddp.subscribe('expectedMediaItems')
	ddp.observe('expectedMediaItems', /* added cb */, /* changed cb */, /* removed cb */)

	/* ... then later ... */
	ddp.unsub(subId)
	ddp.close()
})
```

See the documentation on the [DDP client class](./docs/classes/ddpclient.html) for more details.
