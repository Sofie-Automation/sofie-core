import { resolvePieceForBranding } from '@sofie-automation/corelib/dist/playout/branding'
import { BrandingState, updateProjectedBrandingId } from '../lib/branding'
import { z } from 'zod'
import { PartId, PieceId, RundownId, SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
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
import { ContentCache, PieceOmitedFields, createReactiveContentCache } from './reactiveContentCache'
import { ReadonlyDeep } from 'type-fest'
import { Piece } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { RundownContentObserver, UIPiecesArgs } from './rundownContentObserver'
import { triggerWriteAccessBecauseNoCheckNecessary } from '../../security/securityVerify'
import type { PublicationRegistry } from '../../publicationRegistry'
import type { CustomPublish } from '../../lib/customPublication'

export interface UIPiecesState extends BrandingState {
	contentCache: ReadonlyDeep<ContentCache>
}

interface UIPiecesUpdateProps {
	newCache: ContentCache

	/** The Branding may have changed, so it must be resolved again to check */
	invalidateBranding: boolean

	invalidatePieceIds: PieceId[]
}

async function setupUIPiecesPublicationObservers(
	args: ReadonlyDeep<UIPiecesArgs>,
	triggerUpdate: TriggerUpdate<UIPiecesUpdateProps>
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
		cache.Pieces.observeChanges({
			added: (id) => triggerUpdate({ invalidatePieceIds: [id] }),
			changed: (id) => triggerUpdate({ invalidatePieceIds: [id] }),
			removed: (id) => triggerUpdate({ invalidatePieceIds: [id] }),
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

export async function manipulateUIPiecesPublicationData(
	_args: ReadonlyDeep<UIPiecesArgs>,
	state: Partial<UIPiecesState>,
	collection: CustomPublishCollection<Omit<Piece, PieceOmitedFields>>,
	updateProps: Partial<ReadonlyDeep<UIPiecesUpdateProps>> | undefined
): Promise<void> {
	// Prepare data for publication:

	if (updateProps?.newCache !== undefined) {
		state.contentCache = updateProps.newCache ?? undefined
	}

	if (!state.contentCache) {
		// Remove all the pieces
		collection.remove(null)

		return
	}

	updateProps?.invalidatePieceIds?.forEach((pieceId) => {
		collection.remove(pieceId) // if it still exists, it will be replaced in the next step
	})

	const invalidatedPiecesSet = new Set(updateProps?.invalidatePieceIds ?? [])

	const { brandingId, brandingChanged } = updateProjectedBrandingId(state, state.contentCache)

	for (const piece of state.contentCache.Pieces.findFetch({})) {
		if (!brandingChanged && !invalidatedPiecesSet.has(piece._id)) continue

		// Flatten the Branding overrides, so that consumers see the document as it should be displayed
		const resolved = resolvePieceForBranding(piece, brandingId)
		if (!resolved) {
			// Not used with this Branding
			collection.remove(piece._id)
			continue
		}

		collection.replace(resolved)
	}
}

async function setUpUIPiecesObserver(
	args: UIPiecesArgs,
	pub: CustomPublish<Omit<Piece, PieceOmitedFields>>
): Promise<void> {
	await setUpCollectionOptimizedObserver<
		Omit<Piece, PieceOmitedFields>,
		UIPiecesArgs,
		UIPiecesState,
		UIPiecesUpdateProps
	>(
		`pub_${CustomCollectionName.UIPieces}_${JSON.stringify(args)}`,
		args,
		setupUIPiecesPublicationObservers,
		manipulateUIPiecesPublicationData,
		pub
	)
}

export function registerPiecesUIPublications(registry: PublicationRegistry): void {
	registry.customPublish(
		CorelibPubSub.uiPieces,
		CustomCollectionName.UIPieces,
		async (_context, pub, rundownIds: RundownId[], partIds: PartId[] | null) => {
			check(rundownIds, zAnyArray)
			check(partIds, zAnyArray.nullish())

			triggerWriteAccessBecauseNoCheckNecessary()

			// If values were provided, they must have values
			if (rundownIds.length === 0 || (partIds && partIds.length === 0)) {
				// Nothing can match, so publish an empty (but ready) collection
				pub.init([])
				return
			}

			await setUpUIPiecesObserver(
				{
					type: 'inParts',
					// Note: the id arrays are deduped and sorted, so that subscriptions which differ only in the
					// ordering of their arguments are able to share an optimized observer
					rundownIds: normaliseIds(rundownIds),
					partIds: partIds ? normaliseIds(partIds) : null,
				},
				pub
			)
		}
	)

	registry.customPublish(
		CorelibPubSub.uiPiecesInfiniteStartingBefore,
		CustomCollectionName.UIPieces,
		async (
			_context,
			pub,
			thisRundownId: RundownId,
			segmentsIdsBefore: SegmentId[],
			rundownIdsBefore: RundownId[]
		) => {
			check(thisRundownId, z.string())
			check(segmentsIdsBefore, zAnyArray)
			check(rundownIdsBefore, zAnyArray)

			triggerWriteAccessBecauseNoCheckNecessary()

			await setUpUIPiecesObserver(
				{
					type: 'infinitesStartingBefore',
					thisRundownId,
					segmentIdsBefore: normaliseIds(segmentsIdsBefore),
					rundownIdsBefore: normaliseIds(rundownIdsBefore),
				},
				pub
			)
		}
	)
}
