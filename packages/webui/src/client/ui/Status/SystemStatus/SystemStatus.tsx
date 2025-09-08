import { useEffect, useState } from 'react'
import { useSubscription, useTracker } from '../../../lib/ReactMeteorData/react-meteor-data.js'
import { PeripheralDevice } from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'
import { useTranslation } from 'react-i18next'
import { unprotectString } from '../../../lib/tempLib.js'
import { NotificationCenter, NoticeLevel, Notification } from '../../../lib/notifications/notifications.js'
import { StatusResponse } from '@sofie-automation/meteor-lib/dist/api/systemStatus'
import { MeteorCall } from '../../../lib/meteorApi.js'
import { CoreSystem, PeripheralDevices } from '../../../collections/index.js'
import { PeripheralDeviceId } from '@sofie-automation/shared-lib/dist/core/model/Ids'
import { logger } from '../../../lib/logging.js'
import { CorelibPubSub } from '@sofie-automation/corelib/dist/pubsub'
import { CoreItem } from './CoreItem.js'
import { DeviceItem } from './DeviceItem.js'
import { useDebugStatesForPlayoutDevice } from '../../Settings/components/useDebugStatesForPlayoutDevice.js'

export function SystemStatus(): JSX.Element {
	const { t } = useTranslation()

	// Subscribe to data:
	useSubscription(CorelibPubSub.peripheralDevices, null)

	const coreSystem = useTracker(() => CoreSystem.findOne(), [])
	const devices = useTracker(() => PeripheralDevices.find({}, { sort: { lastConnected: -1 } }).fetch(), [], [])

	const systemStatus = useSystemStatus()
	const devicesHierarchy = convertDevicesIntoHeirarchy(devices)

	return (
		<div className="system-status">
			<header className="mb-2">
				<h1>{t('System Status')}</h1>
			</header>
			<div className="my-5">
				{coreSystem && <CoreItem coreSystem={coreSystem} systemStatus={systemStatus} />}

				{devicesHierarchy.map((d) => (
					<ParentDeviceItemWithChildren key={unprotectString(d.device._id)} device={d} />
				))}
			</div>
		</div>
	)
}

interface DeviceInHierarchy {
	device: PeripheralDevice
	children: Array<DeviceInHierarchy>
}

function useSystemStatus(): StatusResponse | undefined {
	const { t } = useTranslation()

	const [sytemStatus, setSystemStatus] = useState<StatusResponse | undefined>()

	useEffect(() => {
		let destroyed = false

		const refreshSystemStatus = () => {
			MeteorCall.systemStatus
				.getSystemStatus()
				.then((newSystemStatus: StatusResponse) => {
					if (destroyed) return

					setSystemStatus(newSystemStatus)
				})
				.catch((err) => {
					if (destroyed) return

					logger.error('systemStatus.getSystemStatus', err)
					NotificationCenter.push(
						new Notification(
							'systemStatus_failed',
							NoticeLevel.CRITICAL,
							t('Could not get system status. Please consult system administrator.'),
							'RundownList'
						)
					)
				})
		}

		refreshSystemStatus()

		const interval = setInterval(refreshSystemStatus, 5000)

		return () => {
			clearInterval(interval)
			destroyed = true
		}
	}, [t])

	return sytemStatus
}

function convertDevicesIntoHeirarchy(devices: PeripheralDevice[]): DeviceInHierarchy[] {
	const devicesMap = new Map<PeripheralDeviceId, DeviceInHierarchy>()
	const devicesToAdd: DeviceInHierarchy[] = []

	// First, add all as references:
	for (const device of devices) {
		const entry: DeviceInHierarchy = {
			device: device,
			children: [],
		}
		devicesMap.set(device._id, entry)
		devicesToAdd.push(entry)
	}

	// Then, map and add devices:
	const devicesHeirarchy: Array<DeviceInHierarchy> = []
	for (const entry of devicesToAdd) {
		if (entry.device.parentDeviceId) {
			const parent = devicesMap.get(entry.device.parentDeviceId)
			if (parent) {
				parent.children.push(entry)
			} else {
				// not found, add on top level then:
				devicesHeirarchy.push(entry)
			}
		} else {
			devicesHeirarchy.push(entry)
		}
	}

	return devicesHeirarchy
}

interface ParentDeviceItemWithChildrenProps {
	device: DeviceInHierarchy
}

function ParentDeviceItemWithChildren({ device }: ParentDeviceItemWithChildrenProps) {
	const playoutDebugStates = useDebugStatesForPlayoutDevice(device.device)

	return <DeviceItemWithChildren playoutDebugStates={playoutDebugStates} parentDevice={null} device={device} />
}

interface DeviceItemWithChildrenProps {
	playoutDebugStates: ReadonlyMap<PeripheralDeviceId, object>
	parentDevice: DeviceInHierarchy | null
	device: DeviceInHierarchy
}

function DeviceItemWithChildren({ playoutDebugStates, device, parentDevice }: DeviceItemWithChildrenProps) {
	return (
		<div key={device.device._id + '_parent'} className="device-item-container">
			<DeviceItem
				parentDevice={parentDevice?.device ?? null}
				device={device.device}
				hasChildren={device.children.length !== 0}
				debugState={playoutDebugStates.get(device.device._id)}
			/>

			{device.children.length > 0 && (
				<div className="children">
					<ul className="childlist">
						{device.children.map((child) => (
							<li key={unprotectString(child.device._id)} className="child-device-li">
								<DeviceItemWithChildren playoutDebugStates={playoutDebugStates} parentDevice={device} device={child} />
							</li>
						))}
					</ul>
				</div>
			)}
		</div>
	)
}
