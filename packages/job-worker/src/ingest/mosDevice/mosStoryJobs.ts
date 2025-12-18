import {
	MosDeleteStoryProps,
	MosFullStoryProps,
	MosInsertStoryProps,
	MosMoveStoryProps,
	MosSwapStoryProps,
} from '@sofie-automation/corelib/dist/worker/ingest'
import { logger } from '../../logging.js'
import { JobContext } from '../../jobs/index.js'
import {
	fixIllegalObject,
	getMosIngestSegmentExternalId,
	mosStoryToIngestSegment,
	parseMosString,
	updateRanksBasedOnOrder,
} from './lib.js'
import {
	IngestChangeType,
	IngestSegment,
	MOS,
	NrcsIngestPartChangeDetails,
	NrcsIngestSegmentChangeDetails,
	NrcsIngestSegmentChangeDetailsEnum,
} from '@sofie-automation/blueprints-integration'
import { IngestUpdateOperationFunction } from '../runOperation.js'
import { normalizeArrayToMap } from '@sofie-automation/corelib/dist/lib'
import { IngestRundownWithSource } from '@sofie-automation/corelib/dist/dataModel/NrcsIngestDataCache'

/**
 * Update the payload of a mos story
 */
export function handleMosFullStory(
	_context: JobContext,
	data: MosFullStoryProps
): IngestUpdateOperationFunction | null {
	fixIllegalObject(data.story)

	const partExternalId = parseMosString(data.story.ID)

	return (ingestRundown: IngestRundownWithSource | undefined) => {
		if (!ingestRundown) {
			throw new Error(`Rundown "${data.rundownExternalId}" not found`)
		}

		// It appears that the name can't change during a fullStory. (based on a few years of usage)
		// If it can then we need to be sure to update the segment groupings too

		const segmentExternalId = getMosIngestSegmentExternalId(partExternalId)

		const ingestSegment = ingestRundown.segments.find((s) => s.externalId === segmentExternalId)
		const ingestPart = ingestSegment?.parts.find((p) => p.externalId === partExternalId)

		if (!ingestPart)
			// Part was not found
			throw new Error(
				`handleMosFullStory: Missing MOS Story "${partExternalId}" in Rundown ingest data for "${data.rundownExternalId}"`
			)

		// We modify in-place
		ingestPart.payload = data.story

		return {
			// We modify in-place
			ingestRundown,
			changes: {
				source: IngestChangeType.Ingest,
				segmentChanges: {
					[segmentExternalId]: {
						partChanges: {
							[ingestPart.externalId]: NrcsIngestPartChangeDetails.Updated,
						},
					},
				},
			},
		}
	}
}

/**
 * Delete a mos story
 */
export function handleMosDeleteStory(
	_context: JobContext,
	data: MosDeleteStoryProps
): IngestUpdateOperationFunction | null {
	if (data.stories.length === 0) return null

	return (ingestRundown: IngestRundownWithSource | undefined) => {
		if (!ingestRundown) {
			throw new Error(`Rundown "${data.rundownExternalId}" not found`)
		}

		const storyIdsToDelete = data.stories.map(parseMosString)
		const segmentExternalIdsToDelete = storyIdsToDelete.map(getMosIngestSegmentExternalId)

		logger.debug(`handleMosDeleteStory storyIds: [${storyIdsToDelete.join(',')}]`)

		const ingestSegmentIds = new Set(ingestRundown.segments.map((segment) => segment.externalId))

		const missingIds = segmentExternalIdsToDelete.filter((id) => !ingestSegmentIds.has(id))
		if (missingIds.length > 0) {
			throw new Error(`Parts ${missingIds.join(', ')} in rundown ${data.rundownExternalId} were not found`)
		}

		// Remove any segments
		const segmentExternalIdsToDeleteSet = new Set(segmentExternalIdsToDelete)
		ingestRundown.segments = ingestRundown.segments.filter(
			(segment) => !segmentExternalIdsToDeleteSet.has(segment.externalId)
		)

		// compute changes
		const segmentChanges: Record<string, NrcsIngestSegmentChangeDetails> = {}
		for (const segmentId of segmentExternalIdsToDelete) {
			segmentChanges[segmentId] = NrcsIngestSegmentChangeDetailsEnum.Deleted
		}

		return {
			// We modify in-place
			ingestRundown,
			changes: {
				source: IngestChangeType.Ingest,
				segmentChanges,
			},
		}
	}
}

/**
 * Insert a mos story before the referenced existing story
 */
