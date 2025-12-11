import Agent from 'elastic-apm-node'
import { logger } from './logging.js'

let active = false
export function setupApmAgent(): void {
	if (process.env.JEST_WORKER_ID) {
		return
	}

	const { APM_HOST, APM_SECRET, APM_ENABLE, KIBANA_INDEX, APP_HOST } = process.env

	if (APM_ENABLE && APM_HOST) {
		logger.info(`APM agent starting up`)
		Agent.start({
			serviceName: KIBANA_INDEX || 'tv-automation-server-core',
			hostname: APP_HOST,
			serverUrl: APM_HOST,
			secretToken: APM_SECRET,
			active: true,
			transactionSampleRate: 1, // system.apm.transactionSampleRate,
		})
		active = true // TODO - based on coreSystem field
	} else {
		logger.info(`APM agent inactive`)
		Agent.start({
			serviceName: KIBANA_INDEX || 'tv-automation-server-core',
			active: false,
		})
	}
}

// Re-export types with better names
export type ApmTransaction = Agent.Transaction
export type ApmSpan = Agent.Span

/**
 * Start an Apm Transaction
 * This should only be necessary at the outer scope, before the job handler gets executed
 */
export function startTransaction(name: string, namespace: string): ApmTransaction | undefined {
	if (!active) return undefined
	return Agent.startTransaction(name, namespace) ?? undefined
}

/**
 * Start an Apm Span without a reference to the transaction
 * Useful for lib code which does not have access to a JobContext
 * Note: a startSpan is also available on the JobContext type
 */
export function startSpanManual(name: string): ApmSpan | undefined {
	if (!active) return undefined
	return Agent.startSpan(name) ?? undefined
}
