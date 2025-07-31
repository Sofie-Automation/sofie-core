import { MediaWorkFlow } from '@sofie-automation/shared-lib/dist/core/model/MediaWorkFlows'
import { PeripheralDevice } from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'
import { MediaWorkFlows, PeripheralDevices } from '../collections'
import { executePeripheralDeviceFunction } from './peripheralDevice/executeFunction'
import { MediaWorkFlowId, OrganizationId, PeripheralDeviceId } from '@sofie-automation/corelib/dist/dataModel/Ids'

export async function restartAllWorkflows(organizationId: OrganizationId | null): Promise<void> {
	const devices: Array<Pick<PeripheralDevice, '_id'>> = await PeripheralDevices.findFetchAsync(
		organizationId ? { organizationId: organizationId } : {},
		{
			projection: {
				_id: 1,
			},
		}
	)
	const workflows: Array<Pick<MediaWorkFlow, 'deviceId'>> = await MediaWorkFlows.findFetchAsync(
		{
			deviceId: { $in: devices.map((d) => d._id) },
		},
		{
			projection: {
				deviceId: 1,
			},
		}
	)

	const deviceIds = Array.from(new Set(workflows.map((w) => w.deviceId)))

	await Promise.all(
		deviceIds.map(async (deviceId) => executePeripheralDeviceFunction(deviceId, 'restartAllWorkflows'))
	)
}
export async function abortAllWorkflows(organizationId: OrganizationId | null): Promise<void> {
	const devices: Array<Pick<PeripheralDevice, '_id'>> = await PeripheralDevices.findFetchAsync(
		organizationId ? { organizationId: organizationId } : {},
		{
			projection: {
				_id: 1,
			},
		}
	)
	const workflows: Array<Pick<MediaWorkFlow, 'deviceId'>> = await MediaWorkFlows.findFetchAsync(
		{
			deviceId: { $in: devices.map((d) => d._id) },
		},
		{
			projection: {
				deviceId: 1,
			},
		}
	)

	const deviceIds = Array.from(new Set(workflows.map((w) => w.deviceId)))

	await Promise.all(deviceIds.map(async (deviceId) => executePeripheralDeviceFunction(deviceId, 'abortAllWorkflows')))
}

export async function restartWorkflow(deviceId: PeripheralDeviceId, workflowId: MediaWorkFlowId): Promise<void> {
	await ensureWorkflowExists(workflowId)

	await executePeripheralDeviceFunction(deviceId, 'restartWorkflow', workflowId)
}
export async function abortWorkflow(deviceId: PeripheralDeviceId, workflowId: MediaWorkFlowId): Promise<void> {
	await ensureWorkflowExists(workflowId)

	await executePeripheralDeviceFunction(deviceId, 'abortWorkflow', workflowId)
}
export async function prioritizeWorkflow(deviceId: PeripheralDeviceId, workflowId: MediaWorkFlowId): Promise<void> {
	await ensureWorkflowExists(workflowId)

	await executePeripheralDeviceFunction(deviceId, 'prioritizeWorkflow', workflowId)
}

async function ensureWorkflowExists(workflowId: MediaWorkFlowId): Promise<void> {
	const doc = await MediaWorkFlows.findOneAsync(workflowId, { projection: { _id: 1 } })
	if (!doc) throw new Error(`Workflow "${workflowId}" not found`)
}
