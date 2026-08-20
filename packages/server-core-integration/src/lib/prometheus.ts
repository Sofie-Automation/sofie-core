import { register, collectDefaultMetrics } from 'prom-client'

// Re-export types, to ensure the correct 'instance' of 'prom-client' is used
export {
	Gauge as MetricsGauge,
	Counter as MetricsCounter,
	Histogram as MetricsHistogram,
	Summary as MetricsSummary,
} from 'prom-client'

/**
 * HTTP Content-type header for the metrics
 */
export const PrometheusHTTPContentType = register.contentType

/**
 * Stringified metrics for serving over HTTP
 */
export async function getPrometheusMetricsString(): Promise<string> {
	return register.metrics()
}

/**
 * Setup metric reporting for this app
 */
export function setupPrometheusMetrics(): void {
	// Label all metrics with the source 'thread'
	// register.setDefaultLabels({
	// 	threadName: threadName,
	// })

	// Collect the default metrics nodejs metrics
	collectDefaultMetrics()
}
