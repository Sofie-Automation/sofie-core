import { RundownBaselineAdLibActionId, RundownId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { check, zAnyArray } from '../../lib/check'
import {
	CustomPublishCollection,
	SetupObserversResult,
	TriggerUpdate,
	setUpCollectionOptimizedObserver,
} from '../../lib/customPublication'
import { normaliseIds } from '../lib/lib'
import { logger } from '../../logging'
import { CorelibPubSub } from '@sofie-automation/corelib/dist/pubsub'
import { CustomCollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
import {
	ContentCache,
	RundownBaselineAdLibActionOmitedFields,
	createReactiveContentCache,
} from './reactiveContentCache'
import { ReadonlyDeep } from 'type-fest'
import { RundownBaselineAdLibAction } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineAdLibAction'
import { RundownContentObserver, UIRundownBaselineAdLibActionsArgs } from './rundownContentObserver'
import { triggerWriteAccessBecauseNoCheckNecessary } from '../../security/securityVerify'
import type { PublicationRegistry } from '../../publicationRegistry'

type PublicationDoc = Omit<RundownBaselineAdLibAction, RundownBaselineAdLibActionOmitedFields>

export interface UIRundownBaselineAdLibActionsState {
	contentCache: ReadonlyDeep<ContentCache>
}

interface UIRundownBaselineAdLibActionsUpdateProps {
	newCache: ContentCache

	invalidateAdLibActionIds: RundownBaselineAdLibActionId[]
}

async function setupUIRundownBaselineAdLibActionsPublicationObservers(
	args: ReadonlyDeep<UIRundownBaselineAdLibActionsArgs>,
	triggerUpdate: TriggerUpdate<UIRundownBaselineAdLibActionsUpdateProps>
): Promise<SetupObserversResult> {
	logger.silly(`Creating new RundownContentObserver`)

	const cache = createReactiveContentCache()

	// Push update
	triggerUpdate({ newCache: cache })

	const contentObserver = await RundownContentObserver.create(args, cache)

	// Note: this is attached after the content observer has been populated, so it will be told about
	// every document already in the cache
	const innerQueries = [
		cache.RundownBaselineAdLibActions.observeChanges({
			added: (id) => triggerUpdate({ invalidateAdLibActionIds: [id] }),
			changed: (id) => triggerUpdate({ invalidateAdLibActionIds: [id] }),
			removed: (id) => triggerUpdate({ invalidateAdLibActionIds: [id] }),
		}),
	]

	// Set up observers:
	return [
		{
			stop: () => {
				contentObserver.dispose()

				for (const query of innerQueries) {
					query.stop()
				}
			},
		},
	]
}

export async function manipulateUIRundownBaselineAdLibActionsPublicationData(
	_args: ReadonlyDeep<UIRundownBaselineAdLibActionsArgs>,
	state: Partial<UIRundownBaselineAdLibActionsState>,
	collection: CustomPublishCollection<PublicationDoc>,
	updateProps: Partial<ReadonlyDeep<UIRundownBaselineAdLibActionsUpdateProps>> | undefined
): Promise<void> {
	// Prepare data for publication:

	if (updateProps?.newCache !== undefined) {
		state.contentCache = updateProps.newCache ?? undefined
	}

	if (!state.contentCache) {
		// Remove all the adLibActions
		collection.remove(null)

		return
	}

	updateProps?.invalidateAdLibActionIds?.forEach((adLibActionId) => {
		collection.remove(adLibActionId) // if it still exists, it will be replaced in the next step
	})

	const invalidatedAdLibActionsSet = new Set(updateProps?.invalidateAdLibActionIds ?? [])

	state.contentCache.RundownBaselineAdLibActions.findFetch({}).forEach((adLibAction) => {
		if (invalidatedAdLibActionsSet.has(adLibAction._id)) {
			// Note: this is where any transformation of the RundownBaselineAdLibAction will be performed
			collection.replace(adLibAction)
		}
	})
}

export function registerRundownBaselineAdLibActionsUIPublications(registry: PublicationRegistry): void {
	registry.customPublish(
		CorelibPubSub.uiRundownBaselineAdLibActions,
		CustomCollectionName.UIRundownBaselineAdLibActions,
		async (_context, pub, rundownIds: RundownId[]) => {
			check(rundownIds, zAnyArray)

			triggerWriteAccessBecauseNoCheckNecessary()

			if (rundownIds.length === 0) {
				// Nothing can match, so publish an empty (but ready) collection
				pub.init([])
				return
			}

			const args: UIRundownBaselineAdLibActionsArgs = {
				// Note: the id array is deduped and sorted, so that subscriptions which differ only in the
				// ordering of their arguments are able to share an optimized observer
				rundownIds: normaliseIds(rundownIds),
			}

			await setUpCollectionOptimizedObserver<
				PublicationDoc,
				UIRundownBaselineAdLibActionsArgs,
				UIRundownBaselineAdLibActionsState,
				UIRundownBaselineAdLibActionsUpdateProps
			>(
				`pub_${CustomCollectionName.UIRundownBaselineAdLibActions}_${JSON.stringify(args)}`,
				args,
				setupUIRundownBaselineAdLibActionsPublicationObservers,
				manipulateUIRundownBaselineAdLibActionsPublicationData,
				pub
			)
		}
	)
}
