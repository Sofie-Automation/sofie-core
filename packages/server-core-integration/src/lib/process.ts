import * as fs from 'fs'

export interface CertificatesConfig {
	/** Will cause the Node applocation to blindly accept all certificates. Not recommenced unless in local, controlled networks. */
	unsafeSSL: boolean
	/** Paths to certificates to load, for SSL-connections */
	certificates: string[]
}

export function loadCertificatesFromDisk(logger: SomeLogger, certConfig: CertificatesConfig): Buffer[] {
	if (certConfig.unsafeSSL) {
		logger.info('Disabling NODE_TLS_REJECT_UNAUTHORIZED, be sure to ONLY DO THIS ON A LOCAL NETWORK!')
		process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0'
	} else {
		// var rootCas = SSLRootCAs.create()
	}

	const certificates: Buffer[] = []
	if (certConfig.certificates.length) {
		logger.info(`Loading certificates...`)
		for (const certificate of certConfig.certificates) {
			try {
				certificates.push(fs.readFileSync(certificate))
				logger.info(`Using certificate "${certificate}"`)
			} catch (error) {
				logger.error(`Error loading certificate "${certificate}"`, error)
			}
		}
	}

	return certificates
}

interface SomeLogger {
	info(message: string, ...meta: any[]): void
	error(message: string, ...meta: any[]): void
	warn(message: string, ...meta: any[]): void
	log(message: string, ...meta: any[]): void
	debug(message: string, ...meta: any[]): void
}
