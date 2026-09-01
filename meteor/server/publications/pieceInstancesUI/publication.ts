import { z } from 'zod'
import { PartInstanceId, PieceInstanceId, RundownId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { RundownPlaylistActivationId } from '@sofie-automation/corelib/dist/dataModel/Ids'
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
import { ContentCache, PieceInstanceOmitedFields, createReactiveContentCache } from './reactiveContentCache'
import { ReadonlyDeep } from 'type-fest'
import { PieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { RundownContentObserver, UIPieceInstancesArgs } from './rundownContentObserver'
import { resolvePieceForBranding } from '@sofie-automation/corelib/dist/playout/branding'
import { triggerWriteAccessBecauseNoCheckNecessary } from '../../security/securityVerify'
import type { PublicationRegistry } from '../../publicationRegistry'

export interface UIPieceInstancesState {
	contentCache: ReadonlyDeep<ContentCache>
}

interface UIPieceInstancesUpdateProps {
	newCache: ContentCache

	invalidatePieceInstanceIds: PieceInstanceId[]
	/** PartInstances whose Branding changed, so every PieceInstance in them must be resolved again */
	invalidatePartInstanceIds: PartInstanceId[]
}

async function setupUIPieceInstancesPublicationObservers(
	args: ReadonlyDeep<UIPieceInstancesArgs>,
	triggerUpdate: TriggerUpdate<UIPieceInstancesUpdateProps>
): Promise<SetupObserversResult> {
	logger.silly(`Creating new RundownContentObserver`)

	const cache = createReactiveContentCache()

	// Push update
	triggerUpdate({ newCache: cache })

	const contentObserver = await RundownContentObserver.create(args, cache)

	// Note: this is attached after the content observer has been populated, so it will be told about
	// every document already in the cache
	const innerQueries = [
		cache.PieceInstances.observeChanges({
			added: (id) => triggerUpdate({ invalidatePieceInstanceIds: [id] }),
			changed: (id) => triggerUpdate({ invalidatePieceInstanceIds: [id] }),
			removed: (id) => triggerUpdate({ invalidatePieceInstanceIds: [id] }),
		}),
		// Only the Branding is tracked for these, so any change means the PieceInstances must be resolved again
		cache.PartInstances.observeChanges({
			added: (id) => triggerUpdate({ invalidatePartInstanceIds: [id] }),
			changed: (id) => triggerUpdate({ invalidatePartInstanceIds: [id] }),
			removed: (id) => triggerUpdate({ invalidatePartInstanceIds: [id] }),
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

export async function manipulateUIPieceInstancesPublicationData(
	_args: ReadonlyDeep<UIPieceInstancesArgs>,
	state: Partial<UIPieceInstancesState>,
	collection: CustomPublishCollection<Omit<PieceInstance, PieceInstanceOmitedFields>>,
	updateProps: Partial<ReadonlyDeep<UIPieceInstancesUpdateProps>> | undefined
): Promise<void> {
	// Prepare data for publication:

	if (updateProps?.newCache !== undefined) {
		state.contentCache = updateProps.newCache ?? undefined
	}

	if (!state.contentCache) {
		// Remove all the pieceInstances
		collection.remove(null)

		return
	}

	updateProps?.invalidatePieceInstanceIds?.forEach((pieceInstanceId) => {
		collection.remove(pieceInstanceId) // if it still exists, it will be replaced in the next step
	})

	const invalidatedPieceInstancesSet = new Set(updateProps?.invalidatePieceInstanceIds ?? [])
	const invalidatedPartInstancesSet = new Set(updateProps?.invalidatePartInstanceIds ?? [])

	const partInstanceBrandings = new Map<PartInstanceId, string | null>()
	for (const partInstance of state.contentCache.PartInstances.findFetch({})) {
		partInstanceBrandings.set(partInstance._id, partInstance.brandingId ?? null)
	}

	for (const pieceInstance of state.contentCache.PieceInstances.findFetch({})) {
		if (
			!invalidatedPieceInstancesSet.has(pieceInstance._id) &&
			!invalidatedPartInstancesSet.has(pieceInstance.partInstanceId)
		)
			continue

		// Flatten the Branding overrides, so that consumers see the Piece as it should be displayed
		const brandingId = partInstanceBrandings.get(pieceInstance.partInstanceId) ?? null
		const resolvedPiece = resolvePieceForBranding(pieceInstance.piece, brandingId)
		if (!resolvedPiece) {
			// The Piece is not used with this Branding
			collection.remove(pieceInstance._id)
			continue
		}
		pieceInstance.piece = resolvedPiece

		collection.replace(pieceInstance)
	}
}

export function registerPieceInstancesUIPublications(registry: PublicationRegistry): void {
	registry.customPublish(
		CorelibPubSub.uiPieceInstances,
		CustomCollectionName.UIPieceInstances,
		async (
			_context,
			pub,
			rundownIds: RundownId[],
			partInstanceIds: PartInstanceId[] | null,
			playlistActivationId: RundownPlaylistActivationId | null,
			filter: {
				onlyPlayingAdlibsOrWithTags?: boolean
				omitTimings?: boolean
			}
		) => {
			check(rundownIds, zAnyArray)
			check(partInstanceIds, zAnyArray.nullish())
			check(playlistActivationId, z.string().nullish())

			triggerWriteAccessBecauseNoCheckNecessary()

			// If values were provided, they must have values
			if (rundownIds.length === 0 || (partInstanceIds && partInstanceIds.length === 0)) {
				// Nothing can match, so publish an empty (but ready) collection
				pub.init([])
				return
			}

			const args: UIPieceInstancesArgs = {
				// Note: the id arrays are deduped and sorted, so that subscriptions which differ only in the
				// ordering of their arguments are able to share an optimized observer
				rundownIds: normaliseIds(rundownIds),
				partInstanceIds: partInstanceIds ? normaliseIds(partInstanceIds) : null,
				playlistActivationId: playlistActivationId ?? null,
				onlyPlayingAdlibsOrWithTags: !!filter?.onlyPlayingAdlibsOrWithTags,
				omitTimings: !!filter?.omitTimings,
			}

			await setUpCollectionOptimizedObserver<
				Omit<PieceInstance, PieceInstanceOmitedFields>,
				UIPieceInstancesArgs,
				UIPieceInstancesState,
				UIPieceInstancesUpdateProps
			>(
				`pub_${CorelibPubSub.uiPieceInstances}_${JSON.stringify(args)}`,
				args,
				setupUIPieceInstancesPublicationObservers,
				manipulateUIPieceInstancesPublicationData,
				pub
			)
		}
	)
}
