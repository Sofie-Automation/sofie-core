import { StatusResponse, NewSystemStatusAPI } from '@sofie-automation/meteor-lib/dist/api/systemStatus'
import { getDebugStates, getSystemStatus } from './systemStatus'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { MethodContextAPI } from '../api/methodContext'
import { profiler } from '../api/profiler'
import { PeripheralDeviceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { PrometheusHTTPContentType, getPrometheusMetricsString } from '@sofie-automation/corelib/dist/prometheus'
import { collectWorkerPrometheusMetrics } from '../worker/worker'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import { bindKoaRouter } from '../api/rest/koa'

const apmNamespace = 'http'

export const metricsRouter = new KoaRouter()
export const healthRouter = new KoaRouter()

metricsRouter.get('/', async (ctx) => {
	const transaction = profiler.startTransaction('metrics', apmNamespace)
	try {
		ctx.response.type = PrometheusHTTPContentType

		const [meteorMetrics, workerMetrics] = await Promise.all([
			getPrometheusMetricsString(),
			collectWorkerPrometheusMetrics(),
		])

		ctx.body = [meteorMetrics, ...workerMetrics].join('\n\n')
	} catch (ex) {
		ctx.response.status = 500
		ctx.body = ex + ''
	}
	transaction?.end()
})

healthRouter.get('/', async (ctx) => {
	const transaction = profiler.startTransaction('health', apmNamespace)
	const status = await getSystemStatus(ctx)
	health(status, ctx)
	transaction?.end()
})

healthRouter.get('/:studioId', async (ctx) => {
	const transaction = profiler.startTransaction('health', apmNamespace)
	const status = await getSystemStatus(ctx, protectString(ctx.params.studioId))
	health(status, ctx)
	transaction?.end()
})

function health(status: StatusResponse, ctx: Koa.ParameterizedContext) {
	ctx.response.type = 'application/json'

	ctx.response.status = status.status === 'OK' || status.status === 'WARNING' ? 200 : 500

	ctx.body = JSON.stringify(status)
}

export class ServerSystemStatusAPI extends MethodContextAPI implements NewSystemStatusAPI {
	async getSystemStatus(): Promise<StatusResponse> {
		return getSystemStatus(this.connection)
	}

	async getDebugStates(peripheralDeviceId: PeripheralDeviceId): Promise<object> {
		return getDebugStates(this, peripheralDeviceId)
	}
}

export function bindSystemStatusRouter(): void {
	bindKoaRouter(metricsRouter, '/metrics')
	bindKoaRouter(healthRouter, '/health')
}
