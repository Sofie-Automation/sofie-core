import { PeripheralDeviceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { PeripheralDevice } from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'
import { PeripheralDeviceType } from '@sofie-automation/shared-lib/dist/peripheralDevice/peripheralDeviceAPI'
import { useState, useEffect, useContext } from 'react'
import { MeteorCall } from '../../../lib/meteorApi.js'
import { UIStudios } from '../../Collections.js'
import { useTracker } from '../../../lib/ReactMeteorData/ReactMeteorData.js'
import { UserPermissionsContext } from '../../UserPermissions.js'
import { logger } from '../../../lib/logging.js'

export function useDebugStatesForPlayoutDevice(device: PeripheralDevice): ReadonlyMap<PeripheralDeviceId, object> {
	const [debugStates, setDebugStates] = useState(() => new Map<PeripheralDeviceId, object>())

	const userPermissions = useContext(UserPermissionsContext)

	const deviceHasDebugStates = useTracker(() => {
		if (!userPermissions.developer) return false

		if (device.type !== PeripheralDeviceType.PLAYOUT) return false
		if (!device.studioAndConfigId) return false

		const studio = UIStudios.findOne(device.studioAndConfigId.studioId)
		if (!studio?.peripheralDeviceSettings) return false

		const settingsForDevice = studio.peripheralDeviceSettings[device.studioAndConfigId.configId]
		return !!(settingsForDevice && (settingsForDevice.options as any)['debugState'])
	}, [userPermissions.developer, device._id, device.studioAndConfigId])

	useEffect(() => {
		if (deviceHasDebugStates) {
			const interval = setInterval(() => {
				MeteorCall.systemStatus
					.getDebugStates(device._id)
					.then((res) => {
						const states: Map<PeripheralDeviceId, object> = new Map()
						for (const [key, state] of Object.entries<any>(res)) {
							states.set(protectString(key), state)
						}
						setDebugStates(states)
					})
					.catch((err) => logger.error(`Error fetching device states: ${stringifyError(err)}`))
			}, 1000)

			return () => {
				clearInterval(interval)
			}
		} else {
			setDebugStates(new Map())
		}
	}, [device._id, device.type, deviceHasDebugStates])

	return debugStates
}
