import { deferAsync, getCurrentTime } from './lib/lib'
import { logger } from './logging'
import { sendTrace } from './api/integration/influx'
import { PeripheralDevices } from './collections'
import { MetricsGauge } from '@sofie-automation/corelib/dist/prometheus'

const connections = new Set<string>()
const connectionsGauge = new MetricsGauge({
	name: `sofie_meteor_ddp_connections_total`,
	help: 'Number of open ddp connections',
})

/**
 * Track a newly-opened DDP connection (from either Meteor's built-in server or the standalone DDP
 * server). Updates the open-connection metrics.
 */
export function trackConnectionOpen(connectionId: string, clientAddress: string): void {
	// This is called whenever a new ddp-connection is opened (ie a web-client or a peripheral-device)
	connections.add(connectionId)
	logger.debug(`Client connected: "${connectionId}", "${clientAddress}"`)
	traceConnections()
}

/**
 * Track a closed DDP connection. Updates metrics, and marks any PeripheralDevices that were bound to this
 * connection (and their children) as offline.
 */
export function trackConnectionClose(connectionId: string, clientAddress: string): void {
	connections.delete(connectionId)
	logger.debug(`Client disconnected: "${connectionId}", "${clientAddress}"`)
	traceConnections()

	if (!connectionId) return

	deferAsync(async () => {
		const devices = await PeripheralDevices.findFetchAsync({
			connectionId: connectionId,
		})

		for (const device of devices) {
			// set the status of the machine to offline:

			await PeripheralDevices.updateAsync(device._id, {
				$set: {
					lastSeen: getCurrentTime(),
					connected: false,
					// connectionId: ''
				},
			})
			await PeripheralDevices.updateAsync(
				{
					parentDeviceId: device._id,
				},
				{
					$set: {
						lastSeen: getCurrentTime(),
						connected: false,
						// connectionId: ''
					},
				},
				{ multi: true }
			)
		}
	})
}

let logTimeout: NodeJS.Timeout | undefined = undefined
function traceConnections() {
	connectionsGauge.set(connections.size)

	if (logTimeout) {
		clearTimeout(logTimeout)
	}
	logTimeout = setTimeout(() => {
		logTimeout = undefined
		logger.debug(`Connection count: ${connections.size}`)

		sendTrace({
			measurement: 'connectionCount',
			timestamp: Date.now(),
			fields: {
				connections: connections.size,
			},
		})
	}, 1000)
}

export async function markAllPeripheralDevicesOffline(): Promise<void> {
	// Reset the connection status of the devices

	await PeripheralDevices.updateAsync(
		{
			connected: true,
			lastSeen: { $lt: getCurrentTime() - 60 * 1000 },
		},
		{
			$set: {
				connected: false,
			},
		},
		{ multi: true }
	)
}
