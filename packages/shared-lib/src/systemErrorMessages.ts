/**
 * System-level error codes for customizable error messages.
 *
 * These are for core Sofie system errors.
 * Each error code documents the variables available in the translation context.
 */
export enum SystemErrorCode {
	/**
	 * Database connection lost
	 * Variables: database
	 */
	DATABASE_CONNECTION_LOST = 'SYSTEM_DB_CONNECTION_LOST',

	/**
	 * System resources running low
	 * Variables: resource, available, required
	 */
	INSUFFICIENT_RESOURCES = 'SYSTEM_INSUFFICIENT_RESOURCES',

	/**
	 * Service unavailable
	 * Variables: service, reason
	 */
	SERVICE_UNAVAILABLE = 'SYSTEM_SERVICE_UNAVAILABLE',
}

export interface SystemErrorContexts {
	[SystemErrorCode.DATABASE_CONNECTION_LOST]: {
		database: string
	}
	[SystemErrorCode.INSUFFICIENT_RESOURCES]: {
		resource: string
		available: unknown
		required: unknown
	}
	[SystemErrorCode.SERVICE_UNAVAILABLE]: {
		service: string
		reason: string
	}
}
