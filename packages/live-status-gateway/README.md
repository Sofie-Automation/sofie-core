# Sofie Live Status Gateway

The Sofie Live Status Gateway is intended to be used to provide a **Stable API** that can **stream live updates** to external applications.

## For Developers

### Starting the gateway

`yarn start -id [SOME_ID_VALUE]` e.g. `yarn start -id live_status_gateway0`, \
or \
`yarn dev` which will set the id to `localDevLsg`.

### How to write an external application that interfaces with this gateway

Minimal example:

```js
const ws = new WebSocket(`ws://mysofie:8080`)
ws.addEventListener('message', (message) => {
	const data = JSON.parse(message.data)
	switch (data.event) {
		case 'pong':
			handlePong(data)
			break
		case 'heartbeat':
			handleHeartbeat(data)
			break
		case 'subscriptionStatus':
			handleSubscriptionStatus(data)
			break
		case 'studio':
			handleStudio(data)
			break
		case 'activePlaylist':
			handleActivePlaylist(data)
			break
	}
})

ws.addEventListener('open', () => {
	console.log('socket open')

	// subscribe to activePlaylist
	ws.send('{"event": "subscribe", "subscription": {"name": "activePlaylist" }, "reqid": 1}')
})

ws.addEventListener('close', () => {
	console.log('socket close')
})

ws.addEventListener('error', (error) => {
	console.log('socket error', error)
})
```

### Timing accuracy

The Live Status Gateway provides certain values in the form of timestamps, referencing both past and future events. These timestamps are particularly useful, for instance, in creating countdown timers. It's important to note that these values are relative to the system clock of the machine hosting Sofie Core.

For optimal accuracy, we strongly recommend that external systems and applications leveraging these timestamps implement a method for time synchronization. This synchronization should align with the same time source used by Sofie Core — whether at the operating system level (e.g., utilizing a system-wide NTP client) or at the application level.
