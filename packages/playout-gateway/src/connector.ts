import { TSRHandler, TSRConfig } from './tsrHandler.js'
import { CoreHandler, CoreConfig } from './coreHandler.js'
import { Logger } from 'winston'
import { InfluxConfig } from './influxdb.js'
import {
	CertificatesConfig,
	PeripheralDeviceId,
	loadCertificatesFromDisk,
	stringifyError,
	HealthConfig,
	HealthEndpoints,
	IConnector,
} from '@sofie-automation/server-core-integration'

export interface Config {
	certificates: CertificatesConfig
	device: DeviceConfig
	core: CoreConfig
	tsr: TSRConfig
	influx: InfluxConfig
	health: HealthConfig
}

export interface DeviceConfig {
	deviceId: PeripheralDeviceId
	deviceToken: string
}
export class Connector implements IConnector {
	public initialized = false
	public initializedError: string | undefined = undefined

	private tsrHandler: TSRHandler | undefined
	private coreHandler: CoreHandler | undefined
	private _logger: Logger
	private _certificates: Buffer[] | undefined

	constructor(logger: Logger) {
		this._logger = logger
	}

	public async init(config: Config): Promise<void> {
		try {
			this._logger.info('Initializing Certificates...')
			this._certificates = loadCertificatesFromDisk(this._logger, config.certificates)
			this._logger.info('Certificates initialized')

			this._logger.info('Initializing Core...')
			this.coreHandler = new CoreHandler(this._logger, config.device)
			new HealthEndpoints(this, this.coreHandler, config.health)

			await this.coreHandler.init(config.core, this._certificates)
			this._logger.info('Core initialized')

			this._logger.info('Initializing TSR...')
			this.tsrHandler = new TSRHandler(this._logger)
			await this.tsrHandler.init(config.tsr, this.coreHandler)
			this._logger.info('TSR initialized')

			this._logger.info('Initialization done')
			this.initialized = true
			return
		} catch (e: any) {
			this._logger.error('Error during initialization:')
			this._logger.error(e)
			this._logger.error(e.stack)

			this.initializedError = stringifyError(e)

			try {
				if (this.coreHandler) {
					this.coreHandler.destroy().catch(this._logger.error)
				}
				if (this.tsrHandler) {
					this.tsrHandler.destroy().catch(this._logger.error)
				}
			} catch (e) {
				// Handle the edge case where destroy() throws synchronously:
				this._logger.error(e)
			}

			this._logger.info('Shutting down in 10 seconds!')
			setTimeout(() => {
				// eslint-disable-next-line n/no-process-exit
				process.exit(0)
			}, 10 * 1000)
			return
		}
	}
}
