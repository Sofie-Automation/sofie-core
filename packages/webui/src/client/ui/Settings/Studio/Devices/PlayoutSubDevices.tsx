import { useCallback, useMemo, useState } from 'react'
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
	const [unsavedOverrides, setUnsavedOverrides] = useState<SomeObjectOverrideOp[] | undefined>(undefined)

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

	const deviceSettings = useMemo(() => {
		if (unsavedOverrides) {
			return {
				...baseSettings,
				overrides: unsavedOverrides,
			}
		}
		return baseSettings
	}, [baseSettings, unsavedOverrides])

	const batchedOverridesHelper = useOverrideOpHelper(setUnsavedOverrides, deviceSettings)

	const instantSaveOverrideHelper = useOverrideOpHelper(saveOverrides, deviceSettings)

	const wrappedSubDevices = useMemo(
		() =>
			getAllCurrentAndDeletedItemsFromOverrides<StudioPlayoutDevice>(deviceSettings, (a, b) =>
				a[0].localeCompare(b[0])
			),
		[deviceSettings]
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

	const [updatedIds, setUpdatedIds] = useState(new Map<string, string>())

	const updateObjectId = useCallback(
		(oldId: string, newId: string) => {
			if (oldId === newId) return

			batchedOverridesHelper().changeItemId(oldId, newId).commit()
			setUpdatedIds((prev) => new Map(prev).set(oldId, newId))
		},
		[batchedOverridesHelper, setUpdatedIds]
	)

	const discardChanges = useCallback(() => {
		setUnsavedOverrides(undefined)
		setUpdatedIds(new Map<string, string>())
	}, [])

	const saveChanges = useCallback(() => {
		if (studio?._id && unsavedOverrides) {
			Studios.update(studio._id, {
				$set: {
					'peripheralDeviceSettings.playoutDevices.overrides': unsavedOverrides,
				},
			})
			setUnsavedOverrides(undefined)
		}

		if (updatedIds.size > 0) {
			setUpdatedIds(new Map<string, string>())
		}
	}, [studio?._id, unsavedOverrides])

	const hasUnsavedChanges = useMemo(() => !!unsavedOverrides || updatedIds.size > 0, [unsavedOverrides, updatedIds])

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
				overrideHelper={batchedOverridesHelper}
				instantSaveOverrideHelper={instantSaveOverrideHelper}
				peripheralDevices={filteredPeripheralDevices}
				hasUnsavedChanges={hasUnsavedChanges}
				saveChanges={saveChanges}
				discardChanges={discardChanges}
				updateObjectId={updateObjectId}
				updatedIds={updatedIds}
			/>

			<div className="my-1 mx-2">
				<button className="btn btn-primary" onClick={addNewItem}>
					<FontAwesomeIcon icon={faPlus} />
				</button>
			</div>
		</div>
	)
}
