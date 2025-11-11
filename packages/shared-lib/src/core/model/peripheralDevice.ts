import { TSR } from '../../tsr.js'
import { PeripheralDeviceId, StudioId } from './Ids.js'

export interface IngestDeviceSecretSettingsStatus {
	/** OAuth: Set to true when secret value exists */
	credentials?: boolean
	accessToken?: boolean
}
export interface IngestDeviceSecretSettings {
	/** OAuth: */
	credentials?: Credentials
	accessToken?: AccessToken
}
export interface Credentials {
	installed: {
		client_id: string
		project_id: string
		auth_uri: string
		token_uri: string
		auth_provider_x509_cert_url: string
		client_secret: string
		redirect_uris: string[]
	}
}
export interface AccessToken {
	access_token: string
	refresh_token: string
	scope: string
	token_type: string
	expiry_date: number
}

export interface PeripheralDeviceForDevice {
	_id: PeripheralDeviceId

	/** The studio this device is assigned to */
	studioId?: StudioId

	/**
	 * Settings for the PeripheralDevice
	 * Note: this does not include any subdevices
	 */
	deviceSettings: unknown

	/**
	 * Contains, for example, OAuth access tokens.
	 */
	secretSettings?: IngestDeviceSecretSettings | { [key: string]: any }

	/**
	 * Settings for any playout subdevices
	 */
	playoutDevices: Record<string, TSR.DeviceOptionsAny>
	/**
	 * Settings for any ingest subdevices
	 */
	ingestDevices: Record<string, unknown>
	/**
	 * Settings for any input subdevices
	 */
	inputDevices: Record<string, unknown>
}
