import { MetricsCounter, MetricsGauge, MetricsHistogram } from '@sofie-automation/server-core-integration'

export const playoutDevicesTotalGauge = new MetricsGauge({
	name: 'sofie_playout_gateway_devices_total',
	help: 'Total number of TSR devices under management',
})

export const playoutDeviceConnectedGauge = new MetricsGauge({
	name: 'sofie_playout_gateway_device_connected',
	help: 'Whether a TSR device is connected (1) or not (0)',
	labelNames: ['device_id', 'device_type'] as const,
})

export const playoutResolveDurationHistogram = new MetricsHistogram({
	name: 'sofie_playout_gateway_resolve_duration_seconds',
	help: 'Time spent resolving the timeline, in seconds',
	buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
})

export const playoutTimelineAgeGauge = new MetricsGauge({
	name: 'sofie_playout_gateway_timeline_age_seconds',
	help: 'Age of the timeline at the moment it finished resolving, measured from when Sofie Core generated it',
})

export const playoutSlowSentCommandsCounter = new MetricsCounter({
	name: 'sofie_playout_gateway_slow_sent_commands_total',
	help: 'Number of commands that were slow to be sent',
	labelNames: ['device_id', 'device_type'] as const,
})

export const playoutSlowFulfilledCommandsCounter = new MetricsCounter({
	name: 'sofie_playout_gateway_slow_fulfilled_commands_total',
	help: 'Number of commands that were slow to be fulfilled by the device',
	labelNames: ['device_id', 'device_type'] as const,
})

export const playoutCommandErrorsCounter = new MetricsCounter({
	name: 'sofie_playout_gateway_command_errors_total',
	help: 'Number of commands that resulted in an error',
	labelNames: ['device_id', 'device_type'] as const,
})

export const playoutCommandsSentCounter = new MetricsCounter({
	name: 'sofie_playout_gateway_commands_sent_total',
	help: 'Number of commands sent to devices (only increments when reportAllCommands is enabled per device)',
	labelNames: ['device_id', 'device_type'] as const,
})

export const playoutPlaybackCallbacksCounter = new MetricsCounter({
	name: 'sofie_playout_gateway_playback_callbacks_total',
	help: 'Number of playback timeline callbacks received from TSR',
	labelNames: ['type'] as const,
})
