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

	const [unsavedOverrides, setUnsavedOverrides] = useState<SomeObjectOverrideOp[] | undefined>(undefined)

	const baseSettings = useMemo(
		() => studio?.peripheralDeviceSettings?.inputDevices ?? wrapDefaultObject({}),
		[studio?.peripheralDeviceSettings?.inputDevices]
	)

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

	const settingsWithOverrides = useMemo(() => {
		if (unsavedOverrides) {
			return {
				...baseSettings,
				overrides: unsavedOverrides,
			}
		}
		return baseSettings
	}, [baseSettings, unsavedOverrides])

	const batchedOverrideHelper = useOverrideOpHelper(setUnsavedOverrides, settingsWithOverrides)
	const instantSaveOverrideHelper = useOverrideOpHelper(saveOverrides, settingsWithOverrides)

	const wrappedSubDevices = useMemo(
		() =>
			getAllCurrentAndDeletedItemsFromOverrides<StudioInputDevice>(settingsWithOverrides, (a, b) =>
				a[0].localeCompare(b[0])
			),
		[settingsWithOverrides]
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
	}, [wrappedSubDevices, settingsWithOverrides.overrides])

	const [updatedIds, setUpdatedIds] = useState(new Map<string, string>())

	const updateObjectId = useCallback(
		(oldId: string, newId: string) => {
			if (oldId === newId) return

			batchedOverrideHelper().changeItemId(oldId, newId).commit()
			setUpdatedIds((prev) => new Map(prev).set(oldId, newId))
		},
		[batchedOverrideHelper, setUpdatedIds]
	)

	const discardChanges = useCallback(() => {
		setUnsavedOverrides(undefined)
		setUpdatedIds(new Map<string, string>())
	}, [])

	const saveChanges = useCallback(() => {
		if (studio?._id && unsavedOverrides) {
			Studios.update(studio._id, {
				$set: {
					'peripheralDeviceSettings.inputDevices.overrides': unsavedOverrides,
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
					overlay={t('Input devices allow you to trigger Sofie actions remotely')}
					visible={getHelpMode() && !wrappedSubDevices.length}
					placement="right"
				>
					<span>{t('Input Devices')}</span>
				</Tooltip>
			</h2>

			<GenericSubDevicesTable
				subDevices={wrappedSubDevices}
				overrideHelper={batchedOverrideHelper}
				peripheralDevices={filteredPeripheralDevices}
				instantSaveOverrideHelper={instantSaveOverrideHelper}
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
