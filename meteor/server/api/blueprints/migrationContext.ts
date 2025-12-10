import { getHash, clone, Complete } from '@sofie-automation/corelib/dist/lib'
import { protectString, unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { Meteor } from 'meteor/meteor'
import {
	MigrationContextSystem as IMigrationContextSystem,
	IBlueprintTriggeredActions,
} from '@sofie-automation/blueprints-integration'
import { check } from '../../lib/check'
import { TriggeredActionsObj } from '@sofie-automation/meteor-lib/dist/collections/TriggeredActions'
import { Match } from 'meteor/check'
import { wrapDefaultObject } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { ShowStyleBaseId, TriggeredActionId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { TriggeredActions } from '../../collections'

function convertTriggeredActionToBlueprints(triggeredAction: TriggeredActionsObj): IBlueprintTriggeredActions {
	const obj: Complete<IBlueprintTriggeredActions> = {
		_id: unprotectString(triggeredAction._id),
		_rank: triggeredAction._rank,
		name: triggeredAction.name,
		triggers: clone(triggeredAction.triggersWithOverrides.defaults),
		actions: clone(triggeredAction.actionsWithOverrides.defaults),
		styleClassNames: triggeredAction.styleClassNames,
	}

	return obj
}

class AbstractMigrationContextWithTriggeredActions {
	protected showStyleBaseId: ShowStyleBaseId | null = null
	getTriggeredActionId(triggeredActionId: string): string {
		return getHash((this.showStyleBaseId ?? 'core') + '_' + triggeredActionId)
	}
	private getProtectedTriggeredActionId(triggeredActionId: string): TriggeredActionId {
		return protectString(this.getTriggeredActionId(triggeredActionId))
	}
	async getAllTriggeredActions(): Promise<IBlueprintTriggeredActions[]> {
		return (
			await TriggeredActions.findFetchAsync({
				showStyleBaseId: this.showStyleBaseId,
			})
		).map(convertTriggeredActionToBlueprints)
	}
	private async getTriggeredActionFromDb(triggeredActionId: string): Promise<TriggeredActionsObj | undefined> {
		const triggeredAction = await TriggeredActions.findOneAsync({
			showStyleBaseId: this.showStyleBaseId,
			_id: this.getProtectedTriggeredActionId(triggeredActionId),
		})
		if (triggeredAction) return triggeredAction

		// Assume we were given the full id
		return TriggeredActions.findOneAsync({
			showStyleBaseId: this.showStyleBaseId,
			_id: protectString(triggeredActionId),
		})
	}
	async getTriggeredAction(triggeredActionId: string): Promise<IBlueprintTriggeredActions | undefined> {
		check(triggeredActionId, String)
		if (!triggeredActionId) {
			throw new Meteor.Error(500, `Triggered actions Id "${triggeredActionId}" is invalid`)
		}

		const obj = await this.getTriggeredActionFromDb(triggeredActionId)
		return obj ? convertTriggeredActionToBlueprints(obj) : undefined
	}
	async setTriggeredAction(triggeredActions: IBlueprintTriggeredActions): Promise<void> {
		check(triggeredActions, Object)
		check(triggeredActions._id, String)
		check(triggeredActions._rank, Number)
		check(triggeredActions.actions, Object)
		check(triggeredActions.triggers, Object)
		check(triggeredActions.name, Match.OneOf(Match.Optional(Object), Match.Optional(String)))
		if (!triggeredActions) {
			throw new Meteor.Error(500, `Triggered Actions object is invalid`)
		}

		const newObj: Omit<TriggeredActionsObj, '_id' | '_rundownVersionHash' | 'showStyleBaseId'> = {
			// _rundownVersionHash: '',
			// _id: this.getProtectedTriggeredActionId(triggeredActions._id),
			_rank: triggeredActions._rank,
			name: triggeredActions.name,
			triggersWithOverrides: wrapDefaultObject(triggeredActions.triggers),
			actionsWithOverrides: wrapDefaultObject(triggeredActions.actions),
			blueprintUniqueId: triggeredActions._id,
		}

		const currentTriggeredAction = await this.getTriggeredActionFromDb(triggeredActions._id)
		if (!currentTriggeredAction) {
			await TriggeredActions.insertAsync({
				...newObj,
				showStyleBaseId: this.showStyleBaseId,
				_id: this.getProtectedTriggeredActionId(triggeredActions._id),
			})
		} else {
			await TriggeredActions.updateAsync(
				{
					_id: currentTriggeredAction._id,
				},
				{
					$set: newObj,
				},
				{ multi: true }
			)
		}
	}
	async removeTriggeredAction(triggeredActionId: string): Promise<void> {
		check(triggeredActionId, String)
		if (!triggeredActionId) {
			throw new Meteor.Error(500, `Triggered actions Id "${triggeredActionId}" is invalid`)
		}

		const currentTriggeredAction = await this.getTriggeredActionFromDb(triggeredActionId)
		if (currentTriggeredAction) {
			await TriggeredActions.removeAsync({
				_id: currentTriggeredAction._id,
				showStyleBaseId: this.showStyleBaseId,
			})
		}
	}
}

export class MigrationContextSystem
	extends AbstractMigrationContextWithTriggeredActions
	implements IMigrationContextSystem {}
