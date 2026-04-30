import Koa from 'koa'
import Router from '@koa/router'
import { StatusCode } from '@sofie-automation/shared-lib/dist/lib/status'
import { assertNever } from '@sofie-automation/shared-lib/dist/lib/lib'
import { IConnector, ICoreHandler } from './gateway-types.js'
import { getPrometheusMetricsString, PrometheusHTTPContentType, setupPrometheusMetrics } from './prometheus.js'

export interface HealthConfig {
	/** If set, exposes health HTTP endpoints on the given port */
	port?: number
}

/**
 * Exposes health endpoints for Kubernetes or other orchestrators to monitor
 * see https://kubernetes.io/docs/concepts/configuration/liveness-readiness-startup-probes
 */
export class HealthEndpoints {
	private app = new Koa()
	constructor(
		private connector: IConnector,
		private coreHandler: ICoreHandler,
		private config: HealthConfig,
		private customMetrics?: () => Promise<string[]>
	) {
		if (!config.port) return // disabled

		// Setup default prometheus metrics when endpoints are enabled
		setupPrometheusMetrics()

		const router = new Router()

		router.get('/healthz', async (ctx) => {
			if (this.connector.initializedError !== undefined) {
				ctx.status = 503
				ctx.body = `Error during initialization: ${this.connector.initializedError}`
				return
			}
			if (!this.connector.initialized) {
				ctx.status = 503
				ctx.body = 'Not initialized'
				return
			}

			const coreStatus = this.coreHandler.getCoreStatus()

			if (coreStatus.statusCode === StatusCode.UNKNOWN) ctx.status = 503
			else if (coreStatus.statusCode === StatusCode.FATAL) ctx.status = 503
			else if (coreStatus.statusCode === StatusCode.BAD) ctx.status = 503
			else if (coreStatus.statusCode === StatusCode.WARNING_MAJOR) ctx.status = 200
			else if (coreStatus.statusCode === StatusCode.WARNING_MINOR) ctx.status = 200
			else if (coreStatus.statusCode === StatusCode.GOOD) ctx.status = 200
			else assertNever(coreStatus.statusCode)

			if (ctx.status !== 200) {
				const messages = coreStatus.statusDetails.map((d) => d.message).join(', ')
				ctx.body = `Status: ${StatusCode[coreStatus.statusCode]}, messages: ${messages}`
			} else {
				ctx.body = 'OK'
			}
		})

		router.get('/readyz', async (ctx) => {
			if (!this.coreHandler.connectedToCore) {
				ctx.status = 503
				ctx.body = 'Not connected to Core'
				return
			}
			// else
			ctx.status = 200
			ctx.body = 'READY'
		})

		router.get('/metrics', async (ctx) => {
			try {
				ctx.response.type = PrometheusHTTPContentType

				const [meteorMetrics, workerMetrics] = await Promise.all([
					getPrometheusMetricsString(),
					this.customMetrics?.(),
				])

				ctx.body = [meteorMetrics, ...(workerMetrics || [])].join('\n\n')
			} catch (ex) {
				ctx.response.status = 500
				ctx.body = ex + ''
			}
		})

		this.app.use(router.routes()).use(router.allowedMethods())
		this.app.listen(this.config.port)
	}
}
