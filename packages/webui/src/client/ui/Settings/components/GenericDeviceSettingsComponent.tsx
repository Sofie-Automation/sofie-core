import { useTranslation } from 'react-i18next'
import { PeripheralDevice } from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'
import { DeviceItem } from '../../Status/SystemStatus/DeviceItem.js'
import { ConfigManifestOAuthFlowComponent } from './ConfigManifestOAuthFlow.js'
import { unprotectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import { useDebugStatesForPlayoutDevice } from './useDebugStatesForPlayoutDevice.js'
import { PeripheralDevices } from '../../../collections/index.js'
import { useTracker } from '../../../lib/ReactMeteorData/ReactMeteorData.js'

interface IGenericDeviceSettingsComponentProps {
	device: PeripheralDevice
}

export function GenericDeviceSettingsComponent({
	device,
}: Readonly<IGenericDeviceSettingsComponentProps>): JSX.Element {
	const { t } = useTranslation()

	if (device.configManifest) {
		return (
			<>
				{device.configManifest.deviceOAuthFlow && (
					<ConfigManifestOAuthFlowComponent device={device}></ConfigManifestOAuthFlowComponent>
				)}

				<p>{t('Configuration for this Gateway has moved to the Studio Peripheral Device settings')}</p>
			</>
		)
	} else {
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

interface GenericAttachedSubDeviceSettingsComponentProps {
	device: PeripheralDevice
}

export function GenericAttachedSubDeviceSettingsComponent({
	device,
}: Readonly<GenericAttachedSubDeviceSettingsComponentProps>): JSX.Element {
	const { t } = useTranslation()

	const subDevices = useTracker(() => PeripheralDevices.find({ parentDeviceId: device._id }).fetch(), [device._id], [])

	const debugStates = useDebugStatesForPlayoutDevice(device)

	return (
		<>
			{Object.keys(device.configManifest?.subdeviceManifest ?? {}).length > 0 && (
				<>
					<h2 className="mb-4">{t('Attached Subdevices')}</h2>

					{subDevices.length === 0 && <p>{t('There are no sub-devices for this gateway')}</p>}

					{subDevices.map((subDevice) => (
						<DeviceItem
							key={unprotectString(subDevice._id)}
							parentDevice={device}
							device={subDevice}
							showRemoveButtons={true}
							debugState={debugStates.get(subDevice._id)}
						/>
					))}
				</>
			)}
		</>
	)
}
