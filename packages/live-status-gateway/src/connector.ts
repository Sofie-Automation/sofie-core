import { CoreHandler, CoreConfig } from './coreHandler.js'
import { Logger } from 'winston'
import { PeripheralDeviceId } from '@sofie-automation/shared-lib/dist/core/model/Ids'
import { LiveStatusServer } from './liveStatusServer.js'
import {
	CertificatesConfig,
	HealthConfig,
	HealthEndpoints,
	IConnector,
	loadDDPTLSOptions,
	stringifyError,
} from '@sofie-automation/server-core-integration'

export interface Config {
	certificates: CertificatesConfig
	device: DeviceConfig
	core: CoreConfig
	health: HealthConfig
}

export interface DeviceConfig {
	deviceId: PeripheralDeviceId
	deviceToken: string
}
export class Connector implements IConnector {
	public initialized = false
	public initializedError: string | undefined = undefined

	private coreHandler: CoreHandler | undefined
	private _logger: Logger
	private _liveStatusServer: LiveStatusServer | undefined

	constructor(logger: Logger) {
		this._logger = logger
	}

	public async init(config: Config): Promise<void> {
		try {
			this._logger.info('Initializing Process...')
			const tlsOptions = loadDDPTLSOptions(this._logger, config.certificates)
			this._logger.info('Process initialized')

			this._logger.info('Initializing Core...')
			this.coreHandler = new CoreHandler(this._logger, config.device)
			new HealthEndpoints(this, this.coreHandler, config.health)

			await this.coreHandler.init(config.core, tlsOptions)
			this._logger.info('Core initialized')

			if (!this.coreHandler.studioId) throw new Error('Device has no studioId')

			this._liveStatusServer = new LiveStatusServer(this._logger, this.coreHandler)
			await this._liveStatusServer.init()

			this._logger.info('Initialization done')
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
