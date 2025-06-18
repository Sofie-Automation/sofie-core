import React, { Fragment, useState } from 'react'
import { useSubscription, useTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import { Mongo } from 'meteor/mongo'
import {} from '@sofie-automation/meteor-lib/dist/api/pubsub'
import { protectString, unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import { PeripheralDeviceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DeviceTriggerMountedAction, PreviewWrappedAdLib } from '@sofie-automation/meteor-lib/dist/api/MountedTriggers'
import { PeripheralDevices } from '../../collections'
import { CorelibPubSub } from '@sofie-automation/corelib/dist/pubsub'
import {
	PeripheralDevicePubSub,
	PeripheralDevicePubSubCollectionsNames,
} from '@sofie-automation/shared-lib/dist/pubsub/peripheralDevice'

const MountedTriggers = new Mongo.Collection<DeviceTriggerMountedAction>(
	PeripheralDevicePubSubCollectionsNames.mountedTriggers
)
const MountedTriggersPreviews = new Mongo.Collection<PreviewWrappedAdLib>(
	PeripheralDevicePubSubCollectionsNames.mountedTriggersPreviews
)

interface DeviceTriggersViewRouteParams {
	peripheralDeviceId: string
}

const DeviceTriggersView: React.FC = function TimelineDatastoreView() {
	const { t } = useTranslation()
	const { peripheralDeviceId } = useParams<DeviceTriggersViewRouteParams>()

	return (
		<div className="mtl gutter">
			<header className="mvs">
				<h1>{t('Device Triggers')}</h1>
			</header>
			<div className="mod mvl">
				{peripheralDeviceId && (
					<div>
						<DeviceTriggersControls peripheralDeviceId={protectString(peripheralDeviceId)} />
					</div>
				)}
			</div>
		</div>
	)
}

interface IDatastoreControlsProps {
	peripheralDeviceId: PeripheralDeviceId
}
function DeviceTriggersControls({ peripheralDeviceId }: Readonly<IDatastoreControlsProps>) {
	const [deviceIds, setDeviceIds] = useState<string[]>([])
	useSubscription(PeripheralDevicePubSub.mountedTriggersForDevice, peripheralDeviceId, deviceIds)
	useSubscription(PeripheralDevicePubSub.mountedTriggersForDevicePreview, peripheralDeviceId)

	const mountedTriggers = useTracker<DeviceTriggerMountedAction[]>(
		() =>
			MountedTriggers.find({
				deviceId: {
					$in: deviceIds,
				},
			}).fetch(),
		[deviceIds],
		[]
	)

	const mountedTriggersPreviews = useTracker<PreviewWrappedAdLib[]>(
		() =>
			MountedTriggersPreviews.find({
				actionId: {
					$in: mountedTriggers.map((trigger) => trigger.actionId),
				},
			}).fetch(),
		[mountedTriggers],
		[]
	)

	return (
		<div>
			<label>
				Device Ids:
				<input
					value={deviceIds.join(', ')}
					onChange={(e) => {
						setDeviceIds(e.target.value.split(/,\s*/))
					}}
				/>
			</label>
			<div>
				<table className="testtools-timelinetable">
					<tbody>
						<tr>
							<th></th>
							<th>Device ID</th>
							<th>Trigger ID</th>
							<th>Values?</th>
							<th>Action Type</th>
							<th>Name</th>
						</tr>
						{mountedTriggers.map((entry, index) => (
							<Fragment key={unprotectString(entry._id)}>
								<tr>
									<td>{index}</td>
									<td>{entry.deviceId}</td>
									<td>{entry.deviceTriggerId}</td>
									<td>{JSON.stringify(entry.values)}</td>
									<td>{entry.actionType}</td>
									<td>{JSON.stringify(entry.name)}</td>
								</tr>
								<tr>
									<td colSpan={5}>
										<ul className="mod mhn mvn">
											{mountedTriggersPreviews
												.filter((preview) => preview.actionId === entry.actionId)
												.map((preview) => (
													<li key={unprotectString(preview._id)}>
														{JSON.stringify(preview.label)}: {String(preview.type)} {preview.sourceLayerType}{' '}
														{preview.sourceLayerName?.name}{' '}
														{preview.sourceLayerName?.abbreviation ? `(${preview.sourceLayerName.abbreviation})` : null}
													</li>
												))}
										</ul>
									</td>
								</tr>
							</Fragment>
						))}
					</tbody>
				</table>
			</div>
		</div>
	)
}

function DeviceTriggersDeviceSelect(): JSX.Element | null {
	useSubscription(CorelibPubSub.peripheralDevices, null)
	const devices = useTracker(() => PeripheralDevices.find().fetch(), [])

	if (!devices) return null

	return (
		<ul>
			{devices.map((device) => (
				<li key={unprotectString(device._id)}>
					<Link to={`devicetriggers/${device._id}`}>{device.name}</Link>
				</li>
			))}
		</ul>
	)
}

export { DeviceTriggersView, DeviceTriggersDeviceSelect }