export function handleMosInsertStories(
	_context: JobContext,
	data: MosInsertStoryProps
): IngestUpdateOperationFunction | null {
	if (data.newStories.length === 0) return null

	return (ingestRundown: IngestRundownWithSource | undefined) => {
		if (!ingestRundown) {
			throw new Error(`Rundown "${data.rundownExternalId}" not found`)
		}

		const newIngestSegments = data.newStories.map((story) => mosStoryToIngestSegment(story, true))

		// The part of which we are about to insert stories after
		const insertBeforeSegmentExternalId = storyIdToSegmentExternalId(data.insertBeforeStoryId)
		const insertIndex = insertBeforeSegmentExternalId // insert last
			? ingestRundown.segments.findIndex((p) => p.externalId === insertBeforeSegmentExternalId)
			: ingestRundown.segments.length
		if (insertIndex === -1) {
			throw new Error(
				`Part ${data.insertBeforeStoryId && parseMosString(data.insertBeforeStoryId)} in rundown ${
					data.rundownExternalId
				} not found`
			)
		}

		const oldSegmentIds = new Set(ingestRundown.segments.map((s) => s.externalId))
		// Allow replacing with itself
		if (data.replace && insertBeforeSegmentExternalId) oldSegmentIds.delete(insertBeforeSegmentExternalId)

		const duplicateSegments = newIngestSegments.filter((segment) => oldSegmentIds.has(segment.externalId))
		if (duplicateSegments.length > 0) {
			throw new Error(
				`Parts ${duplicateSegments.map((s) => s.externalId).join(', ')} already exist in rundown ${
					data.rundownExternalId
				}`
			)
		}

		// Perform the change
		ingestRundown.segments.splice(insertIndex, data.replace ? 1 : 0, ...newIngestSegments)
		updateRanksBasedOnOrder(ingestRundown)

		const segmentChanges: Record<string, NrcsIngestSegmentChangeDetails> = {}
		for (const segment of newIngestSegments) {
			segmentChanges[segment.externalId] = NrcsIngestSegmentChangeDetailsEnum.InsertedOrUpdated
		}
		if (data.replace && insertBeforeSegmentExternalId && !segmentChanges[insertBeforeSegmentExternalId]) {
			segmentChanges[insertBeforeSegmentExternalId] = NrcsIngestSegmentChangeDetailsEnum.Deleted
		}

		return {
			// We modify in-place
			ingestRundown,
			changes: {
				source: IngestChangeType.Ingest,
				segmentChanges: segmentChanges,
				segmentOrderChanged: true,
			},
		}
	}
}

/**
 * Swap positions of two mos stories
 */
export function handleMosSwapStories(
	_context: JobContext,
	data: MosSwapStoryProps
): IngestUpdateOperationFunction | null {
	const story0Str = parseMosString(data.story0)
	const story1Str = parseMosString(data.story1)

	// If the stories are the same, we don't need to do anything
	if (story0Str === story1Str) return null

	return (ingestRundown: IngestRundownWithSource | undefined) => {
		if (!ingestRundown) {
			throw new Error(`Rundown "${data.rundownExternalId}" not found`)
		}

		const segment0Id = getMosIngestSegmentExternalId(parseMosString(data.story0))
		const story0Index = ingestRundown.segments.findIndex((s) => s.externalId === segment0Id)
		if (story0Index === -1) {
			throw new Error(`Story ${story0Str} not found in rundown ${data.rundownExternalId}`)
		}

		const segment1Id = getMosIngestSegmentExternalId(parseMosString(data.story1))
		const story1Index = ingestRundown.segments.findIndex((s) => s.externalId === segment1Id)
		if (story1Index === -1) {
			throw new Error(`Story ${story1Str} not found in rundown ${data.rundownExternalId}`)
		}

		// Fetch the values
		const story0Segment = ingestRundown.segments[story0Index]
		const story1Segment = ingestRundown.segments[story1Index]

		// Store the values
		ingestRundown.segments[story0Index] = story1Segment
		ingestRundown.segments[story1Index] = story0Segment

		updateRanksBasedOnOrder(ingestRundown)

		return {
			// We modify in-place
			ingestRundown,
			changes: {
				source: IngestChangeType.Ingest,
				segmentOrderChanged: true,
			},
		}
	}
}

/**
 * Move a list of mos stories
 */
export function handleMosMoveStories(
	_context: JobContext,
	data: MosMoveStoryProps
): IngestUpdateOperationFunction | null {
	if (data.stories.length === 0) return null

	return (ingestRundown: IngestRundownWithSource | undefined) => {
		if (!ingestRundown) {
			throw new Error(`Rundown "${data.rundownExternalId}" not found`)
		}

		const oldIngestSegmentMap = normalizeArrayToMap(ingestRundown.segments, 'externalId')

		const moveStoryIds = data.stories.map(parseMosString)

		const moveIngestSegments: IngestSegment[] = []
		const missingIds: string[] = []
		for (const storyId of moveStoryIds) {
			const segment = oldIngestSegmentMap.get(getMosIngestSegmentExternalId(storyId))
			if (segment) moveIngestSegments.push(segment)
			else missingIds.push(storyId)
		}

		if (missingIds.length > 0) {
			throw new Error(`Parts ${missingIds.join(', ')} were not found in rundown ${data.rundownExternalId}`)
		}

		// remove existing items
		const moveIngestSegmentIds = moveIngestSegments.map((s) => s.externalId)
		ingestRundown.segments = ingestRundown.segments.filter((s) => !moveIngestSegmentIds.includes(s.externalId))

		// The part of which we are about to insert stories after
		const insertBeforeSegmentExternalId = storyIdToSegmentExternalId(data.insertBeforeStoryId)
		const insertIndex = insertBeforeSegmentExternalId // insert last
			? ingestRundown.segments.findIndex((p) => p.externalId === insertBeforeSegmentExternalId)
			: ingestRundown.segments.length
		if (insertIndex === -1) {
			throw new Error(`Part ${insertBeforeSegmentExternalId} in rundown ${data.rundownExternalId} not found`)
		}

		// Perform the change
		ingestRundown.segments.splice(insertIndex, 0, ...moveIngestSegments)
		updateRanksBasedOnOrder(ingestRundown)

		return {
			// We modify in-place
			ingestRundown,
			changes: {
				source: IngestChangeType.Ingest,
				segmentOrderChanged: true,
			},
		}
	}
}

function storyIdToSegmentExternalId(storyId: MOS.IMOSString128 | null | undefined): string | undefined {
	if (!storyId) return undefined
	const partExternalId = parseMosString(storyId)
	if (!partExternalId) return undefined
	return getMosIngestSegmentExternalId(partExternalId)
}
