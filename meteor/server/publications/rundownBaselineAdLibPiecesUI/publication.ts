import { PieceId, RundownId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { check, zAnyArray } from '../../lib/check'
import {
	CustomPublishCollection,
	SetupObserversResult,
	TriggerUpdate,
	setUpCollectionOptimizedObserver,
} from '../../lib/customPublication'
import { logger } from '../../logging'
import { CorelibPubSub } from '@sofie-automation/corelib/dist/pubsub'
import { CustomCollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
import { ContentCache, RundownBaselineAdLibItemOmitedFields, createReactiveContentCache } from './reactiveContentCache'
import { ReadonlyDeep } from 'type-fest'
import { ProtectedString } from '@sofie-automation/corelib/dist/protectedString'
import { RundownBaselineAdLibItem } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineAdLibPiece'
import { RundownContentObserver, UIRundownBaselineAdLibPiecesArgs } from './rundownContentObserver'
import { triggerWriteAccessBecauseNoCheckNecessary } from '../../security/securityVerify'
import type { PublicationRegistry } from '../../publicationRegistry'

type PublicationDoc = Omit<RundownBaselineAdLibItem, RundownBaselineAdLibItemOmitedFields>

export interface UIRundownBaselineAdLibPiecesState {
	contentCache: ReadonlyDeep<ContentCache>
}

interface UIRundownBaselineAdLibPiecesUpdateProps {
	newCache: ContentCache

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

	state.contentCache.RundownBaselineAdLibPieces.findFetch({}).forEach((adLibPiece) => {
		if (invalidatedAdLibPiecesSet.has(adLibPiece._id)) {
			// Note: this is where any transformation of the RundownBaselineAdLibItem will be performed
			collection.replace(adLibPiece)
		}
	})
}

/** Dedupe and sort a list of ids, so that it forms a stable key for the optimized observer */
function normaliseIds<T extends ProtectedString<any>>(ids: T[]): T[] {
	return Array.from(new Set(ids)).sort()
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
