import { useCallback, useMemo, useState } from 'react'
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
import { getAllCurrentAndDeletedItemsFromOverrides, useOverrideOpHelper } from '../../util/OverrideOpHelper.js'
import {
	type ObjectOverrideSetOp,
	type SomeObjectOverrideOp,
	wrapDefaultObject,
} from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import type { StudioInputDevice } from '@sofie-automation/corelib/dist/dataModel/Studio'
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
	const [updatedIds, setUpdatedIds] = useState(new Map<string, string>())

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

	const persistedOverrides = baseSettings.overrides

	const isOverrideOpForItem = useCallback((opPath: string, itemId: string): boolean => {
		return opPath === itemId || opPath.startsWith(`${itemId}.`)
	}, [])

	const getOpsForItem = useCallback(
		(ops: SomeObjectOverrideOp[], itemId: string): SomeObjectOverrideOp[] => {
			return ops.filter((op) => isOverrideOpForItem(op.path, itemId))
		},
		[isOverrideOpForItem]
	)

	const removeOpsForItems = useCallback(
		(ops: SomeObjectOverrideOp[], itemIds: string[]): SomeObjectOverrideOp[] => {
			return ops.filter((op) => !itemIds.some((itemId) => isOverrideOpForItem(op.path, itemId)))
		},
		[isOverrideOpForItem]
	)

	const getRelatedItemIds = useCallback(
		(itemId: string): string[] => {
			const related = new Set<string>([itemId])

			for (const [oldId, newId] of updatedIds.entries()) {
				if (newId === itemId) {
					related.add(oldId)
				}
				if (oldId === itemId) {
					related.add(newId)
				}
			}

			return Array.from(related)
		},
		[updatedIds]
	)

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

	const updateObjectId = useCallback(
		(oldId: string, newId: string) => {
			if (oldId === newId) return

			batchedOverrideHelper().changeItemId(oldId, newId).commit()
			setUpdatedIds((prev) => new Map(prev).set(oldId, newId))
		},
		[batchedOverrideHelper, setUpdatedIds]
	)

	const hasUnsavedChangesForItem = useCallback(
		(itemId: string): boolean => {
			const relatedIds = getRelatedItemIds(itemId)
			const currentOverrides = unsavedOverrides ?? persistedOverrides
			const currentItemOps = relatedIds.flatMap((id) => getOpsForItem(currentOverrides, id))
			const persistedItemOps = relatedIds.flatMap((id) => getOpsForItem(persistedOverrides, id))

			return (
				JSON.stringify(currentItemOps) !== JSON.stringify(persistedItemOps) ||
				relatedIds.some((id) => updatedIds.has(id) || Array.from(updatedIds.values()).includes(id))
			)
		},
		[getOpsForItem, getRelatedItemIds, persistedOverrides, unsavedOverrides, updatedIds]
	)

	const discardItemChanges = useCallback(
		(itemId: string) => {
			const relatedIds = getRelatedItemIds(itemId)
			const currentOverrides = unsavedOverrides ?? persistedOverrides
			const currentWithoutItem = removeOpsForItems(currentOverrides, relatedIds)
			const persistedItemOps = relatedIds.flatMap((id) => getOpsForItem(persistedOverrides, id))
			const nextOverrides = [...currentWithoutItem, ...persistedItemOps]

			if (JSON.stringify(nextOverrides) === JSON.stringify(persistedOverrides)) {
				setUnsavedOverrides(undefined)
			} else {
				setUnsavedOverrides(nextOverrides)
			}

			setUpdatedIds((prev) => {
				const next = new Map<string, string>()
				for (const [oldId, newId] of prev.entries()) {
					if (!relatedIds.includes(oldId) && !relatedIds.includes(newId)) {
						next.set(oldId, newId)
					}
				}
				return next
			})
		},
		[getOpsForItem, getRelatedItemIds, persistedOverrides, removeOpsForItems, unsavedOverrides]
	)

	const saveItemChanges = useCallback(
		(itemId: string) => {
			if (!studio?._id) return

			const relatedIds = getRelatedItemIds(itemId)
			const currentOverrides = unsavedOverrides ?? persistedOverrides
			const currentItemOps = relatedIds.flatMap((id) => getOpsForItem(currentOverrides, id))
			const persistedWithoutItem = removeOpsForItems(persistedOverrides, relatedIds)
			const nextPersistedOverrides = [...persistedWithoutItem, ...currentItemOps]

			Studios.update(studio._id, {
				$set: {
					'peripheralDeviceSettings.inputDevices.overrides': nextPersistedOverrides,
				},
			})

			setUpdatedIds((prev) => {
				const next = new Map<string, string>()
				for (const [oldId, newId] of prev.entries()) {
					if (!relatedIds.includes(oldId) && !relatedIds.includes(newId)) {
						next.set(oldId, newId)
					}
				}
				return next
			})
		},
		[getOpsForItem, getRelatedItemIds, persistedOverrides, removeOpsForItems, studio?._id, unsavedOverrides]
	)

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
