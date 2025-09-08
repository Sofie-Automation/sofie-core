import { useTranslation } from 'react-i18next'
import { PeripheralDevice } from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'
import { DeviceItem } from '../../Status/SystemStatus/DeviceItem.js'
import { ConfigManifestOAuthFlowComponent } from './ConfigManifestOAuthFlow.js'
import { unprotectString } from '../../../lib/tempLib.js'
import { useDebugStatesForPlayoutDevice } from './useDebugStatesForPlayoutDevice.js'

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

interface GenericAttahcedSubDeviceSettingsComponentProps {
	device: PeripheralDevice
	subDevices: PeripheralDevice[] | undefined
}

export function GenericAttahcedSubDeviceSettingsComponent({
	device,
	subDevices,
}: Readonly<GenericAttahcedSubDeviceSettingsComponentProps>): JSX.Element {
	const { t } = useTranslation()

	const debugStates = useDebugStatesForPlayoutDevice(device)

	return (
		<>
			{Object.keys(device.configManifest?.subdeviceManifest ?? {}).length > 0 && (
				<>
					<h2 className="mb-4">{t('Attached Subdevices')}</h2>

					{(!subDevices || subDevices.length === 0) && <p>{t('There are no sub-devices for this gateway')}</p>}

					{subDevices?.map((subDevice) => (
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
