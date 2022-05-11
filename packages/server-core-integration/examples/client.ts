import { CoreConnection } from '../src/index'
import { PeripheralDeviceAPI as P } from '../src/lib/corePeripherals'

const core = new CoreConnection({
	deviceId: 'ExampleDevice',
	deviceToken: 'abcd',
	deviceCategory: P.DeviceCategory.PLAYOUT,
	deviceType: P.DeviceType.PLAYOUT,
	deviceName: 'Jest test framework',
})

core.onConnectionChanged((connected) => {
	console.log('onConnectionChanged', connected)
})
core.onConnected(() => {
	console.log('onConnected!')

	setupSubscription().catch((e) => {
		console.error(`Failed to setup sub`, e)
	})
})
core.onDisconnected(() => {
	console.log('onDisconnected!')
})
core.onError((err) => {
	console.log('onError: ' + (typeof err === 'string' ? err : err.message || err.toString() || err))
})
core.onFailed((err) => {
	console.log('onFailed: ' + (err.message || err.toString() || err))
})

const setupSubscription = async () => {
	console.log('Setup subscription')
	return core
		.subscribe('peripheralDevices', {
			_id: core.deviceId,
		})
		.then(() => {
			console.log('sub OK!')
		})
}
const setupObserver = () => {
	console.log('Setup observer')
	const observer = core.observe('peripheralDevices')
	observer.added = (id) => {
		console.log('added', id)
	}
	observer.changed = (id) => {
		console.log('changed', id)
	}
	observer.removed = (id) => {
		console.log('removed', id)
	}
}
// Initiate connection to Core:

const setup = async () => {
	try {
		console.log('init...')
		await core.init({
			host: '127.0.0.1',
			port: 3000,
		})
		console.log('init!')

		await core.setStatus({
			statusCode: P.StatusCode.GOOD,
			messages: [''],
		})

		setupObserver()

		await setupSubscription()

		setTimeout(() => {
			console.log('updating status')
			core.setStatus({
				statusCode: P.StatusCode.GOOD,
				messages: ['a'],
			}).catch((e) => {
				console.error(`Failed to set status`, e)
			})
		}, 500)

		setTimeout(() => {
			console.log('closing socket')
			core.ddp.ddpClient?.socket?.close()
		}, 1500)

		setTimeout(() => {
			console.log('updating status')
			core.setStatus({
				statusCode: P.StatusCode.GOOD,
				messages: ['b'],
			}).catch((e) => {
				console.error(`Failed to set status`, e)
			})
		}, 3500)
	} catch (e) {
		console.log('ERROR ===========')
		console.log(e)
	}
}

setup().catch((e) => {
	console.error(`Failed to setup`, e)
})
// .then(() => {
// 	core.setStatus({
// 		statusCode: P.StatusCode.GOOD,
// 		messages: ['Testing example']
// 	})
// })
// .then(() => {
// 	setTimeout(() => {
// 		console.log('== closing connection..')

// 		core.ddp.ddpClient.socket.close()
// 	},1000)
// })
// .then(() => {
// 	console.log('waiting for connection...')
// 	setTimeout(() => {
// 		console.log('too late...')
// 	},10000)
// })
