import {
	GroupPartsInMosRundownAndChangesResult,
	IngestChangeType,
	IngestPart,
	IngestRundown,
	IngestSegment,
	NrcsIngestChangeDetails,
	NrcsIngestPartChangeDetails,
	NrcsIngestRundownChangeDetails,
	NrcsIngestSegmentChangeDetails,
	NrcsIngestSegmentChangeDetailsEnum,
} from '@sofie-automation/blueprints-integration'
import { Complete, normalizeArrayToMap } from '@sofie-automation/corelib/dist/lib'
import _ from 'underscore'

/**
 * Groups parts in a MOS rundown into segments, using a separator of the part names.
 * For example:
 * - "UN;story A"
 * - "UN;story B"
 * becomes a "UN" segment with two parts (story A and story B)
 *
 * (The input to this function is actually expected to be segments with a single part in them. This is what the MOS ingest produces.)
 */
export function groupMosPartsIntoIngestSegments(
	rundownExternalId: string,
	ingestSegments: IngestSegment[],
	separator: string
): IngestSegment[] {
	const groupedParts: { name: string; parts: IngestPart[] }[] = []

	for (const ingestSegment of ingestSegments) {
		const segmentName = ingestSegment.name.split(separator)[0] || ingestSegment.name

		const lastSegment = _.last(groupedParts)
		if (lastSegment && lastSegment.name === segmentName) {
			lastSegment.parts.push(...ingestSegment.parts)
		} else {
			groupedParts.push({ name: segmentName, parts: [...ingestSegment.parts] })
		}
	}

	return groupedParts.map(
		(partGroup, i) =>
			({
				externalId: `${rundownExternalId}_${partGroup.parts[0].externalId}`,
				name: partGroup.name,
				rank: i,
				parts: partGroup.parts.map((part, i) => ({ ...part, rank: i })),
				payload: undefined,
			}) satisfies IngestSegment
	)
}

/**
 * Group Parts in a Rundown and return a new changes object
 *
 * Please note that this ignores some of the granularity of the `ingestChanges` object, and relies more on the `previousIngestRundown` instead
 * If you are using user operations, you may need to perform some pre and post fixups to ensure changes aren't wiped unnecessarily.
 *
 * @param nrcsIngestRundown The rundown whose parts needs grouping
 * @param previousIngestRundown The rundown prior to the changes, if known
 * @param ingestChanges The changes which have been performed in `ingestRundown`, that need to translating
 * @param groupPartsIntoSegments A function to group parts into segments
 * @returns A transformed rundown and changes object
 */
export function groupPartsInRundownAndChanges<TRundownPayload, TSegmentPayload, TPartPayload>(
	nrcsIngestRundown: IngestRundown,
	previousNrcsIngestRundown: IngestRundown | undefined,
	ingestChanges: Omit<NrcsIngestChangeDetails, 'segmentOrderChanged'>,
	groupPartsIntoSegments: (ingestSegments: IngestSegment[]) => IngestSegment<TSegmentPayload, TPartPayload>[]
): GroupPartsInMosRundownAndChangesResult<TRundownPayload, TSegmentPayload, TPartPayload> {
	// Combine parts into segments
	const combinedIngestRundown = groupPartsIntoNewIngestRundown<TRundownPayload, TSegmentPayload, TPartPayload>(
		nrcsIngestRundown,
		groupPartsIntoSegments
	)

	// If there is no previous rundown, we need to regenerate everything
	if (!previousNrcsIngestRundown) {
		return {
			nrcsIngestRundown: combinedIngestRundown,
			ingestChanges: {
				source: IngestChangeType.Ingest,
				rundownChanges: NrcsIngestRundownChangeDetails.Regenerate,
			},
		}
	}

	// Combine parts into segments, in both the new and old ingest rundowns
	const oldCombinedIngestRundown = groupPartsIntoNewIngestRundown(previousNrcsIngestRundown, groupPartsIntoSegments)

	// Calculate the changes to each segment
	const allPartWithChanges = findAllPartsWithChanges(nrcsIngestRundown, ingestChanges)
	const segmentChanges = calculateSegmentChanges(oldCombinedIngestRundown, combinedIngestRundown, allPartWithChanges)

	// Calculate other changes
	const changedSegmentExternalIds = calculateSegmentExternalIdChanges(oldCombinedIngestRundown, combinedIngestRundown)
	const segmentOrderChanged = hasSegmentOrderChanged(
		combinedIngestRundown.segments,
		oldCombinedIngestRundown.segments
	)

	// Ensure id changes aren't flagged as deletions
	for (const [oldSegmentExternalId, newSegmentExternalId] of Object.entries<string>(changedSegmentExternalIds)) {
		if (!oldSegmentExternalId || !newSegmentExternalId) continue

		if (segmentChanges[oldSegmentExternalId] === NrcsIngestSegmentChangeDetailsEnum.Deleted) {
			delete segmentChanges[oldSegmentExternalId]
		}
	}

	return {
		nrcsIngestRundown: combinedIngestRundown,
		ingestChanges: {
			source: IngestChangeType.Ingest,
			rundownChanges: ingestChanges.rundownChanges,
			segmentOrderChanged,
			segmentChanges,
			changedSegmentExternalIds,
		} satisfies Complete<NrcsIngestChangeDetails>,
	}
}

