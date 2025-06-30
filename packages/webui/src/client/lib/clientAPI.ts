import { PeripheralDevice } from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'
import { MeteorCall } from '../lib/meteorApi.js'
import { PeripheralDeviceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { eventContextForLog } from './clientUserAction.js'
import { TSR } from '@sofie-automation/blueprints-integration'

export async function callPeripheralDeviceFunction(
	e: Event | React.SyntheticEvent<object>,
	deviceId: PeripheralDeviceId,
	timeoutTime: number | undefined,
	functionName: string,
	...params: any[]
): Promise<any> {
	const eventContext = eventContextForLog(e)
	return MeteorCall.client.callPeripheralDeviceFunction(
		eventContext[0],
		deviceId,
		timeoutTime,
		functionName,
		...params
	)
}
export async function callPeripheralDeviceAction(
	e: Event | React.SyntheticEvent<object>,
	deviceId: PeripheralDeviceId,
	timeoutTime: number | undefined,
	actionId: string,
	payload?: Record<string, any>
): Promise<TSR.ActionExecutionResult> {
	const eventContext = eventContextForLog(e)
	return MeteorCall.client.callPeripheralDeviceAction(eventContext[0], deviceId, timeoutTime, actionId, payload)
}

export namespace PeripheralDevicesAPI {
	export async function restartDevice(
		dev: Pick<PeripheralDevice, '_id'>,
		e: Event | React.SyntheticEvent<object>
	): Promise<any> {
		return callPeripheralDeviceFunction(e, dev._id, undefined, 'killProcess', 1)
	}
	export async function troubleshootDevice(
		dev: Pick<PeripheralDevice, '_id'>,
		e: Event | React.SyntheticEvent<object>
	): Promise<any> {
		return callPeripheralDeviceFunction(e, dev._id, undefined, 'troubleshoot', 1)
	}
}
