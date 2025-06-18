import * as React from 'react'
import {
	PeripheralDevice,
	PeripheralDeviceType,
	PERIPHERAL_SUBTYPE_PROCESS,
	PeripheralDeviceCategory,
} from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'
import { EditAttribute } from '../../lib/EditAttribute'
import { doModalDialog } from '../../lib/ModalDialog'
import { Translated, translateWithTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import { Spinner } from '../../lib/Spinner'
import { PeripheralDevicesAPI } from '../../lib/clientAPI'

import { NotificationCenter, Notification, NoticeLevel } from '../../lib/notifications/notifications'
import { StatusCodePill } from '../Status/StatusCodePill'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faExclamationTriangle } from '@fortawesome/free-solid-svg-icons'
import { GenericDeviceSettingsComponent } from './components/GenericDeviceSettingsComponent'
import { DevicePackageManagerSettings } from './DevicePackageManagerSettings'
import { getExpectedLatency } from '@sofie-automation/corelib/dist/studio/playout'
import { PeripheralDeviceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { PeripheralDevices } from '../../collections'
import { useTranslation } from 'react-i18next'
import { LabelActual } from '../../lib/Components/LabelAndOverrides'

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
		renderSpecifics() {
			if (this.props.device && this.props.device.subType === PERIPHERAL_SUBTYPE_PROCESS) {
				if (this.props.device.configManifest) {
					return <GenericDeviceSettingsComponent device={this.props.device} subDevices={this.props.subDevices} />
				} else {
					const { t } = this.props

					return (
						<div>
							<h2>{t('Peripheral Device is outdated')}</h2>
							<p>
								{t(
									'The config UI is now driven by manifests fed by the device. This device needs updating to provide the configManifest to be configurable'
								)}
							</p>
						</div>
					)
				}
			}
			return null
		}

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
				<div className="studio-edit mod mhl mvn">
					<div className="row">
						<div className="col c12 rl-c6">
							<h2 className="mhn mtn">{t('Generic Properties')}</h2>
							<label className="field">
								<LabelActual label={t('Device Name')} />
								{!device?.name ? (
									<div className="error-notice inline">
										{t('No name set')} <FontAwesomeIcon icon={faExclamationTriangle} />
									</div>
								) : null}
								<div className="mdi">
									<EditAttribute
										modifiedClassName="bghl"
										attribute="name"
										obj={device}
										type="text"
										collection={PeripheralDevices}
										className="mdinput"
									></EditAttribute>
									<span className="mdfx"></span>
								</div>
							</label>
						</div>
						<div className="col c12 rl-c6 alright">
							<div className="mbs">
								<button
									className="btn btn-secondary btn-tight"
									onClick={(e) => device && this.restartDevice(device, e)}
								>
									{t('Restart Device')}
								</button>
							</div>
							<div className="mbs">
								<StatusCodePill
									connected={device.connected}
									statusCode={device.status?.statusCode}
									messages={device.status?.messages}
								/>
							</div>
							{device.type === PeripheralDeviceType.PACKAGE_MANAGER ? (
								<div className="mbs">
									<button
										className="btn btn-secondary btn-tight"
										onClick={(e) => device && this.troubleshootDevice(device, e)}
									>
										{t('Troubleshoot')}
									</button>
								</div>
							) : null}
							<div className="mbs">
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

					<div className="properties-grid">
						<label className="field">
							<LabelActual label={t('Disable version check')} />
							<EditAttribute
								modifiedClassName="bghl"
								attribute="disableVersionChecks"
								obj={device}
								type="checkbox"
								collection={PeripheralDevices}
								className="input"
							/>
						</label>

						{device.category === PeripheralDeviceCategory.INGEST && <IngestDeviceCoreConfig device={device} />}

						{this.renderSpecifics()}
					</div>

					{device &&
					device.type === PeripheralDeviceType.PACKAGE_MANAGER &&
					device.subType === PERIPHERAL_SUBTYPE_PROCESS
						? this.renderPackageManagerSpecial()
						: null}
				</div>
			)
		}
		renderPackageManagerSpecial() {
			if (this.props.device) {
				return <DevicePackageManagerSettings deviceId={this.props.device._id} />
			}
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
			<EditAttribute
				modifiedClassName="bghl"
				attribute="nrcsName"
				obj={device}
				type="text"
				collection={PeripheralDevices}
				className="form-control input text-input input-l"
			/>
		</label>
	)
}
