import { Time } from '../../lib/lib.js'
import { PeripheralDeviceCommandId, PeripheralDeviceId } from './Ids.js'

export interface PeripheralDeviceCommand {
	_id: PeripheralDeviceCommandId

	deviceId: PeripheralDeviceId

	functionName?: string
	args?: Array<any>
	actionId?: string
	payload?: Record<string, any>

	hasReply: boolean
	reply?: any
	replyError?: any
	replyTime?: number

	time: Time // time
}
