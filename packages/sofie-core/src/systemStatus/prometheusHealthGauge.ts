import { MetricsGauge } from '@sofie-automation/corelib/dist/prometheus'
import { getSystemStatus } from './systemStatus'

export const healthGauge = new MetricsGauge({
	name: 'sofie_health_status',
	help: 'Health status of Sofie application and its components',
	labelNames: ['name', 'version'] as const,
	async collect() {
		const systemStatus = await getSystemStatus(null)

		const statusValues = { OK: 0, FAIL: 1, WARNING: 2, UNDEFINED: 3 }
		this.labels({
			name: systemStatus.name,
			version: systemStatus._internal.versions['core'],
		}).set(statusValues[systemStatus.status])

		systemStatus.components?.forEach((c) => {
			this.labels({
				name: c.name,
				version: c._internal.versions['_process'] ?? '',
			}).set(statusValues[c.status])
		})
	},
})
