/**
 * Settings injected into the meteor runtime config, which is available on the client side.
 */
export interface IExtendedSettings {
	sofieVersionExtended: string
	/** If true, enable http header based security measures */
	enableHeaderAuth: boolean
}
