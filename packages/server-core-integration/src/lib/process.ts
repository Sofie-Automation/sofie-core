import * as fs from 'fs'
import type { DDPTLSOptions } from './ddpClient.js'

export interface CertificatesConfig {
	/** Will cause the Node application to blindly accept all certificates. Not recommended unless in local, controlled networks. */
	unsafeSSL: boolean
	/** Paths to certificates to load, for SSL-connections */
	certificates: string[]
}

/** The subset of TLSOpts that can be derived from a CertificatesConfig */

export function loadDDPTLSOptions(logger: SomeLogger, certConfig: CertificatesConfig): DDPTLSOptions {
	const result: DDPTLSOptions = {}

	if (certConfig.unsafeSSL) {
		logger.info(
			'Disabling certificate validation (rejectUnauthorized: false), be sure to ONLY DO THIS ON A LOCAL NETWORK!'
		)
		result.rejectUnauthorized = false
	}

	if (certConfig.certificates.length) {
		logger.info(`Loading certificates...`)
		const certificates: Buffer[] = []
		for (const certificate of certConfig.certificates) {
			try {
				certificates.push(fs.readFileSync(certificate))
				logger.info(`Using certificate "${certificate}"`)
			} catch (error) {
				logger.error(`Error loading certificate "${certificate}"`, error)
			}
		}
		result.ca = certificates
	}

	return result
}

interface SomeLogger {
	info(message: string, ...meta: any[]): void
	error(message: string, ...meta: any[]): void
	warn(message: string, ...meta: any[]): void
	log(message: string, ...meta: any[]): void
	debug(message: string, ...meta: any[]): void
}
