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
	ObjectWithOverrides,
	SomeObjectOverrideOp,
	wrapDefaultObject,
} from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { StudioInputDevice } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { faPlus } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { GenericSubDevicesTable } from './GenericSubDevices.js'

interface StudioInputSubDevicesProps {
	studioId: StudioId
	studioDevices: PeripheralDevice[]
}
export function StudioInputSubDevices({ studioId, studioDevices }: Readonly<StudioInputSubDevicesProps>): JSX.Element {
	const { t } = useTranslation()

	const studio = useTracker(() => Studios.findOne(studioId), [studioId])

	const saveOverrides = useCallback(
		(newOps: SomeObjectOverrideOp[]) => {
			if (studio?._id) {
				Studios.update(studio._id, {
					$set: {
						'peripheralDeviceSettings.inputDevices.overrides': newOps,
					},
				})
			}
		},
		[studio?._id]
	)

	const baseSettings = useMemo<ObjectWithOverrides<Record<string, StudioInputDevice>>>(
		() => studio?.peripheralDeviceSettings?.inputDevices ?? wrapDefaultObject({}),
		[studio?.peripheralDeviceSettings?.inputDevices]
	)

	const overrideHelper = useOverrideOpHelper(saveOverrides, baseSettings)

	const wrappedSubDevices = useMemo(
		() =>
			getAllCurrentAndDeletedItemsFromOverrides<StudioInputDevice>(baseSettings, (a, b) => a[0].localeCompare(b[0])),
		[baseSettings]
	)

	const filteredPeripheralDevices = useMemo(
		() => studioDevices.filter((d) => d.category === PeripheralDeviceCategory.TRIGGER_INPUT),
		[studioDevices]
	)

	const addNewItem = useCallback(() => {
		const existingDevices = new Set(wrappedSubDevices.map((d) => d.id))
		let idx = 0
		while (existingDevices.has(`device${idx}`)) {
			idx++
		}

		const newId = `device${idx}`
		const newDevice = literal<StudioInputDevice>({
			peripheralDeviceId: undefined,
			options: {},
		})

		const addOp = literal<ObjectOverrideSetOp>({
			op: 'set',
			path: newId,
			value: newDevice,
		})

		Studios.update(studioId, {
			$push: {
				'peripheralDeviceSettings.inputDevices.overrides': addOp,
			},
		})
	}, [studioId, wrappedSubDevices])

	return (
		<div className="mb-4">
			<h2 className="mb-2">
				<Tooltip
					overlay={t('Input devices allow you to trigger Sofie actions remotely')}
					visible={getHelpMode() && !wrappedSubDevices.length}
					placement="right"
				>
					<span>{t('Input Devices')}</span>
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
