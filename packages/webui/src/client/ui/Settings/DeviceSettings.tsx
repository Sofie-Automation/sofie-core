import * as React from 'react'
import {
	PeripheralDevice,
	PeripheralDeviceType,
	PERIPHERAL_SUBTYPE_PROCESS,
	PeripheralDeviceCategory,
} from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'
import { EditAttribute } from '../../lib/EditAttribute.js'
import { doModalDialog } from '../../lib/ModalDialog.js'
import { Translated, translateWithTracker } from '../../lib/ReactMeteorData/react-meteor-data.js'
import { Spinner } from '../../lib/Spinner.js'
import { PeripheralDevicesAPI } from '../../lib/clientAPI.js'

import { NotificationCenter, Notification, NoticeLevel } from '../../lib/notifications/notifications.js'
import { StatusCodePill } from '../Status/StatusCodePill.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faExclamationTriangle } from '@fortawesome/free-solid-svg-icons'
import {
	GenericAttahcedSubDeviceSettingsComponent,
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
interface IDeviceSettingsState {}
interface IDeviceSettingsTrackedProps {
	device: PeripheralDevice | undefined
	subDevices: PeripheralDevice[] | undefined
}
export default translateWithTracker<IDeviceSettingsProps, IDeviceSettingsState, IDeviceSettingsTrackedProps>(
	(props: Readonly<IDeviceSettingsProps>) => {
		return {
			device: PeripheralDevices.findOne(props.match.params.deviceId),
			subDevices: PeripheralDevices.find({
				parentDeviceId: props.match.params.deviceId,
			}).fetch(),
		}
	}
)(
	class DeviceSettings extends React.Component<Translated<IDeviceSettingsProps & IDeviceSettingsTrackedProps>> {
		restartDevice(device: PeripheralDevice, e: React.UIEvent<HTMLElement>) {
			e.persist()

			const { t } = this.props
			doModalDialog({
				message: t('Are you sure you want to restart this device?'),
				title: t('Restart this Device?'),
				yes: t('Restart'),
				no: t('Cancel'),
				onAccept: (e: any) => {
					PeripheralDevicesAPI.restartDevice(device, e)
						.then(() => {
							NotificationCenter.push(
								new Notification(
									undefined,
									NoticeLevel.NOTIFICATION,
									t('Device "{{deviceName}}" restarting...', { deviceName: device.name }),
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
										deviceName: device.name,
										errorMessage: err + '',
									}),
									'DeviceSettings'
								)
							)
						})
				},
			})
		}
		troubleshootDevice(device: PeripheralDevice, e: Event | React.SyntheticEvent<object>) {
			const { t } = this.props
			PeripheralDevicesAPI.troubleshootDevice(device, e)
				.then((result) => {
					console.log(`Troubleshooting data for device ${device.name}`)
					console.log(result)
					NotificationCenter.push(
						new Notification(
							undefined,
							NoticeLevel.NOTIFICATION,
							t('Check the console for troubleshooting data from device "{{deviceName}}"!', {
								deviceName: device.name,
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
								deviceName: device.name,
								errorMessage: err + '',
							}),
							'DeviceSettings'
						)
					)
				})
		}

		renderEditForm(device: PeripheralDevice) {
			const { t } = this.props

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
								<Button size="sm" variant="outline-secondary" onClick={(e) => device && this.restartDevice(device, e)}>
									{t('Restart Device')}
								</Button>
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
									<Button
										size="sm"
										variant="outline-secondary"
										onClick={(e) => device && this.troubleshootDevice(device, e)}
									>
										{t('Troubleshoot')}
									</Button>
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

					{!device.parentDeviceId && (
						<GenericAttahcedSubDeviceSettingsComponent device={device} subDevices={this.props.subDevices} />
					)}

					{device &&
					device.type === PeripheralDeviceType.PACKAGE_MANAGER &&
					device.subType === PERIPHERAL_SUBTYPE_PROCESS ? (
						<DevicePackageManagerSettings deviceId={device._id} />
					) : null}
				</div>
			)
		}

		render(): JSX.Element {
			if (this.props.device) {
				return this.renderEditForm(this.props.device)
			} else {
				return <Spinner />
			}
		}
	}
)

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
