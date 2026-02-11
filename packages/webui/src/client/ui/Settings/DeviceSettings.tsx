import React, { useCallback } from 'react'
import {
	PeripheralDevice,
	PeripheralDeviceType,
	PERIPHERAL_SUBTYPE_PROCESS,
	PeripheralDeviceCategory,
} from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'
import { EditAttribute } from '../../lib/EditAttribute.js'
import { doModalDialog } from '../../lib/ModalDialog.js'
import { useTracker } from '../../lib/ReactMeteorData/react-meteor-data.js'
import { Spinner } from '../../lib/Spinner.js'
import { PeripheralDevicesAPI } from '../../lib/clientAPI.js'

import { NotificationCenter, Notification, NoticeLevel } from '../../lib/notifications/notifications.js'
import { StatusCodePill } from '../Status/StatusCodePill.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faExclamationTriangle } from '@fortawesome/free-solid-svg-icons'
import {
	GenericAttachedSubDeviceSettingsComponent,
	GenericDeviceSettingsComponent,
} from './components/GenericDeviceSettingsComponent.js'
import { DevicePackageManagerSettings } from './DevicePackageManagerSettings.js'
import { getExpectedLatency } from '@sofie-automation/corelib/dist/studio/playout'
import { PeripheralDeviceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { PeripheralDevices } from '../../collections/index.js'
import { useTranslation } from 'react-i18next'
import { LabelActual } from '../../lib/Components/LabelAndOverrides.js'
import Button from 'react-bootstrap/esm/Button'

interface IDeviceSettingsProps {
	match: {
		params: {
			deviceId: PeripheralDeviceId
		}
	}
}

export default function DeviceSettings(props: IDeviceSettingsProps): JSX.Element {
	const { t } = useTranslation()

	const device = useTracker(() => PeripheralDevices.findOne(props.match.params.deviceId), [props.match.params.deviceId])

	if (!device) {
		return <Spinner />
	}

	const latencies = getExpectedLatency(device)

	return (
		<div className="studio-edit mx-4">
			<div className="grid-buttons-right">
				<div className="properties-grid">
					<h2>{t('Generic Properties')}</h2>
					<label className="field">
						<LabelActual label={t('Device Name')} />
						{!device?.name ? (
							<div className="error-notice inline">
								{t('No name set')} <FontAwesomeIcon icon={faExclamationTriangle} />
							</div>
						) : null}
						<EditAttribute attribute="name" obj={device} type="text" collection={PeripheralDevices}></EditAttribute>
					</label>

					<label className="field">
						<LabelActual label={t('Disable version check')} />
						<EditAttribute
							attribute="disableVersionChecks"
							obj={device}
							type="checkbox"
							collection={PeripheralDevices}
							className="input"
						/>
					</label>

					{device.category === PeripheralDeviceCategory.INGEST && <IngestDeviceCoreConfig device={device} />}

					{device.subType === PERIPHERAL_SUBTYPE_PROCESS && <GenericDeviceSettingsComponent device={device} />}
				</div>
				<div className="text-end">
					<div className="mb-2">
						<RestartDeviceButton deviceId={device._id} deviceName={device.name} />
					</div>
					<div className="mb-2">
						<StatusCodePill
							connected={device.connected}
							statusCode={device.status?.statusCode}
							messages={device.status?.messages}
						/>
					</div>
					{device.type === PeripheralDeviceType.PACKAGE_MANAGER ? (
						<div className="mb-2">
							<TroubleshootDeviceButton deviceId={device._id} deviceName={device.name} />
						</div>
					) : null}
					<div className="mb-2">
						{latencies.average > 0 ? (
							<React.Fragment>
								<b>Latencies:</b>
								<div>
									Average: {Math.floor(latencies.average)} ms
									<br />
									Safe: {Math.floor(latencies.safe)} ms
									<br />
									Fastest: {Math.floor(latencies.fastest)} ms
									<br />
								</div>
							</React.Fragment>
						) : null}
					</div>
				</div>
			</div>

			{!device.parentDeviceId && <GenericAttachedSubDeviceSettingsComponent device={device} />}

			{device &&
			device.type === PeripheralDeviceType.PACKAGE_MANAGER &&
			device.subType === PERIPHERAL_SUBTYPE_PROCESS ? (
				<DevicePackageManagerSettings deviceId={device._id} />
			) : null}
		</div>
	)
}

interface IngestDeviceCoreConfigProps {
	device: PeripheralDevice
}
function IngestDeviceCoreConfig({ device }: Readonly<IngestDeviceCoreConfigProps>) {
	const { t } = useTranslation()

	return (
		<label className="field">
			<LabelActual label={t('NRCS Name')} />
			<EditAttribute attribute="nrcsName" obj={device} type="text" collection={PeripheralDevices} />
		</label>
	)
}

function RestartDeviceButton({ deviceId, deviceName }: { deviceId: PeripheralDeviceId; deviceName: string }) {
	const { t } = useTranslation()

	const restartDevice = useCallback(
		(e: React.UIEvent<HTMLElement>) => {
			e.persist()

			doModalDialog({
				message: t('Are you sure you want to restart this device?'),
				title: t('Restart this Device?'),
				yes: t('Restart'),
				no: t('Cancel'),
				onAccept: (e: any) => {
					PeripheralDevicesAPI.restartDevice({ _id: deviceId }, e)
						.then(() => {
							NotificationCenter.push(
								new Notification(
									undefined,
									NoticeLevel.NOTIFICATION,
									t('Device "{{deviceName}}" restarting...', { deviceName }),
									'DeviceSettings'
								)
							)
						})
						.catch((err) => {
							NotificationCenter.push(
								new Notification(
									undefined,
									NoticeLevel.WARNING,
									t('Failed to restart device: "{{deviceName}}": {{errorMessage}}', {
										deviceName,
										errorMessage: err + '',
									}),
									'DeviceSettings'
								)
							)
						})
				},
			})
		},
		[deviceId, deviceName, t]
	)

	return (
		<Button size="sm" variant="outline-secondary" onClick={restartDevice}>
			{t('Restart Device')}
		</Button>
	)
}

function TroubleshootDeviceButton({ deviceId, deviceName }: { deviceId: PeripheralDeviceId; deviceName: string }) {
	const { t } = useTranslation()

	const troubleshootDevice = useCallback(
		(e: React.UIEvent<HTMLElement>) => {
			e.persist()

			PeripheralDevicesAPI.troubleshootDevice({ _id: deviceId }, e)
				.then((result) => {
					console.log(`Troubleshooting data for device ${deviceName}`)
					console.log(result)
					NotificationCenter.push(
						new Notification(
							undefined,
							NoticeLevel.NOTIFICATION,
							t('Check the console for troubleshooting data from device "{{deviceName}}"!', {
								deviceName,
							}),
							'DeviceSettings'
						)
					)
				})
				.catch((err) => {
					NotificationCenter.push(
						new Notification(
							undefined,
							NoticeLevel.WARNING,
							t('There was an error when troubleshooting the device: "{{deviceName}}": {{errorMessage}}', {
								deviceName,
								errorMessage: err + '',
							}),
							'DeviceSettings'
						)
					)
				})
		},
		[deviceId, deviceName, t]
	)

	return (
		<Button size="sm" variant="outline-secondary" onClick={troubleshootDevice}>
			{t('Troubleshoot')}
		</Button>
	)
}
