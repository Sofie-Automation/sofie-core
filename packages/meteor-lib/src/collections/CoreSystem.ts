import { LastBlueprintConfig } from '@sofie-automation/corelib/dist/dataModel/Blueprint'
import { LogLevel } from '../lib.js'
import { CoreSystemId, BlueprintId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { ObjectWithOverrides } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { ICoreSystemSettings } from '@sofie-automation/shared-lib/dist/core/model/CoreSystemSettings'

export const SYSTEM_ID: CoreSystemId = protectString('core')

/**
 * Criticality level for service messages. Specification of criticality in server
 * messages from sofie-monitor:
 * https://github.com/nrkno/sofie-monitor/blob/master/src/data/serviceMessages/ServiceMessage.ts
 *
 * @export
 * @enum {number}
 */
export enum Criticality {
	/** Subject matter will affect operations. */
	CRITICAL = 1,
	/** Operations will not be affected, but non-critical functions may be affected or the result may be undesirable. */
	WARNING = 2,
	/** General information */
	NOTIFICATION = 3,
}

export interface ServiceMessage {
	id: string
	criticality: Criticality
	message: string
	sender?: string
	timestamp: number
}

export interface ExternalServiceMessage extends Omit<ServiceMessage, 'timestamp'> {
	timestamp: Date
}

export enum SofieLogo {
	Default = 'default',
	Pride = 'pride',
	Norway = 'norway',
	Christmas = 'christmas',
}

export interface ICoreSystem {
	_id: CoreSystemId // always is 'core'
	/** Timestamp of creation, (ie the time the database was created) */
	created: number
	/** Last modified time */
	modified: number
	/** Database version, on the form x.y.z */
	version: string
	/** Previous version, on the form x.y.z */
	previousVersion: string | null

	/** Id of the blueprint used by this system */
	blueprintId?: BlueprintId

	systemInfo?: {
		message: string
		enabled: boolean
	}

	/** A user-defined name for the installation */
	name?: string

	/** What log-level to set. Defaults to SILLY */
	logLevel?: LogLevel

	/** Service messages currently valid for this instance */
	serviceMessages: {
		[index: string]: ServiceMessage
	}

	/** elastic APM (application performance monitoring) settings */
	apm?: {
		enabled?: boolean
		/**
		 * How many of the transactions to monitor.
		 * Set to:
		 * -1 to log nothing (max performance),
		 * 0.5 to log 50% of the transactions,
		 * 1 to log all transactions
		 */
		transactionSampleRate?: number
	}
	enableMonitorBlockedThread?: boolean

	settingsWithOverrides: ObjectWithOverrides<ICoreSystemSettings>

	logo?: SofieLogo

	/** Details on the last blueprint used to generate the defaults values for this
	 * Note: This doesn't currently have any 'config' which it relates to.
	 * The name is to be consistent with studio/showstyle, and in preparation for their being config/configpresets used here
	 */
	lastBlueprintConfig: LastBlueprintConfig | undefined

	/** These fields are to have type consistency with the full config driven upgrades flow, but we don't use them yet */
	blueprintConfigPresetId?: undefined
	lastBlueprintFixUpHash?: undefined
	blueprintConfigWithOverrides?: undefined
}

/** In the beginning, there was the database, and the database was with Sofie, and the database was Sofie.
 * And Sofie said: The version of the database is to be GENESIS_SYSTEM_VERSION so that the migration scripts will run.
 */
export const GENESIS_SYSTEM_VERSION = '0.0.0'
