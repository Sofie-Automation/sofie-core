import Koa from 'koa'
import Router from '@koa/router'
import { StatusCode } from '@sofie-automation/shared-lib/dist/lib/status'
import { assertNever } from '@sofie-automation/shared-lib/dist/lib/lib'
import { IConnector, ICoreHandler } from './gateway-types.js'

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
		private config: HealthConfig
	) {
		if (!config.port) return // disabled

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
				ctx.body = `Status: ${StatusCode[coreStatus.statusCode]}, messages: ${coreStatus.messages.join(', ')}`
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

		this.app.use(router.routes()).use(router.allowedMethods())
		this.app.listen(this.config.port)
	}
}
