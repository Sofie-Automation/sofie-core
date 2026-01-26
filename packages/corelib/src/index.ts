// Re-export to reduce dependency duplication
export { Timecode } from 'timecode'

export { MOS } from '@sofie-automation/shared-lib/dist/mos'

// Error message resolver
export { ErrorMessageResolver } from './ErrorMessageResolver.js'
export type {
	DeviceErrorContext,
	DeviceErrorMessageFunction,
	DeviceErrorMessages,
	SystemErrorMessages,
} from './ErrorMessageResolver.js'