function findAllPartsWithChanges(
	nrcsIngestRundown: IngestRundown,
	sourceChanges: NrcsIngestChangeDetails
): Set<string> {
	if (!sourceChanges.segmentChanges) return new Set()

	const partChanges = new Set<string>()

	for (const segment of nrcsIngestRundown.segments) {
		const segmentChanges = sourceChanges.segmentChanges[segment.externalId]
		if (!segmentChanges) continue

		for (const part of segment.parts) {
			switch (segmentChanges) {
				case NrcsIngestSegmentChangeDetailsEnum.InsertedOrUpdated:
					// This could have been an update, ensure that gets propogated
					partChanges.add(part.externalId)
					break
				case NrcsIngestSegmentChangeDetailsEnum.Deleted:
					// Deletions will be tracked elsewhere
					break
				default:
					if (typeof segmentChanges !== 'object')
						throw new Error(`Unexpected segment change for "${segment.externalId}": ${segmentChanges}`)

					// Something changed, this will cause the necessary propogation
					partChanges.add(part.externalId)

					break
			}
		}
	}

	return partChanges
}

function calculateSegmentChanges(
	oldCombinedIngestRundown: IngestRundown,
	combinedIngestRundown: IngestRundown,
	allPartWithChanges: Set<string>
): Record<string, NrcsIngestSegmentChangeDetails> {
	const oldIngestSegments = normalizeArrayToMap(oldCombinedIngestRundown.segments, 'externalId')

	const segmentChanges: Record<string, NrcsIngestSegmentChangeDetails> = {}

	// Track any segment changes
	for (const segment of combinedIngestRundown.segments) {
		const oldIngestSegment = oldIngestSegments.get(segment.externalId)

		if (!oldIngestSegment) {
			segmentChanges[segment.externalId] = NrcsIngestSegmentChangeDetailsEnum.InsertedOrUpdated
		} else {
			const segmentPartChanges: Record<string, NrcsIngestPartChangeDetails> = {}

			const newPartIds = new Set(segment.parts.map((p) => p.externalId))
			const oldPartMap = normalizeArrayToMap(oldIngestSegment.parts, 'externalId')

			for (const part of segment.parts) {
				const oldPart = oldPartMap.get(part.externalId)
				if (!oldPart) {
					segmentPartChanges[part.externalId] = NrcsIngestPartChangeDetails.Inserted
				} else if (
					allPartWithChanges.has(part.externalId) ||
					oldPart.name !== part.name ||
					!_.isEqual(oldPart.payload, part.payload)
				) {
					segmentPartChanges[part.externalId] = NrcsIngestPartChangeDetails.Updated
				}
			}
			for (const oldPart of oldIngestSegment.parts) {
				if (!newPartIds.has(oldPart.externalId)) {
					segmentPartChanges[oldPart.externalId] = NrcsIngestPartChangeDetails.Deleted
				}
			}

			const payloadChanged =
				oldIngestSegment.name !== segment.name || !_.isEqual(oldIngestSegment.payload, segment.payload)

			const partOrderChanged = hasPartOrderChanged(segment.parts, oldIngestSegment.parts)
			if (partOrderChanged || payloadChanged || Object.keys(segmentPartChanges).length > 0) {
				segmentChanges[segment.externalId] = {
					partChanges: segmentPartChanges,
					partOrderChanged,
					payloadChanged,
				}
			}
		}
	}

	// Track any segment deletions
	if (oldCombinedIngestRundown) {
		const newSegmentIds = new Set(combinedIngestRundown.segments.map((s) => s.externalId))
		for (const oldSegment of oldCombinedIngestRundown.segments) {
			if (!newSegmentIds.has(oldSegment.externalId)) {
				segmentChanges[oldSegment.externalId] = NrcsIngestSegmentChangeDetailsEnum.Deleted
			}
		}
	}

	return segmentChanges
}

