import { check, Match } from '../lib/check'
import { meteorPublish } from './lib/lib'
import { MeteorPubSub } from '@sofie-automation/meteor-lib/dist/api/pubsub'
import { PeripheralDevice } from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'
import { MongoFieldSpecifierZeroes, MongoQuery } from '@sofie-automation/corelib/dist/mongo'
import { PeripheralDeviceId, StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { MediaWorkFlows, MediaWorkFlowSteps, PeripheralDeviceCommands, PeripheralDevices } from '../collections'
import { CorelibPubSub } from '@sofie-automation/corelib/dist/pubsub'
import { PeripheralDevicePubSub } from '@sofie-automation/shared-lib/dist/pubsub/peripheralDevice'
import { clone } from '@sofie-automation/corelib/dist/lib'
import { triggerWriteAccessBecauseNoCheckNecessary } from '../security/securityVerify'
import { checkAccessAndGetPeripheralDevice } from '../security/check'

/*
 * This file contains publications for the peripheralDevices, such as playout-gateway, mos-gateway and package-manager
 */

const peripheralDeviceProjection: MongoFieldSpecifierZeroes<PeripheralDevice> = {
	token: 0,
	secretSettings: 0,
}

meteorPublish(
	CorelibPubSub.peripheralDevices,
	async function (peripheralDeviceIds: PeripheralDeviceId[] | null, token: string | undefined) {
		check(peripheralDeviceIds, Match.Maybe(Array))

		triggerWriteAccessBecauseNoCheckNecessary()

		// If values were provided, they must have values
		if (peripheralDeviceIds && peripheralDeviceIds.length === 0) return null

		// Add the requested filter
		const selector: MongoQuery<PeripheralDevice> = {}
		if (peripheralDeviceIds) selector._id = { $in: peripheralDeviceIds }

		const projection = clone(peripheralDeviceProjection)
		if (selector._id && token) {
			// in this case, send the secretSettings:
			delete projection.secretSettings
		}
		return PeripheralDevices.findWithCursor(selector, {
			projection,
		})
	}
)

meteorPublish(CorelibPubSub.peripheralDevicesAndSubDevices, async function (studioId: StudioId) {
	triggerWriteAccessBecauseNoCheckNecessary()

	const selector: MongoQuery<PeripheralDevice> = {
		'studioAndConfigId.studioId': studioId,
	}

	// TODO - this is not correctly reactive when changing the `studioId` property of a parent device
	const parents = (await PeripheralDevices.findFetchAsync(selector, { projection: { _id: 1 } })) as Array<
		Pick<PeripheralDevice, '_id'>
	>

	return PeripheralDevices.findWithCursor(
		{
			$or: [
				{
					parentDeviceId: { $in: parents.map((i) => i._id) },
				},
				selector,
			],
		},
		{
			projection: peripheralDeviceProjection,
		}
	)
})
meteorPublish(
	PeripheralDevicePubSub.peripheralDeviceCommands,
	async function (deviceId: PeripheralDeviceId, token: string | undefined) {
		await checkAccessAndGetPeripheralDevice(deviceId, token, this)

		return PeripheralDeviceCommands.findWithCursor({ deviceId: deviceId })
	}
)
meteorPublish(MeteorPubSub.mediaWorkFlows, async function (_token: string | undefined) {
	triggerWriteAccessBecauseNoCheckNecessary()

	return MediaWorkFlows.findWithCursor({})
})
meteorPublish(MeteorPubSub.mediaWorkFlowSteps, async function (_token: string | undefined) {
	triggerWriteAccessBecauseNoCheckNecessary()

	return MediaWorkFlowSteps.findWithCursor({})
})
