// Re-export to reduce dependency duplication
export { Timecode } from './timecode.js'

export { MOS } from '@sofie-automation/shared-lib/dist/mos'

// Status message resolver
export { StatusMessageResolver } from './StatusMessageResolver.js'
export type {
	DeviceStatusContext,
	DeviceStatusMessageFunction,
	DeviceStatusMessages,
	SystemErrorMessages,
} from './StatusMessageResolver.js'
