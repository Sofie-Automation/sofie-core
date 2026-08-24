import { useCallback, useMemo, useState } from 'react'
import { Studios } from '../../../../collections/index.js'
import type { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { useOverrideOpHelper } from '../../util/OverrideOpHelper.js'
import type {
	ObjectWithOverrides,
	SomeObjectOverrideOp,
} from '@sofie-automation/corelib/dist/settings/objectWithOverrides'

type RelatedItemsMode = 'direct' | 'transitive'

interface UseStagedSubDeviceOverridesOptions<TSubDevice> {
	studioId: StudioId | undefined
	baseSettings: ObjectWithOverrides<Record<string, TSubDevice>>
	overridePath: string
	relatedItemsMode?: RelatedItemsMode
	clearSavedItemFromStaged?: boolean
}

interface UseStagedSubDeviceOverridesResult<TSubDevice> {
	settingsWithOverrides: ObjectWithOverrides<Record<string, TSubDevice>>
	batchedOverrideHelper: ReturnType<typeof useOverrideOpHelper>
	instantSaveOverrideHelper: ReturnType<typeof useOverrideOpHelper>
	hasUnsavedChangesForItem: (itemId: string) => boolean
	discardItemChanges: (itemId: string) => void
	saveItemChanges: (itemId: string) => void
	updateObjectId: (oldId: string, newId: string) => void
	updatedIds: Map<string, string>
}

export function useStagedSubDeviceOverrides<TSubDevice>({
	studioId,
	baseSettings,
	overridePath,
	relatedItemsMode = 'direct',
	clearSavedItemFromStaged = false,
}: Readonly<UseStagedSubDeviceOverridesOptions<TSubDevice>>): UseStagedSubDeviceOverridesResult<TSubDevice> {
	const [unsavedOverrides, setUnsavedOverrides] = useState<SomeObjectOverrideOp[] | undefined>(undefined)
	const [updatedIds, setUpdatedIds] = useState(new Map<string, string>())

	const settingsWithOverrides = useMemo<ObjectWithOverrides<Record<string, TSubDevice>>>(() => {
		if (unsavedOverrides) {
			return {
				...baseSettings,
				overrides: unsavedOverrides,
			}
		}
		return baseSettings
	}, [baseSettings, unsavedOverrides])

	const persistedOverrides = baseSettings.overrides

	const saveOverrides = useCallback(
		(newOps: SomeObjectOverrideOp[]) => {
			if (!studioId) return

			Studios.update(studioId, {
				$set: {
					[overridePath]: newOps,
				},
			})
		},
		[overridePath, studioId]
	)

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

			if (relatedItemsMode === 'transitive') {
				const queue: string[] = [itemId]

				while (queue.length > 0) {
					const currentId = queue.shift()
					if (!currentId) continue

					for (const [oldId, newId] of updatedIds.entries()) {
						if (oldId === currentId && !related.has(newId)) {
							related.add(newId)
							queue.push(newId)
						}

						if (newId === currentId && !related.has(oldId)) {
							related.add(oldId)
							queue.push(oldId)
						}
					}
				}
			} else {
				for (const [oldId, newId] of updatedIds.entries()) {
					if (newId === itemId) {
						related.add(oldId)
					}
					if (oldId === itemId) {
						related.add(newId)
					}
				}
			}

			return Array.from(related)
		},
		[relatedItemsMode, updatedIds]
	)

	const batchedOverrideHelper = useOverrideOpHelper(setUnsavedOverrides, settingsWithOverrides)
	const instantSaveOverrideHelper = useOverrideOpHelper(saveOverrides, settingsWithOverrides)

	const updateObjectId = useCallback(
		(oldId: string, newId: string) => {
			if (oldId === newId) return

			batchedOverrideHelper().changeItemId(oldId, newId).commit()
			setUpdatedIds((prev) => {
				const next = new Map<string, string>()
				let composedExistingRename = false

				for (const [originalId, currentId] of prev) {
					if (currentId === oldId) {
						composedExistingRename = true
						if (originalId !== newId) next.set(originalId, newId)
					} else {
						next.set(originalId, currentId)
					}
				}

				if (!composedExistingRename) next.set(oldId, newId)
				return next
			})
		},
		[batchedOverrideHelper]
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
			if (!studioId) return

			const relatedIds = getRelatedItemIds(itemId)
			const currentOverrides = unsavedOverrides ?? persistedOverrides
			const currentItemOps = relatedIds.flatMap((id) => getOpsForItem(currentOverrides, id))
			const persistedWithoutItem = removeOpsForItems(persistedOverrides, relatedIds)
			const nextPersistedOverrides = [...persistedWithoutItem, ...currentItemOps]

			Studios.update(studioId, {
				$set: {
					[overridePath]: nextPersistedOverrides,
				},
			})

			if (clearSavedItemFromStaged) {
				const remainingCurrentOverrides = removeOpsForItems(currentOverrides, relatedIds)
				if (JSON.stringify(remainingCurrentOverrides) === JSON.stringify(persistedWithoutItem)) {
					setUnsavedOverrides(undefined)
				} else {
					setUnsavedOverrides(remainingCurrentOverrides)
				}
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
		[
			clearSavedItemFromStaged,
			getOpsForItem,
			getRelatedItemIds,
			overridePath,
			persistedOverrides,
			removeOpsForItems,
			studioId,
			unsavedOverrides,
		]
	)

	return {
		settingsWithOverrides,
		batchedOverrideHelper,
		instantSaveOverrideHelper,
		hasUnsavedChangesForItem,
		discardItemChanges,
		saveItemChanges,
		updateObjectId,
		updatedIds,
	}
}
