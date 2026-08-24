import { useCallback, useMemo } from 'react'
import { Studios } from '../../../../collections/index.js'
import type { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { useTracker } from '../../../../lib/ReactMeteorData/ReactMeteorData.js'
import {
	type PeripheralDevice,
	PeripheralDeviceCategory,
} from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'
import { getHelpMode } from '../../../../lib/localStorage.js'
import Tooltip from 'rc-tooltip'
import { useTranslation } from 'react-i18next'
import { getAllCurrentAndDeletedItemsFromOverrides } from '../../util/OverrideOpHelper.js'
import {
	type ObjectOverrideSetOp,
	wrapDefaultObject,
} from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import type { StudioIngestDevice } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { faPlus } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { GenericSubDevicesTable } from './GenericSubDevices.js'
import { useStagedSubDeviceOverrides } from './useStagedSubDeviceOverrides.js'

interface StudioIngestSubDevicesProps {
	studioId: StudioId
	studioDevices: PeripheralDevice[]
}
export function StudioIngestSubDevices({
	studioId,
	studioDevices,
}: Readonly<StudioIngestSubDevicesProps>): JSX.Element {
	const { t } = useTranslation()

	const studio = useTracker(() => Studios.findOne(studioId), [studioId])

	const baseSettings = useMemo(
		() => studio?.peripheralDeviceSettings?.ingestDevices ?? wrapDefaultObject({}),
		[studio?.peripheralDeviceSettings?.ingestDevices]
	)

	const {
		settingsWithOverrides,
		batchedOverrideHelper,
		instantSaveOverrideHelper,
		hasUnsavedChangesForItem,
		discardItemChanges,
		saveItemChanges,
		updateObjectId,
		updatedIds,
	} = useStagedSubDeviceOverrides<StudioIngestDevice>({
		studioId: studio?._id,
		baseSettings,
		overridePath: 'peripheralDeviceSettings.ingestDevices.overrides',
		relatedItemsMode: 'transitive',
		clearSavedItemFromStaged: true,
	})

	const wrappedSubDevices = useMemo(
		() =>
			getAllCurrentAndDeletedItemsFromOverrides<StudioIngestDevice>(settingsWithOverrides, (a, b) =>
				a[0].localeCompare(b[0])
			),
		[settingsWithOverrides]
	)

	const filteredPeripheralDevices = useMemo(
		() => studioDevices.filter((d) => d.category === PeripheralDeviceCategory.INGEST),
		[studioDevices]
	)

	const addNewItem = useCallback(() => {
		const existingDevices = new Set(wrappedSubDevices.map((d) => d.id))
		let idx = 0
		while (existingDevices.has(`device${idx}`)) {
			idx++
		}

		const newId = `device${idx}`
		const newDevice = literal<StudioIngestDevice>({
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
				'peripheralDeviceSettings.ingestDevices.overrides': addOp,
			},
		})
	}, [wrappedSubDevices, settingsWithOverrides.overrides])

	// key is subDevice's old id, value is it's new id if it was changed

	return (
		<div className="mb-4">
			<h2 className="mb-2">
				<Tooltip
					overlay={t('Ingest devices are needed to create rundowns')}
					visible={getHelpMode() && !wrappedSubDevices.length}
					placement="right"
				>
					<span>{t('Ingest Devices')}</span>
				</Tooltip>
			</h2>

			<GenericSubDevicesTable
				subDevices={wrappedSubDevices}
				overrideHelper={batchedOverrideHelper}
				peripheralDevices={filteredPeripheralDevices}
				instantSaveOverrideHelper={instantSaveOverrideHelper}
				hasUnsavedChangesForItem={hasUnsavedChangesForItem}
				saveItemChanges={saveItemChanges}
				discardItemChanges={discardItemChanges}
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
