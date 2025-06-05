import type { ShowStyleBaseId, TriggeredActionId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { TriggeredActions } from '../../collections'
import { Complete, getRandomId, literal, normalizeArrayToMap } from '@sofie-automation/corelib/dist/lib'
import type { DBTriggeredActions } from '@sofie-automation/meteor-lib/dist/collections/TriggeredActions'
import type { AnyBulkWriteOperation } from 'mongodb'
import { wrapDefaultObject } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import type { IBlueprintTriggeredActions } from '@sofie-automation/blueprints-integration'

export async function updateTriggeredActionsForShowStyleBaseId(
	showStyleBaseId: ShowStyleBaseId | null,
	triggeredActions: IBlueprintTriggeredActions[]
): Promise<void> {
	const oldTriggeredActionsArray = await TriggeredActions.findFetchAsync({
		showStyleBaseId: showStyleBaseId,
		blueprintUniqueId: { $ne: null },
	})
	const oldTriggeredActions = normalizeArrayToMap(oldTriggeredActionsArray, 'blueprintUniqueId')

	const newDocIds: TriggeredActionId[] = []
	const bulkOps: AnyBulkWriteOperation<DBTriggeredActions>[] = []

	for (const newTriggeredAction of triggeredActions) {
		const oldValue = oldTriggeredActions.get(newTriggeredAction._id)
		if (oldValue) {
			// Update an existing TriggeredAction
			newDocIds.push(oldValue._id)
			bulkOps.push({
				updateOne: {
					filter: {
						_id: oldValue._id,
					},
					update: {
						$set: {
							_rank: newTriggeredAction._rank,
							name: newTriggeredAction.name,
							'triggersWithOverrides.defaults': newTriggeredAction.triggers,
							'actionsWithOverrides.defaults': newTriggeredAction.actions,
						},
					},
				},
			})
		} else {
			// Insert a new TriggeredAction
			const newDocId = getRandomId<TriggeredActionId>()
			newDocIds.push(newDocId)
			bulkOps.push({
				insertOne: {
					document: literal<Complete<DBTriggeredActions>>({
						_id: newDocId,
						_rank: newTriggeredAction._rank,
						name: newTriggeredAction.name,
						showStyleBaseId: showStyleBaseId,
						blueprintUniqueId: newTriggeredAction._id,
						triggersWithOverrides: wrapDefaultObject(newTriggeredAction.triggers),
						actionsWithOverrides: wrapDefaultObject(newTriggeredAction.actions),
						styleClassNames: newTriggeredAction.styleClassNames,
					}),
				},
			})
		}
	}

	// Remove any removed TriggeredAction
	// Future: should this orphan them or something? Will that cause issues if they get re-added?
	bulkOps.push({
		deleteMany: {
			filter: {
				showStyleBaseId: showStyleBaseId,
				blueprintUniqueId: { $ne: null },
				_id: { $nin: newDocIds },
			},
		},
	})

	await TriggeredActions.bulkWriteAsync(bulkOps)
}
