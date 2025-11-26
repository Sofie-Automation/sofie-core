import { Logger } from 'winston'
import * as fs from 'fs'
import { ProcessConfig } from './connector.js'

export class Process {
	logger: Logger

	public certificates: Buffer[] = []

	constructor(logger: Logger) {
		this.logger = logger
	}
	init(processConfig: ProcessConfig): void {
		if (processConfig.unsafeSSL) {
			this.logger.info('Disabling NODE_TLS_REJECT_UNAUTHORIZED, be sure to ONLY DO THIS ON A LOCAL NETWORK!')
			process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0'
		}

		if (processConfig.certificates.length) {
			this.logger.info(`Loading certificates...`)
			for (const certificate of processConfig.certificates) {
				try {
					this.certificates.push(fs.readFileSync(certificate))
					this.logger.info(`Using certificate "${certificate}"`)
				} catch (error) {
					this.logger.error(`Error loading certificate "${certificate}"`, error)
				}
			}
		}
	}
}
