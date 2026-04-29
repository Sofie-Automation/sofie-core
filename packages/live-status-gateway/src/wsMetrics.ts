import { MetricsGauge } from '@sofie-automation/server-core-integration'

export const wsConnectionsGauge = new MetricsGauge({
	name: 'sofie_lsg_websocket_connections',
	help: 'Number of open WebSocket connections',
})

export const activeSubscriptionsGauge = new MetricsGauge({
	name: 'sofie_lsg_active_subscriptions_total',
	help: 'Total number of active subscriptions across all topics',
})

export const subscriptionSubscribersGauge = new MetricsGauge({
	name: 'sofie_lsg_subscription_subscribers',
	help: 'Number of subscribers per subscription',
	labelNames: ['subscription'] as const,
})
