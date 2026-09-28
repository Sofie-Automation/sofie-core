import { addMigrationSteps } from './databaseMigration'
import { serializePieceTimelineObjectsBlob } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { TimelineObjGeneric } from '@sofie-automation/corelib/dist/dataModel/Timeline'
import {
	AdLibPieces,
	BucketAdLibs,
	RundownBaselineAdLibPieces,
	RundownBaselineObjs,
	PieceInstances,
	Pieces,
} from '../collections'

// Release 41
export const addSteps = addMigrationSteps('1.41.0', [
	{
		id: `RundownBaselineObj.timelineObjectsString from objects`,
		canBeRunAutomatically: true,
		validate: async () => {
			const objects = await RundownBaselineObjs.countDocuments({
				objects: { $exists: true },
			})
			if (objects > 0) {
				return `timelineObjects needs to be converted`
			}
			return false
		},
		migrate: async () => {
			const objects = await RundownBaselineObjs.findFetchAsync({
				objects: { $exists: true },
			})
			for (const obj of objects) {
				await RundownBaselineObjs.mutableCollection.updateAsync(obj._id, {
					$set: {
						timelineObjectsString: serializePieceTimelineObjectsBlob(
							(obj as any).objects as TimelineObjGeneric[]
						),
					},
					$unset: {
						objects: 1,
					},
				})
			}
		},
	},
	{
		id: `Pieces.timelineObjectsString`,
		canBeRunAutomatically: true,
		validate: async () => {
			const objects = await Pieces.countDocuments({
				'content.timelineObjects': { $exists: true },
			})
			if (objects > 0) {
				return `timelineObjects needs to be converted`
			}
			return false
		},
		migrate: async () => {
			const objects = await Pieces.findFetchAsync({
				'content.timelineObjects': { $exists: true },
			})
			for (const obj of objects) {
				await Pieces.mutableCollection.updateAsync(obj._id, {
					$set: {
						timelineObjectsString: serializePieceTimelineObjectsBlob((obj as any).content.timelineObjects),
					},
					$unset: {
						'content.timelineObjects': 1,
					},
				})
			}
		},
	},
	{
		id: `AdLibPieces.timelineObjectsString`,
		canBeRunAutomatically: true,
		validate: async () => {
			const objects = await AdLibPieces.countDocuments({
				'content.timelineObjects': { $exists: true },
			})
			if (objects > 0) {
				return `timelineObjects needs to be converted`
			}
			return false
		},
		migrate: async () => {
			const objects = await AdLibPieces.findFetchAsync({
				'content.timelineObjects': { $exists: true },
			})
			for (const obj of objects) {
				await AdLibPieces.mutableCollection.updateAsync(obj._id, {
					$set: {
						timelineObjectsString: serializePieceTimelineObjectsBlob((obj as any).content.timelineObjects),
					},
					$unset: {
						'content.timelineObjects': 1,
					},
				})
			}
		},
	},
	{
		id: `RundownBaselineAdLibPieces.timelineObjectsString`,
		canBeRunAutomatically: true,
		validate: async () => {
			const objects = await RundownBaselineAdLibPieces.countDocuments({
				'content.timelineObjects': { $exists: true },
			})
			if (objects > 0) {
				return `timelineObjects needs to be converted`
			}
			return false
		},
		migrate: async () => {
			const objects = await RundownBaselineAdLibPieces.findFetchAsync({
				'content.timelineObjects': { $exists: true },
			})
			for (const obj of objects) {
				await RundownBaselineAdLibPieces.mutableCollection.updateAsync(obj._id, {
					$set: {
						timelineObjectsString: serializePieceTimelineObjectsBlob((obj as any).content.timelineObjects),
					},
					$unset: {
						'content.timelineObjects': 1,
					},
				})
			}
		},
	},
	{
		id: `BucketAdLibs.timelineObjectsString`,
		canBeRunAutomatically: true,
		validate: async () => {
			const objects = await BucketAdLibs.countDocuments({
				'content.timelineObjects': { $exists: true },
			})
			if (objects > 0) {
				return `timelineObjects needs to be converted`
			}
			return false
		},
		migrate: async () => {
			const objects = await BucketAdLibs.findFetchAsync({
				'content.timelineObjects': { $exists: true },
			})
			for (const obj of objects) {
				await BucketAdLibs.updateAsync(obj._id, {
					$set: {
						timelineObjectsString: serializePieceTimelineObjectsBlob((obj as any).content.timelineObjects),
					},
					$unset: {
						'content.timelineObjects': 1,
					},
				})
			}
		},
	},
	{
		id: `PieceInstances.timelineObjectsString`,
		canBeRunAutomatically: true,
		validate: async () => {
			const objects = await PieceInstances.countDocuments({
				'piece.content.timelineObjects': { $exists: true },
			})
			if (objects > 0) {
				return `timelineObjects needs to be converted`
			}
			return false
		},
		migrate: async () => {
			const objects = await PieceInstances.findFetchAsync({
				'piece.content.timelineObjects': { $exists: true },
			})
			for (const obj of objects) {
				await PieceInstances.mutableCollection.updateAsync(obj._id, {
					$set: {
						timelineObjectsString: serializePieceTimelineObjectsBlob(
							(obj as any).piece.content.timelineObjects
						),
					},
					$unset: {
						'piece.content.timelineObjects': 1,
					},
				})
			}
		},
	},
])
