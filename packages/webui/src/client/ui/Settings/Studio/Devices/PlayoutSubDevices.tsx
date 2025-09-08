import { useCallback, useMemo } from 'react'
import { Studios } from '../../../../collections/index.js'
import { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { useTracker } from '../../../../lib/ReactMeteorData/ReactMeteorData.js'
import { PeripheralDevice, PeripheralDeviceCategory } from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'
import { getHelpMode } from '../../../../lib/localStorage.js'
import Tooltip from 'rc-tooltip'
import { useTranslation } from 'react-i18next'
import { getAllCurrentAndDeletedItemsFromOverrides, useOverrideOpHelper } from '../../util/OverrideOpHelper.js'
import {
	ObjectOverrideSetOp,
	SomeObjectOverrideOp,
	wrapDefaultObject,
} from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { StudioPlayoutDevice } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { faPlus } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { TSR } from '@sofie-automation/blueprints-integration'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { GenericSubDevicesTable } from './GenericSubDevices.js'

interface StudioPlayoutSubDevicesProps {
	studioId: StudioId
	studioDevices: PeripheralDevice[]
}
export function StudioPlayoutSubDevices({
	studioId,
	studioDevices,
}: Readonly<StudioPlayoutSubDevicesProps>): JSX.Element {
	const { t } = useTranslation()

	const studio = useTracker(() => Studios.findOne(studioId), [studioId])

	const saveOverrides = useCallback(
		(newOps: SomeObjectOverrideOp[]) => {
			if (studio?._id) {
				Studios.update(studio._id, {
					$set: {
						'peripheralDeviceSettings.playoutDevices.overrides': newOps,
					},
				})
			}
		},
		[studio?._id]
	)

	const baseSettings = useMemo(
		() => studio?.peripheralDeviceSettings?.playoutDevices ?? wrapDefaultObject({}),
		[studio?.peripheralDeviceSettings?.playoutDevices]
	)

	const overrideHelper = useOverrideOpHelper(saveOverrides, baseSettings)

	const wrappedSubDevices = useMemo(
		() =>
			getAllCurrentAndDeletedItemsFromOverrides<StudioPlayoutDevice>(baseSettings, (a, b) => a[0].localeCompare(b[0])),
		[baseSettings]
	)

	const filteredPeripheralDevices = useMemo(
		() => studioDevices.filter((d) => d.category === PeripheralDeviceCategory.PLAYOUT),
		[studioDevices]
	)

	const addNewItem = useCallback(() => {
		const existingDevices = new Set(wrappedSubDevices.map((d) => d.id))
		let idx = 0
		while (existingDevices.has(`device${idx}`)) {
			idx++
		}

		const newId = `device${idx}`
		const newDevice = literal<StudioPlayoutDevice>({
			peripheralDeviceId: undefined,
			options: {
				type: TSR.DeviceType.ABSTRACT,
			},
		})

		const addOp = literal<ObjectOverrideSetOp>({
			op: 'set',
			path: newId,
			value: newDevice,
		})

		Studios.update(studioId, {
			$push: {
				'peripheralDeviceSettings.playoutDevices.overrides': addOp,
			},
		})
	}, [studioId, wrappedSubDevices])

	return (
		<div className="mb-4">
			<h2 className="mb-2">
				<Tooltip
					overlay={t('Playout devices are needed to control your studio hardware')}
					visible={getHelpMode() && !wrappedSubDevices.length}
					placement="right"
				>
					<span>{t('Playout Devices')}</span>
				</Tooltip>
			</h2>

			<GenericSubDevicesTable
				subDevices={wrappedSubDevices}
				overrideHelper={overrideHelper}
				peripheralDevices={filteredPeripheralDevices}
			/>

			<div className="my-1 mx-2">
				<button className="btn btn-primary" onClick={addNewItem}>
					<FontAwesomeIcon icon={faPlus} />
				</button>
			</div>
		</div>
	)
}
