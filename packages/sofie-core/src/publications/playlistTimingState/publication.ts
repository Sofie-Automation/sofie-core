import { z } from 'zod'
import { RundownPlaylistId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { MongoFieldSpecifierOnesStrict } from '@sofie-automation/corelib/dist/mongo'
import { ReadonlyDeep } from 'type-fest'
import { CorelibPubSub } from '@sofie-automation/corelib/dist/pubsub'
import { CustomCollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
import {
	getPartTimingStateDocId,
	getPlaylistTimingStateDocId,
	getSegmentTimingStateDocId,
	PartTimingStateDoc,
	PlaylistTimingStateDoc,
	SegmentTimingStateDoc,
	TimingStateDoc,
} from '@sofie-automation/corelib/dist/dataModel/TimingState'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist/RundownPlaylist'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { sortSegmentsInRundowns } from '@sofie-automation/corelib/dist/playout/playlist'
import { DEFAULT_DISPLAY_DURATION } from '@sofie-automation/shared-lib/dist/core/constants'
import { calculatePlaylistTimingStatesFromContext } from './rundownTiming/playlistTimingState'
import { calculateSegmentTimingStates } from './rundownTiming/segmentTimingState'
import { calculatePartTimingStates } from './rundownTiming/partTimingState'
import { prepareTimingPartInstances } from './rundownTiming/prepareTimingInputs'
import { RundownTimingCalculator } from './rundownTiming/index'
import { setUpOptimizedObserverArray, SetupObserversResult, TriggerUpdate } from '../../lib/customPublication'
import { logger } from '../../logging'
import { getCurrentTime } from '../../lib/lib'
import { ContentCache, createReactiveContentCache } from './reactiveContentCache'
import { RundownsObserver } from '../lib/rundownsObserver'
import { RundownContentObserver } from './rundownContentObserver'
import { RundownPlaylists } from '../../collections'
import { check } from '../../lib/check'
import { triggerWriteAccessBecauseNoCheckNecessary } from '../../security/securityVerify'
import type { PublicationRegistry } from '../../publicationRegistry'

interface PlaylistTimingStateArgs {
	readonly playlistId: RundownPlaylistId
}

export interface PlaylistTimingStateState {
	contentCache: ReadonlyDeep<ContentCache>
}

interface PlaylistTimingStateUpdateProps {
	newCache: ContentCache

	/** Some of the timing inputs changed; the (single) doc needs recomputing */
	invalidateTiming: boolean
}

type RundownPlaylistLookupFields = '_id' | 'studioId'
const rundownPlaylistLookupFieldSpecifier = literal<
	MongoFieldSpecifierOnesStrict<Pick<DBRundownPlaylist, RundownPlaylistLookupFields>>
>({
	_id: 1,
	studioId: 1,
})

async function setupPlaylistTimingStatePublicationObservers(
	args: ReadonlyDeep<PlaylistTimingStateArgs>,
	triggerUpdate: TriggerUpdate<PlaylistTimingStateUpdateProps>
): Promise<SetupObserversResult> {
	const playlist = (await RundownPlaylists.findOneAsync(args.playlistId, {
		projection: rundownPlaylistLookupFieldSpecifier,
	})) as Pick<DBRundownPlaylist, RundownPlaylistLookupFields> | undefined
	if (!playlist) throw new Error(`RundownPlaylist "${args.playlistId}" not found!`)

	const rundownsObserver = await RundownsObserver.createForPlaylist(
		playlist.studioId,
		playlist._id,
		async (rundownIds) => {
			logger.silly(`Creating new RundownContentObserver`)

			const cache = createReactiveContentCache()

			// Push update
			triggerUpdate({ newCache: cache })

			// Any change to any of the inputs invalidates the (single) output doc
			const invalidate = () => triggerUpdate({ invalidateTiming: true })

			const contentObserver = await RundownContentObserver.create(
				playlist.studioId,
				args.playlistId,
				rundownIds,
				cache,
				invalidate
			)

			// The Parts and PartInstances are fed by upstream publications, which notify through the
			// callback passed above rather than through collection observers
			const innerQueries = [
				cache.StudioSettings.observeChanges({ added: invalidate, changed: invalidate, removed: invalidate }),
				cache.RundownPlaylists.observeChanges({ added: invalidate, changed: invalidate, removed: invalidate }),
				cache.Segments.observeChanges({ added: invalidate, changed: invalidate, removed: invalidate }),
			]

			return () => {
				contentObserver.dispose()

				for (const query of innerQueries) {
					query.stop()
				}
			}
		}
	)

	// Set up observers:
	return [rundownsObserver]
}

export async function manipulatePlaylistTimingStatePublicationData(
	args: PlaylistTimingStateArgs,
	state: Partial<PlaylistTimingStateState>,
	updateProps: Partial<ReadonlyDeep<PlaylistTimingStateUpdateProps>> | undefined
): Promise<TimingStateDoc[] | null> {
	// Prepare data for publication:

	if (updateProps?.newCache !== undefined) {
		state.contentCache = updateProps.newCache ?? undefined
	}

	if (!state.contentCache) {
		// Nothing to publish
		return []
	}

	if (!isCacheViewConsistent(args.playlistId, state.contentCache)) {
		// Leave what is already published in place until the cache catches up
		return null
	}

	return createTimingStateDocs(args.playlistId, state.contentCache, getCurrentTime())
}

/**
 * Whether the cached documents are a consistent view of the playlist.
 *
 * The playlist and its PartInstances are written concurrently by the job worker, and reach this
 * cache by separate observers, so there is a window in which the playlist names a PartInstance that
 * has not arrived yet. Computing then would silently produce wrong numbers - most visibly, an
 * unresolvable next PartInstance drops every unplayed budgeted segment out of the remaining pool.
 * It is better to publish nothing until the two agree; whatever is missing is on its way, and will
 * trigger another update when it lands.
 *
 * Only applies while the playlist is active: an inactive playlist legitimately has no PartInstances
 * (they are published per activation), so requiring them would mean never publishing at all.
 */
export function isCacheViewConsistent(
	playlistId: RundownPlaylistId,
	contentCache: ReadonlyDeep<ContentCache>
): boolean {
	const playlist = contentCache.RundownPlaylists.findOne(playlistId)
	if (!playlist || !playlist.activationId) return true

	for (const selected of [playlist.currentPartInfo, playlist.nextPartInfo]) {
		if (!selected) continue
		if (!contentCache.PartInstances.findOne(selected.partInstanceId)) return false
	}

	return true
}

/**
 * Compute every timing document for the playlist - the playlist itself, one per segment and one per
 * part - from the cached content, for a given point in time.
 */
export function createTimingStateDocs(
	playlistId: RundownPlaylistId,
	contentCache: ReadonlyDeep<ContentCache>,
	now: number
): TimingStateDoc[] {
	const computed = computeTimingState(playlistId, contentCache, now)
	if (!computed) return []

	return [computed.playlistDoc, ...computed.segmentDocs, ...computed.partDocs]
}

/** Just the playlist-level document. */
export function createPlaylistTimingStateDoc(
	playlistId: RundownPlaylistId,
	contentCache: ReadonlyDeep<ContentCache>,
	now: number
): PlaylistTimingStateDoc | undefined {
	return computeTimingState(playlistId, contentCache, now)?.playlistDoc
}

/**
 * All the timing math lives in ./rundownTiming (server-only); this only feeds it the
 * cached documents, and runs the calculator once for both the playlist and the segments.
 *
 * A document leaves out each field it has no value for, rather than setting it to undefined. The
 * publication keeps a copy of every document it sent, to compare the next recompute with, and a copy
 * has no fields with an undefined value. A field set to undefined would therefore read as changed on
 * every recompute: the document would be copied again and handed to every subscriber as a change,
 * for nothing.
 */
function computeTimingState(
	playlistId: RundownPlaylistId,
	contentCache: ReadonlyDeep<ContentCache>,
	now: number
):
	| { playlistDoc: PlaylistTimingStateDoc; segmentDocs: SegmentTimingStateDoc[]; partDocs: PartTimingStateDoc[] }
	| undefined {
	// Note: the casts below are safe because the cache projections include every field the timing
	// calculations read
	const playlist = contentCache.RundownPlaylists.findOne(playlistId) as unknown as DBRundownPlaylist | undefined
	if (!playlist) return undefined

	const studioSettings = contentCache.StudioSettings.findOne(playlist.studioId)
	const defaultDuration = studioSettings?.settings?.defaultDisplayDuration ?? DEFAULT_DISPLAY_DURATION

	const segments = sortSegmentsInRundowns(
		contentCache.Segments.findFetch({}),
		playlist.rundownIdsInOrder
	) as unknown as DBSegment[]
	const segmentsMap = new Map<SegmentId, DBSegment>(segments.map((segment) => [segment._id, segment]))

	const unorderedParts = contentCache.Parts.findFetch({}) as unknown as DBPart[]
	// These are real PartInstances, as opposed to the temporary ones prepareTimingPartInstances
	// wraps the not-yet-played Parts in
	const activePartInstances = contentCache.PartInstances.findFetch({}, { sort: { takeCount: 1 } }).map(
		(partInstance) => ({ ...partInstance, isTemporary: false })
	)

	const { partInstances, partsInQuickLoop } = prepareTimingPartInstances(
		playlist,
		segments,
		unorderedParts,
		activePartInstances
	)

	const timingContext = new RundownTimingCalculator().updateDurations(
		now,
		false,
		playlist,
		partInstances,
		segmentsMap,
		defaultDuration,
		partsInQuickLoop
	)

	const segmentStates = calculateSegmentTimingStates(now, timingContext, partInstances, segmentsMap)
	const partStates = calculatePartTimingStates(timingContext, partInstances)

	// The part states are keyed by PartId; the PartInstance each was resolved from carries the rest
	// of the document's identity
	const partInstancesByPartId = new Map(partInstances.map((partInstance) => [partInstance.part._id, partInstance]))

	return {
		playlistDoc: {
			_id: getPlaylistTimingStateDocId(playlistId),
			type: 'playlist',
			playlistId,
			...calculatePlaylistTimingStatesFromContext(now, playlist, timingContext),
		},
		segmentDocs: Array.from(segmentStates.entries(), ([segmentId, values]) => ({
			_id: getSegmentTimingStateDocId(segmentId),
			type: 'segment' as const,
			playlistId,
			segmentId,
			...values,
		})),
		partDocs: Array.from(partStates.entries(), ([partId, values]) => {
			const partInstance = partInstancesByPartId.get(partId)

			const partDoc: PartTimingStateDoc = {
				_id: getPartTimingStateDocId(partId),
				type: 'part',
				playlistId,
				segmentId: partInstance?.segmentId as SegmentId,
				partId,
				...values,
			}

			// temporary instances are wrappers around a Part that has never been played, so they
			// have no PartInstance identity to report
			const isRealPartInstance = partInstance !== undefined && !partInstance.isTemporary
			if (isRealPartInstance) partDoc.partInstanceId = partInstance._id

			return partDoc
		}),
	}
}

export function registerPlaylistTimingStatePublications(registry: PublicationRegistry): void {
	registry.customPublish(
		CorelibPubSub.playlistTimingState,
		CustomCollectionName.PlaylistTimingState,
		async (_context, pub, playlistId: RundownPlaylistId | null) => {
			check(playlistId, z.string().nullish())

			triggerWriteAccessBecauseNoCheckNecessary()

			if (!playlistId) {
				logger.info(`Pub.${CustomCollectionName.PlaylistTimingState}: Not playlistId`)
				return
			}

			await setUpOptimizedObserverArray<
				TimingStateDoc,
				PlaylistTimingStateArgs,
				PlaylistTimingStateState,
				PlaylistTimingStateUpdateProps
			>(
				`pub_${CorelibPubSub.playlistTimingState}_${playlistId}`,
				{ playlistId },
				setupPlaylistTimingStatePublicationObservers,
				manipulatePlaylistTimingStatePublicationData,
				pub,
				50
			)
		}
	)
}
