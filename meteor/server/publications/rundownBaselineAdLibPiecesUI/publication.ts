import { resolvePieceForBranding } from '@sofie-automation/corelib/dist/playout/branding'
import { BrandingState, updateProjectedBrandingId } from '../lib/branding'
import { PieceId, RundownId } from '@sofie-automation/corelib/dist/dataModel/Ids'
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
import { ContentCache, RundownBaselineAdLibItemOmitedFields, createReactiveContentCache } from './reactiveContentCache'
import { ReadonlyDeep } from 'type-fest'
import { RundownBaselineAdLibItem } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineAdLibPiece'
import { RundownContentObserver, UIRundownBaselineAdLibPiecesArgs } from './rundownContentObserver'
import { triggerWriteAccessBecauseNoCheckNecessary } from '../../security/securityVerify'
import type { PublicationRegistry } from '../../publicationRegistry'

type PublicationDoc = Omit<RundownBaselineAdLibItem, RundownBaselineAdLibItemOmitedFields>

export interface UIRundownBaselineAdLibPiecesState extends BrandingState {
	contentCache: ReadonlyDeep<ContentCache>
}

interface UIRundownBaselineAdLibPiecesUpdateProps {
	newCache: ContentCache

	/** The Branding may have changed, so it must be resolved again to check */
	invalidateBranding: boolean

	invalidateAdLibPieceIds: PieceId[]
}

async function setupUIRundownBaselineAdLibPiecesPublicationObservers(
	args: ReadonlyDeep<UIRundownBaselineAdLibPiecesArgs>,
	triggerUpdate: TriggerUpdate<UIRundownBaselineAdLibPiecesUpdateProps>
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
		cache.RundownBaselineAdLibPieces.observeChanges({
			added: (id) => triggerUpdate({ invalidateAdLibPieceIds: [id] }),
			changed: (id) => triggerUpdate({ invalidateAdLibPieceIds: [id] }),
			removed: (id) => triggerUpdate({ invalidateAdLibPieceIds: [id] }),
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

export async function manipulateUIRundownBaselineAdLibPiecesPublicationData(
	_args: ReadonlyDeep<UIRundownBaselineAdLibPiecesArgs>,
	state: Partial<UIRundownBaselineAdLibPiecesState>,
	collection: CustomPublishCollection<PublicationDoc>,
	updateProps: Partial<ReadonlyDeep<UIRundownBaselineAdLibPiecesUpdateProps>> | undefined
): Promise<void> {
	// Prepare data for publication:

	if (updateProps?.newCache !== undefined) {
		state.contentCache = updateProps.newCache ?? undefined
	}

	if (!state.contentCache) {
		// Remove all the adLibPieces
		collection.remove(null)

		return
	}

	updateProps?.invalidateAdLibPieceIds?.forEach((adLibPieceId) => {
		collection.remove(adLibPieceId) // if it still exists, it will be replaced in the next step
	})

	const invalidatedAdLibPiecesSet = new Set(updateProps?.invalidateAdLibPieceIds ?? [])

	const { brandingId, brandingChanged } = updateProjectedBrandingId(state, state.contentCache)

	for (const adLibPiece of state.contentCache.RundownBaselineAdLibPieces.findFetch({})) {
		if (!brandingChanged && !invalidatedAdLibPiecesSet.has(adLibPiece._id)) continue

		// Flatten the Branding overrides, so that consumers see the document as it should be displayed
		const resolved = resolvePieceForBranding(adLibPiece, brandingId)
		if (!resolved) {
			// Not used with this Branding
			collection.remove(adLibPiece._id)
			continue
		}

		collection.replace(resolved)
	}
}

export function registerRundownBaselineAdLibPiecesUIPublications(registry: PublicationRegistry): void {
	registry.customPublish(
		CorelibPubSub.uiRundownBaselineAdLibPieces,
		CustomCollectionName.UIRundownBaselineAdLibPieces,
		async (_context, pub, rundownIds: RundownId[]) => {
			check(rundownIds, zAnyArray)

			triggerWriteAccessBecauseNoCheckNecessary()

			if (rundownIds.length === 0) {
				// Nothing can match, so publish an empty (but ready) collection
				pub.init([])
				return
			}

			const args: UIRundownBaselineAdLibPiecesArgs = {
				// Note: the id array is deduped and sorted, so that subscriptions which differ only in the
				// ordering of their arguments are able to share an optimized observer
				rundownIds: normaliseIds(rundownIds),
			}

			await setUpCollectionOptimizedObserver<
				PublicationDoc,
				UIRundownBaselineAdLibPiecesArgs,
				UIRundownBaselineAdLibPiecesState,
				UIRundownBaselineAdLibPiecesUpdateProps
			>(
				`pub_${CustomCollectionName.UIRundownBaselineAdLibPieces}_${JSON.stringify(args)}`,
				args,
				setupUIRundownBaselineAdLibPiecesPublicationObservers,
				manipulateUIRundownBaselineAdLibPiecesPublicationData,
				pub
			)
		}
	)
}
