import type { RundownId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { NrcsIngestCacheType } from '@sofie-automation/corelib/dist/dataModel/NrcsIngestDataCache'
import {
	IngestRundownStatus,
	IngestPartPlaybackStatus,
	IngestRundownActiveStatus,
	IngestPartStatus,
	IngestPartNotifyItemReady,
} from '@sofie-automation/shared-lib/dist/ingest/rundownStatus'
import type { ReadonlyDeep } from 'type-fest'
import _ from 'underscore'
import type { ContentCache, PartCompact, PartInstanceCompact, PlaylistCompact } from './reactiveContentCache'
import { InMemoryMongoCollection } from '@sofie-automation/corelib/dist/memoryCollection'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'

export function createIngestRundownStatus(
	cache: ReadonlyDeep<ContentCache>,
	rundownId: RundownId
): IngestRundownStatus | null {
	const rundown = cache.Rundowns.findOne(rundownId)
	if (!rundown) return null

	const newDoc: IngestRundownStatus = {
		_id: rundownId,
		externalId: rundown.externalId,

		active: IngestRundownActiveStatus.INACTIVE,

		segments: [],
	}

	const playlist = cache.Playlists.findOne({
		_id: rundown.playlistId,
		activationId: { $exists: true },
	})

	if (playlist) {
		newDoc.active = playlist.rehearsal ? IngestRundownActiveStatus.REHEARSAL : IngestRundownActiveStatus.ACTIVE
	}

	const nrcsSegments = cache.NrcsIngestData.findFetch({ rundownId, type: NrcsIngestCacheType.SEGMENT })
	for (const nrcsSegment of nrcsSegments) {
		const nrcsParts = cache.NrcsIngestData.findFetch({
			rundownId,
			segmentId: nrcsSegment.segmentId,
			type: NrcsIngestCacheType.PART,
		})

		newDoc.segments.push({
			externalId: nrcsSegment.data.externalId,
			parts: _.compact(
				nrcsParts.map((nrcsPart) => {
					if (!nrcsPart.partId || !nrcsPart.segmentId) return null

					const parts = cache.Parts.findFetch({
						rundownId: rundownId,
						$or: [
							{
								externalId: nrcsPart.data.externalId,
								ingestNotifyPartExternalId: { $exists: false },
							},
							{
								ingestNotifyPartExternalId: nrcsPart.data.externalId,
							},
						],
					})
					const partInstances = findPartInstancesForIngestPart(
						playlist,
						rundownId,
						cache.PartInstances,
						nrcsPart.data.externalId
					)

					return createIngestPartStatus(playlist, partInstances, parts, nrcsPart.data.externalId)
				})
			),
		})
	}

	return newDoc
}

function findPartInstancesForIngestPart(
	playlist: PlaylistCompact | undefined,
	rundownId: RundownId,
	partInstancesCache: ReadonlyDeep<InMemoryMongoCollection<PartInstanceCompact>>,
	partExternalId: string
) {
	const result: Record<string, PartInstanceCompact> = {}
	if (!playlist) return result

	const candidatePartInstances = partInstancesCache.findFetch({
		rundownId: rundownId,
		$or: [
			{
				'part.externalId': partExternalId,
				'part.ingestNotifyPartExternalId': { $exists: false },
			},
			{
				'part.ingestNotifyPartExternalId': partExternalId,
			},
		],
	})

	for (const partInstance of candidatePartInstances) {
		if (partInstance.rundownId !== rundownId) continue
		// Ignore the next partinstance
		if (partInstance._id === playlist.nextPartInfo?.partInstanceId) continue

		const partId = unprotectString(partInstance.part._id)

		// The current part instance is the most important
		if (partInstance._id === playlist.currentPartInfo?.partInstanceId) {
			result[partId] = partInstance
			continue
		}

		// Take the part with the highest takeCount
		const existingEntry = result[partId]
		if (!existingEntry || existingEntry.takeCount < partInstance.takeCount) {
			result[partId] = partInstance
		}
	}

	return result
}

function createIngestPartStatus(
	playlist: PlaylistCompact | undefined,
	partInstances: Record<string, PartInstanceCompact>,
	parts: PartCompact[],
	ingestPartExternalId: string
): IngestPartStatus {
	// Determine the playback status from the PartInstance
	let playbackStatus = IngestPartPlaybackStatus.UNKNOWN

	let isReady: boolean | null = null // Start off as null, the first value will make this true or false

	const itemsReady: IngestPartNotifyItemReady[] = []

	const updateStatusWithPart = (part: PartCompact) => {
		// If the part affects the ready status, update it
		if (typeof part.ingestNotifyPartReady === 'boolean') {
			isReady = (isReady ?? true) && part.ingestNotifyPartReady
		}

		// Include the items
		if (part.ingestNotifyItemsReady) {
			itemsReady.push(...part.ingestNotifyItemsReady)
		}
	}

	// Loop through the partInstances, starting off the state
	if (playlist) {
		for (const partInstance of Object.values<PartInstanceCompact>(partInstances)) {
			if (!partInstance) continue

			if (partInstance.part.shouldNotifyCurrentPlayingPart) {
				const isCurrentPartInstance = playlist.currentPartInfo?.partInstanceId === partInstance._id

				if (isCurrentPartInstance) {
					// If the current, it is playing
					playbackStatus = IngestPartPlaybackStatus.PLAY
				} else if (playbackStatus === IngestPartPlaybackStatus.UNKNOWN) {
					// If not the current, but has been played, it is stopped
					playbackStatus = IngestPartPlaybackStatus.STOP
				}
			}

			updateStatusWithPart(partInstance.part)
		}
	}

	for (const part of parts) {
		// Check if the part has already been handled by a partInstance
		if (partInstances[unprotectString(part._id)]) continue

		updateStatusWithPart(part)
	}

	return {
		externalId: ingestPartExternalId,

		isReady: isReady,
		itemsReady: itemsReady,

		playbackStatus,
	}
}
