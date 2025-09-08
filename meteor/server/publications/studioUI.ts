import { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { MongoFieldSpecifierOnesStrict } from '@sofie-automation/corelib/dist/mongo'
import { applyAndValidateOverrides } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { ReadonlyDeep } from 'type-fest'
import { CustomCollectionName, MeteorPubSub } from '@sofie-automation/meteor-lib/dist/api/pubsub'
import { UIStudio } from '@sofie-automation/meteor-lib/dist/api/studios'
import { DBStudio } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { Complete, literal } from '../lib/tempLib'
import {
	CustomPublishCollection,
	meteorCustomPublish,
	setUpCollectionOptimizedObserver,
	SetupObserversResult,
	TriggerUpdate,
} from '../lib/customPublication'
import { Studios } from '../collections'
import { check, Match } from 'meteor/check'
import { triggerWriteAccessBecauseNoCheckNecessary } from '../security/securityVerify'

interface UIStudioArgs {
	readonly studioId: StudioId | null
}

type UIStudioState = Record<string, never>

interface UIStudioUpdateProps {
	invalidateStudioIds: StudioId[]
}

function convertDocument(studio: Pick<DBStudio, StudioFields>): UIStudio {
	return literal<Complete<UIStudio>>({
		_id: studio._id,
		name: studio.name,
		mappings: applyAndValidateOverrides(studio.mappingsWithOverrides).obj,

		settings: applyAndValidateOverrides(studio.settingsWithOverrides).obj,

		routeSets: applyAndValidateOverrides(studio.routeSetsWithOverrides).obj,
		routeSetExclusivityGroups: applyAndValidateOverrides(studio.routeSetExclusivityGroupsWithOverrides).obj,
	})
}

type StudioFields =
	| '_id'
	| 'name'
	| 'mappingsWithOverrides'
	| 'settingsWithOverrides'
	| 'routeSetsWithOverrides'
	| 'routeSetExclusivityGroupsWithOverrides'
const fieldSpecifier = literal<MongoFieldSpecifierOnesStrict<Pick<DBStudio, StudioFields>>>({
	_id: 1,
	name: 1,
	mappingsWithOverrides: 1,
	settingsWithOverrides: 1,
	routeSetsWithOverrides: 1,
	routeSetExclusivityGroupsWithOverrides: 1,
})

async function setupUIStudioPublicationObservers(
	args: ReadonlyDeep<UIStudioArgs>,
	triggerUpdate: TriggerUpdate<UIStudioUpdateProps>
): Promise<SetupObserversResult> {
	const trackChange = (id: StudioId): Partial<UIStudioUpdateProps> => ({
		invalidateStudioIds: [id],
	})

	// Set up observers:
	return [
		Studios.observeChanges(
			args.studioId ? args.studioId : {},
			{
				added: (id) => triggerUpdate(trackChange(id)),
				changed: (id) => triggerUpdate(trackChange(id)),
				removed: (id) => triggerUpdate(trackChange(id)),
			},
			{ projection: fieldSpecifier }
		),
	]
}
async function manipulateUIStudioPublicationData(
	args: UIStudioArgs,
	_state: Partial<UIStudioState>,
	collection: CustomPublishCollection<UIStudio>,
	updateProps: ReadonlyDeep<Partial<UIStudioUpdateProps>> | undefined
): Promise<void> {
	// Prepare data for publication:

	if (args.studioId) {
		// Operate on a single studio
		const studio = (await Studios.findOneAsync(args.studioId, { projection: fieldSpecifier })) as
			| Pick<DBStudio, StudioFields>
			| undefined

		if (studio) {
			collection.replace(convertDocument(studio))
		} else {
			collection.remove(args.studioId)
		}
	} else {
		if (!updateProps) {
			// First run
			const docs = (await Studios.findFetchAsync({}, { projection: fieldSpecifier })) as Array<
				Pick<DBStudio, StudioFields>
			>

			for (const doc of docs) {
				collection.insert(convertDocument(doc))
			}
		} else if (updateProps.invalidateStudioIds && updateProps.invalidateStudioIds.length > 0) {
			const changedIds = updateProps.invalidateStudioIds

			// Remove them from the state, so that we detect deletions
			for (const id of changedIds) {
				collection.remove(id)
			}

			const docs = await Studios.findFetchAsync({ _id: { $in: changedIds as StudioId[] } })
			for (const doc of docs) {
				collection.replace(convertDocument(doc))
			}
		}
	}
}

meteorCustomPublish(
	MeteorPubSub.uiStudio,
	CustomCollectionName.UIStudio,
	async function (pub, studioId: StudioId | null) {
		check(studioId, Match.Maybe(String))

		triggerWriteAccessBecauseNoCheckNecessary()

		await setUpCollectionOptimizedObserver<UIStudio, UIStudioArgs, UIStudioState, UIStudioUpdateProps>(
			`pub_${MeteorPubSub.uiStudio}_${studioId}`,
			{ studioId },
			setupUIStudioPublicationObservers,
			manipulateUIStudioPublicationData,
			pub
		)
	}
)
