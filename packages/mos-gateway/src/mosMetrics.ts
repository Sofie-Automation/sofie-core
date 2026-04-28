import {
	MetricsCounter,
	MetricsGauge,
} from '@sofie-automation/server-core-integration/dist/lib/prometheus'

export const mosDevicesTotalGauge = new MetricsGauge({
	name: 'sofie_mos_gateway_devices_total',
	help: 'Number of configured MOS sub-devices',
})

export const mosDeviceConnectedGauge = new MetricsGauge({
	name: 'sofie_mos_gateway_device_connected',
	help: 'Connection status of a MOS device (1 = connected, 0 = disconnected)',
	labelNames: ['device_id', 'connection'] as const,
})

export const mosMessagesReceivedCounter = new MetricsCounter({
	name: 'sofie_mos_gateway_messages_received_total',
	help: 'Total number of MOS commands received from the NRCS',
	labelNames: ['device_id', 'command'] as const,
})

export const mosMessagesFailedCounter = new MetricsCounter({
	name: 'sofie_mos_gateway_messages_failed_total',
	help: 'Total number of MOS commands that failed when forwarding to Core',
	labelNames: ['device_id', 'command'] as const,
})

export const mosQueueDepthGauge = new MetricsGauge({
	name: 'sofie_mos_gateway_queue_depth',
	help: 'Number of MOS commands currently waiting in the Core-forwarding queue',
	labelNames: ['device_id'] as const,
})

export const mosStatusSentCounter = new MetricsCounter({
	name: 'sofie_mos_gateway_status_sent_total',
	help: 'Total number of story/item status messages sent back to the NRCS',
	labelNames: ['device_id', 'status_type', 'mos_status'] as const,
})

export const mosStatusSkippedCounter = new MetricsCounter({
	name: 'sofie_mos_gateway_status_skipped_total',
	help: 'Total number of story/item status updates that were skipped',
	labelNames: ['device_id', 'reason'] as const,
})

export const mosStatusQueueDepthGauge = new MetricsGauge({
	name: 'sofie_mos_gateway_status_queue_depth',
	help: 'Number of status write-back operations currently waiting in the queue',
	labelNames: ['device_id'] as const,
})
