import { resolveAdLibActionForBranding } from '@sofie-automation/corelib/dist/playout/branding'
import { BrandingState, updateProjectedBrandingId } from '../lib/branding'
import { z } from 'zod'
import { AdLibActionId, PartId, RundownId } from '@sofie-automation/corelib/dist/dataModel/Ids'
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
import { ContentCache, AdLibActionOmitedFields, createReactiveContentCache } from './reactiveContentCache'
import { ReadonlyDeep } from 'type-fest'
import { AdLibAction } from '@sofie-automation/corelib/dist/dataModel/AdlibAction'
import { RundownContentObserver, UIAdLibActionsArgs } from './rundownContentObserver'
import { triggerWriteAccessBecauseNoCheckNecessary } from '../../security/securityVerify'
import type { PublicationRegistry } from '../../publicationRegistry'
import type { CustomPublish } from '../../lib/customPublication'

export interface UIAdLibActionsState extends BrandingState {
	contentCache: ReadonlyDeep<ContentCache>
}

interface UIAdLibActionsUpdateProps {
	newCache: ContentCache

	/** The Branding may have changed, so it must be resolved again to check */
	invalidateBranding: boolean

	invalidateAdLibActionIds: AdLibActionId[]
}

async function setupUIAdLibActionsPublicationObservers(
	args: ReadonlyDeep<UIAdLibActionsArgs>,
	triggerUpdate: TriggerUpdate<UIAdLibActionsUpdateProps>
): Promise<SetupObserversResult> {
	logger.silly(`Creating new RundownContentObserver`)

	const cache = createReactiveContentCache()

	// Push update
	triggerUpdate({ newCache: cache })

	const contentObserver = await RundownContentObserver.create(args, cache)

	// Note: this is attached after the content observer has been populated, so it will be told about
	// every document already in the cache
	const innerQueries = [
		// Any change to these means the Branding may have changed
		cache.RundownPlaylists.observeChanges({
			added: () => triggerUpdate({ invalidateBranding: true }),
			changed: () => triggerUpdate({ invalidateBranding: true }),
			removed: () => triggerUpdate({ invalidateBranding: true }),
		}),
		cache.PartInstances.observeChanges({
			added: () => triggerUpdate({ invalidateBranding: true }),
			changed: () => triggerUpdate({ invalidateBranding: true }),
			removed: () => triggerUpdate({ invalidateBranding: true }),
		}),
		cache.AdLibActions.observeChanges({
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

export async function manipulateUIAdLibActionsPublicationData(
	_args: ReadonlyDeep<UIAdLibActionsArgs>,
	state: Partial<UIAdLibActionsState>,
	collection: CustomPublishCollection<Omit<AdLibAction, AdLibActionOmitedFields>>,
	updateProps: Partial<ReadonlyDeep<UIAdLibActionsUpdateProps>> | undefined
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

	const { brandingId, brandingChanged } = updateProjectedBrandingId(state, state.contentCache)

	for (const adLibAction of state.contentCache.AdLibActions.findFetch({})) {
		if (!brandingChanged && !invalidatedAdLibActionsSet.has(adLibAction._id)) continue

		// Flatten the Branding overrides, so that consumers see the document as it should be displayed
		const resolved = resolveAdLibActionForBranding(adLibAction, brandingId)
		if (!resolved) {
			// Not used with this Branding
			collection.remove(adLibAction._id)
			continue
		}

		collection.replace(resolved)
	}
}

async function setUpUIAdLibActionsObserver(
	args: UIAdLibActionsArgs,
	pub: CustomPublish<Omit<AdLibAction, AdLibActionOmitedFields>>
): Promise<void> {
	await setUpCollectionOptimizedObserver<
		Omit<AdLibAction, AdLibActionOmitedFields>,
		UIAdLibActionsArgs,
		UIAdLibActionsState,
		UIAdLibActionsUpdateProps
	>(
		`pub_${CustomCollectionName.UIAdLibActions}_${JSON.stringify(args)}`,
		args,
		setupUIAdLibActionsPublicationObservers,
		manipulateUIAdLibActionsPublicationData,
		pub
	)
}

export function registerAdLibActionsUIPublications(registry: PublicationRegistry): void {
	registry.customPublish(
		CorelibPubSub.uiAdLibActions,
		CustomCollectionName.UIAdLibActions,
		async (_context, pub, rundownIds: RundownId[]) => {
			check(rundownIds, zAnyArray)

			triggerWriteAccessBecauseNoCheckNecessary()

			if (rundownIds.length === 0) {
				// Nothing can match, so publish an empty (but ready) collection
				pub.init([])
				return
			}

			await setUpUIAdLibActionsObserver(
				{
					type: 'inRundowns',
					// Note: the id array is deduped and sorted, so that subscriptions which differ only in the
					// ordering of their arguments are able to share an optimized observer
					rundownIds: normaliseIds(rundownIds),
				},
				pub
			)
		}
	)

	registry.customPublish(
		CorelibPubSub.uiAdLibActionsForPart,
		CustomCollectionName.UIAdLibActions,
		async (_context, pub, partId: PartId, sourceLayerIds: string[]) => {
			check(partId, z.string())
			check(sourceLayerIds, zAnyArray)

			triggerWriteAccessBecauseNoCheckNecessary()

			if (sourceLayerIds.length === 0) {
				// Nothing can match, so publish an empty (but ready) collection
				pub.init([])
				return
			}

			await setUpUIAdLibActionsObserver(
				{
					type: 'forPart',
					partId,
					sourceLayerIds: normaliseIds(sourceLayerIds),
				},
				pub
			)
		}
	)
}
