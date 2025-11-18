import { ShowStyleBaseId, TriggeredActionId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { applyAndValidateOverrides } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { ReadonlyDeep } from 'type-fest'
import { CustomCollectionName, MeteorPubSub } from '@sofie-automation/meteor-lib/dist/api/pubsub'
import {
	DBTriggeredActions,
	UITriggeredActionsObj,
} from '@sofie-automation/meteor-lib/dist/collections/TriggeredActions'
import { Complete, literal } from '@sofie-automation/corelib/dist/lib'
import {
	CustomPublishCollection,
	meteorCustomPublish,
	setUpCollectionOptimizedObserver,
	SetupObserversResult,
	TriggerUpdate,
} from '../lib/customPublication'
import { TriggeredActions } from '../collections'
import { check, Match } from 'meteor/check'
import { MongoQuery } from '@sofie-automation/corelib/dist/mongo'
import { triggerWriteAccessBecauseNoCheckNecessary } from '../security/securityVerify'

interface UITriggeredActionsArgs {
	readonly showStyleBaseId: ShowStyleBaseId | null
}

type UITriggeredActionsState = Record<string, never>

interface UITriggeredActionsUpdateProps {
	invalidateTriggeredActions: TriggeredActionId[]
}

function compileMongoSelector(
	showStyleBaseId: ShowStyleBaseId | null,
	docIds?: readonly TriggeredActionId[]
): MongoQuery<DBTriggeredActions> {
	const selector: MongoQuery<DBTriggeredActions> = { showStyleBaseId: null }
	if (showStyleBaseId) {
		selector.showStyleBaseId = { $in: [null, showStyleBaseId] }
	}
	if (docIds) {
		selector._id = { $in: docIds as TriggeredActionId[] }
	}
	return selector
}

function convertDocument(doc: DBTriggeredActions): UITriggeredActionsObj {
	return literal<Complete<UITriggeredActionsObj>>({
		_id: doc._id,
		_rank: doc._rank,

		showStyleBaseId: doc.showStyleBaseId,
		name: doc.name,

		actions: applyAndValidateOverrides(doc.actionsWithOverrides).obj,
		triggers: applyAndValidateOverrides(doc.triggersWithOverrides).obj,

		styleClassNames: doc.styleClassNames,
	})
}

async function setupUITriggeredActionsPublicationObservers(
	args: ReadonlyDeep<UITriggeredActionsArgs>,
	triggerUpdate: TriggerUpdate<UITriggeredActionsUpdateProps>
): Promise<SetupObserversResult> {
	const trackChange = (id: TriggeredActionId): Partial<UITriggeredActionsUpdateProps> => ({
		invalidateTriggeredActions: [id],
	})

	// Set up observers:
	return [
		TriggeredActions.observeChanges(compileMongoSelector(args.showStyleBaseId), {
			added: (id) => triggerUpdate(trackChange(id)),
			changed: (id) => triggerUpdate(trackChange(id)),
			removed: (id) => triggerUpdate(trackChange(id)),
		}),
	]
}
async function manipulateUITriggeredActionsPublicationData(
	args: UITriggeredActionsArgs,
	_state: Partial<UITriggeredActionsState>,
	collection: CustomPublishCollection<UITriggeredActionsObj>,
	updateProps: Partial<ReadonlyDeep<UITriggeredActionsUpdateProps>> | undefined
): Promise<void> {
	// Prepare data for publication:

	if (!updateProps) {
		// First run
		const docs = await TriggeredActions.findFetchAsync(compileMongoSelector(args.showStyleBaseId))

		for (const doc of docs) {
			collection.insert(convertDocument(doc))
		}
	} else if (updateProps.invalidateTriggeredActions && updateProps.invalidateTriggeredActions.length > 0) {
		const changedIds = updateProps.invalidateTriggeredActions

		// Remove them from the state, so that we detect deletions
		for (const id of changedIds) {
			collection.remove(id)
		}

		const docs = await TriggeredActions.findFetchAsync(compileMongoSelector(args.showStyleBaseId, changedIds))
		for (const doc of docs) {
			collection.replace(convertDocument(doc))
		}
	}
}

meteorCustomPublish(
	MeteorPubSub.uiTriggeredActions,
	CustomCollectionName.UITriggeredActions,
	async function (pub, showStyleBaseId: ShowStyleBaseId | null) {
		check(showStyleBaseId, Match.Maybe(String))

		triggerWriteAccessBecauseNoCheckNecessary()

		await setUpCollectionOptimizedObserver<
			UITriggeredActionsObj,
			UITriggeredActionsArgs,
			UITriggeredActionsState,
			UITriggeredActionsUpdateProps
		>(
			`pub_${MeteorPubSub.uiTriggeredActions}_${showStyleBaseId}`,
			{ showStyleBaseId },
			setupUITriggeredActionsPublicationObservers,
			manipulateUITriggeredActionsPublicationData,
			pub
		)
	}
)
