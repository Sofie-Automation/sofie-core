import { protectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import { StatusCode } from '@sofie-automation/shared-lib/dist/lib/status'
import {
	PeripheralDeviceCategory,
	PeripheralDeviceType,
} from '@sofie-automation/shared-lib/dist/peripheralDevice/peripheralDeviceAPI'
import { CoreConnection, PeripheralDevicePubSub, PeripheralDevicePubSubCollectionsNames } from '../src/index.js'

const core = new CoreConnection({
	deviceId: protectString('ExampleDevice'),
	deviceToken: 'abcd',
	deviceCategory: PeripheralDeviceCategory.PLAYOUT,
	deviceType: PeripheralDeviceType.PLAYOUT,
	deviceName: 'Jest test framework',
	documentationUrl: 'http://example.com',
	versions: {},
	configManifest: {} as any,
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
	return core.autoSubscribe(PeripheralDevicePubSub.peripheralDeviceForDevice, core.deviceId).then(() => {
		console.log('sub OK!')
	})
}
const setupObserver = () => {
	console.log('Setup observer')
	const observer = core.observe(PeripheralDevicePubSubCollectionsNames.peripheralDeviceForDevice)
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
			statusCode: StatusCode.GOOD,
			messages: [''],
		})

		setupObserver()

		await setupSubscription()

		setTimeout(() => {
			console.log('updating status')
			core.setStatus({
				statusCode: StatusCode.GOOD,
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
				statusCode: StatusCode.GOOD,
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
