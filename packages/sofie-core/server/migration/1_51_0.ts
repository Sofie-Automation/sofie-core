import { addMigrationSteps } from './databaseMigration'

import { PieceInstances, Pieces, Rundowns } from '../collections'
import { RundownOrphanedReason, RundownSource } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { PeripheralDeviceId, RundownId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { JSONBlobStringify } from '@sofie-automation/blueprints-integration'

// Release 51

interface RemovedRundownProps {
	/** The peripheral device the rundown originates from */
	peripheralDeviceId?: PeripheralDeviceId
	restoredFromSnapshotId?: RundownId
	externalNRCSName: string
}

export const addSteps = addMigrationSteps('1.51.0', [
	{
		id: `Rundowns without source`,
		canBeRunAutomatically: true,
		validate: async () => {
			const objects = await Rundowns.findFetchAsync({
				source: { $exists: false },
			})

			if (objects.length > 0) {
				return `object needs to be updated`
			}
			return false
		},
		migrate: async () => {
			const objects = await Rundowns.findFetchAsync({
				source: { $exists: false },
			})
			for (const obj of objects) {
				const oldPartialObj = obj as any as RemovedRundownProps

				let newSource: RundownSource = {
					type: 'http', // Fallback
				}
				if (oldPartialObj.peripheralDeviceId) {
					newSource = {
						type: 'nrcs',
						peripheralDeviceId: oldPartialObj.peripheralDeviceId,
						nrcsName: oldPartialObj.externalNRCSName,
					}
				} else if (oldPartialObj.restoredFromSnapshotId) {
					newSource = {
						type: 'snapshot',
						rundownId: oldPartialObj.restoredFromSnapshotId,
					}
				}

				await Rundowns.mutableCollection.updateAsync(obj._id, {
					$set: {
						source: newSource,
					},
					$unset: {
						peripheralDeviceId: 1,
						externalNrcsName: 1,
						restoredFromSnapshotId: 1,
					},
				})
			}
		},
	},
	{
		id: `Rundowns remove orphaned FROM_SNAPSHOT`,
		canBeRunAutomatically: true,
		validate: async () => {
			const objects = await Rundowns.findFetchAsync({
				orphaned: 'from-snapshot' as any,
			})

			if (objects.length > 0) {
				return `object needs to be updated`
			}
			return false
		},
		migrate: async () => {
			await Rundowns.mutableCollection.updateAsync(
				{
					orphaned: 'from-snapshot' as any,
				},
				{
					$set: {
						orphaned: RundownOrphanedReason.DELETED,
					},
				},
				{
					multi: true,
				}
			)
		},
	},
	{
		id: `Pieces update NoraContent`,
		canBeRunAutomatically: true,
		validate: async () => {
			const objects = await Pieces.findFetchAsync({
				'content.previewRenderer': { $exists: true },
				'content.payload': { $exists: true },
				'content.previewPayload': { $exists: false },
			})

			if (objects.length > 0) {
				return `object needs to be updated`
			}
			return false
		},
		migrate: async () => {
			const objects = await Pieces.findFetchAsync({
				'content.previewRenderer': { $exists: true },
				'content.payload': { $exists: true },
				'content.previewPayload': { $exists: false },
			})

			for (const piece of objects) {
				await Pieces.mutableCollection.updateAsync(piece._id, {
					$set: {
						'content.previewPayload': JSONBlobStringify((piece.content as any).payload),
					},
					$unset: {
						'content.payload': 1,
					},
				})
			}
		},
	},
	{
		id: `PieceInstances update NoraContent`,
		canBeRunAutomatically: true,
		validate: async () => {
			const objects = await PieceInstances.findFetchAsync({
				'piece.content.previewRenderer': { $exists: true },
				'piece.content.payload': { $exists: true },
				'piece.content.previewPayload': { $exists: false },
			})

			if (objects.length > 0) {
				return `object needs to be updated`
			}
			return false
		},
		migrate: async () => {
			const objects = await PieceInstances.findFetchAsync({
				'piece.content.previewRenderer': { $exists: true },
				'piece.content.payload': { $exists: true },
				'piece.content.previewPayload': { $exists: false },
			})

			for (const piece of objects) {
				await PieceInstances.mutableCollection.updateAsync(piece._id, {
					$set: {
						'piece.content.previewPayload': JSONBlobStringify((piece.piece.content as any).payload),
					},
					$unset: {
						'piece.content.payload': 1,
					},
				})
			}
		},
	},
])