function hasSegmentOrderChanged(ingestSegments: IngestSegment[], oldIngestSegments: IngestSegment[]): boolean {
	if (ingestSegments.length !== oldIngestSegments.length) return true

	for (let i = 0; i < ingestSegments.length; i++) {
		if (ingestSegments[i].externalId !== oldIngestSegments[i].externalId) return true
	}

	return false
}

function hasPartOrderChanged(ingestParts: IngestPart[], oldIngestParts: IngestPart[]): boolean {
	if (ingestParts.length !== oldIngestParts.length) return true

	for (let i = 0; i < ingestParts.length; i++) {
		if (ingestParts[i].externalId !== oldIngestParts[i].externalId) return true
	}

	return false
}

function groupPartsIntoNewIngestRundown<TRundownPayload, TSegmentPayload, TPartPayload>(
	ingestRundown: IngestRundown,
	groupPartsIntoIngestSements: (ingestSegments: IngestSegment[]) => IngestSegment<TSegmentPayload, TPartPayload>[]
): IngestRundown<TRundownPayload, TSegmentPayload, TPartPayload> {
	return {
		...(ingestRundown as IngestRundown<TRundownPayload>),
		segments: groupPartsIntoIngestSements(ingestRundown.segments),
	}
}

function calculateSegmentExternalIdChanges(
	oldIngestRundown: IngestRundown,
	newIngestRundown: IngestRundown
): Record<string, string> {
	const segmentExternalIdChanges: Record<string, string> = {}

	const oldIngestSegmentMap = normalizeArrayToMap(oldIngestRundown.segments, 'externalId')
	const newIngestSegmentMap = normalizeArrayToMap(newIngestRundown.segments, 'externalId')

	const removedSegments = oldIngestRundown.segments.filter((s) => !newIngestSegmentMap.has(s.externalId))
	let addedSegments = newIngestRundown.segments.filter((s) => !oldIngestSegmentMap.has(s.externalId))

	if (removedSegments.length === 0 || addedSegments.length === 0) return {}

	for (const removedSegment of removedSegments) {
		let newSegmentExternalId: string | undefined

		// try finding "it" in the added, using name
		// Future: this may not be particularly accurate, as multiple could have been formed
		newSegmentExternalId = addedSegments.find((se) => se.name === removedSegment.name)?.externalId

		if (!newSegmentExternalId) {
			// second try, match with any parts:
			newSegmentExternalId = addedSegments.find((se) => {
				for (const part of removedSegment.parts) {
					if (se.parts.find((p) => p.externalId === part.externalId)) {
						return true
					}
				}

				return false
			})?.externalId
		}
		if (newSegmentExternalId) {
			segmentExternalIdChanges[removedSegment.externalId] = newSegmentExternalId

			// Ensure the same id doesn't get used multiple times
			addedSegments = addedSegments.filter((s) => s.externalId !== newSegmentExternalId)
		}
	}

	return segmentExternalIdChanges
}
