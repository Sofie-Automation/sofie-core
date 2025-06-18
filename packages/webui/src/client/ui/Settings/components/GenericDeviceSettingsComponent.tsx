import { useTranslation } from 'react-i18next'
import { PeripheralDevice } from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'
import { DeviceItem } from '../../Status/SystemStatus/DeviceItem'
import { ConfigManifestOAuthFlowComponent } from './ConfigManifestOAuthFlow'
import { unprotectString } from '../../../lib/tempLib'
import { useDebugStatesForPlayoutDevice } from './useDebugStatesForPlayoutDevice'

interface IGenericDeviceSettingsComponentProps {
	device: PeripheralDevice
	subDevices: PeripheralDevice[] | undefined
}

export function GenericDeviceSettingsComponent({
	device,
	subDevices,
}: Readonly<IGenericDeviceSettingsComponentProps>): JSX.Element {
	const { t } = useTranslation()

	const debugStates = useDebugStatesForPlayoutDevice(device)

	return (
		<>
			{device.configManifest.deviceOAuthFlow && (
				<ConfigManifestOAuthFlowComponent device={device}></ConfigManifestOAuthFlowComponent>
			)}

			<p>{t('Configuration for this Gateway has moved to the Studio Peripheral Device settings')}</p>

			{Object.keys(device.configManifest.subdeviceManifest ?? {}).length > 0 && (
				<>
					<h2 className="mhn">{t('Attached Subdevices')}</h2>

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
