import { z } from 'zod'
import { PieceId, PartId, RundownId } from '@sofie-automation/corelib/dist/dataModel/Ids'
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
import { ContentCache, AdLibPieceOmitedFields, createReactiveContentCache } from './reactiveContentCache'
import { ReadonlyDeep } from 'type-fest'
import { AdLibPiece } from '@sofie-automation/corelib/dist/dataModel/AdLibPiece'
import { RundownContentObserver, UIAdLibPiecesArgs } from './rundownContentObserver'
import { triggerWriteAccessBecauseNoCheckNecessary } from '../../security/securityVerify'
import type { PublicationRegistry } from '../../publicationRegistry'
import type { CustomPublish } from '../../lib/customPublication'

export interface UIAdLibPiecesState {
	contentCache: ReadonlyDeep<ContentCache>
}

interface UIAdLibPiecesUpdateProps {
	newCache: ContentCache

	invalidateAdLibPieceIds: PieceId[]
}

async function setupUIAdLibPiecesPublicationObservers(
	args: ReadonlyDeep<UIAdLibPiecesArgs>,
	triggerUpdate: TriggerUpdate<UIAdLibPiecesUpdateProps>
): Promise<SetupObserversResult> {
	logger.silly(`Creating new RundownContentObserver`)

	const cache = createReactiveContentCache()

	// Push update
	triggerUpdate({ newCache: cache })

	const contentObserver = await RundownContentObserver.create(args, cache)

	// Note: this is attached after the content observer has been populated, so it will be told about
	// every document already in the cache
	const innerQueries = [
		cache.AdLibPieces.observeChanges({
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

export async function manipulateUIAdLibPiecesPublicationData(
	_args: ReadonlyDeep<UIAdLibPiecesArgs>,
	state: Partial<UIAdLibPiecesState>,
	collection: CustomPublishCollection<Omit<AdLibPiece, AdLibPieceOmitedFields>>,
	updateProps: Partial<ReadonlyDeep<UIAdLibPiecesUpdateProps>> | undefined
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

	state.contentCache.AdLibPieces.findFetch({}).forEach((adLibPiece) => {
		if (invalidatedAdLibPiecesSet.has(adLibPiece._id)) {
			// Note: this is where any transformation of the AdLibPiece will be performed
			collection.replace(adLibPiece)
		}
	})
}

async function setUpUIAdLibPiecesObserver(
	args: UIAdLibPiecesArgs,
	pub: CustomPublish<Omit<AdLibPiece, AdLibPieceOmitedFields>>
): Promise<void> {
	await setUpCollectionOptimizedObserver<
		Omit<AdLibPiece, AdLibPieceOmitedFields>,
		UIAdLibPiecesArgs,
		UIAdLibPiecesState,
		UIAdLibPiecesUpdateProps
	>(
		`pub_${CustomCollectionName.UIAdLibPieces}_${JSON.stringify(args)}`,
		args,
		setupUIAdLibPiecesPublicationObservers,
		manipulateUIAdLibPiecesPublicationData,
		pub
	)
}

export function registerAdLibPiecesUIPublications(registry: PublicationRegistry): void {
	registry.customPublish(
		CorelibPubSub.uiAdLibPieces,
		CustomCollectionName.UIAdLibPieces,
		async (_context, pub, rundownIds: RundownId[]) => {
			check(rundownIds, zAnyArray)

			triggerWriteAccessBecauseNoCheckNecessary()

			if (rundownIds.length === 0) {
				// Nothing can match, so publish an empty (but ready) collection
				pub.init([])
				return
			}

			await setUpUIAdLibPiecesObserver(
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
		CorelibPubSub.uiAdLibPiecesForPart,
		CustomCollectionName.UIAdLibPieces,
		async (_context, pub, partId: PartId, sourceLayerIds: string[]) => {
			check(partId, z.string())
			check(sourceLayerIds, zAnyArray)

			triggerWriteAccessBecauseNoCheckNecessary()

			if (sourceLayerIds.length === 0) {
				// Nothing can match, so publish an empty (but ready) collection
				pub.init([])
				return
			}

			await setUpUIAdLibPiecesObserver(
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
