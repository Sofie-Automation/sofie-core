import { NrcsIngestRundownChangeDetails, IngestPart, IngestChangeType } from '@sofie-automation/blueprints-integration'
import { literal } from '@sofie-automation/corelib/dist/lib'
import {
	MosRundownProps,
	MosRundownMetadataProps,
	MosRundownStatusProps,
	MosRundownReadyToAirProps,
} from '@sofie-automation/corelib/dist/worker/ingest'
import { JobContext } from '../../jobs/index.js'
import { getRundownId, canRundownBeUpdated } from '../lib.js'
import { CommitIngestData, runWithRundownLock } from '../lock.js'
import { mosStoryToIngestSegment, parseMosString, updateRanksBasedOnOrder } from './lib.js'
import { GenerateRundownMode, updateRundownFromIngestData } from '../generationRundown.js'
import { IngestUpdateOperationFunction } from '../runOperation.js'
import { IngestModel } from '../model/IngestModel.js'
import { IngestRundownWithSource } from '@sofie-automation/corelib/dist/dataModel/NrcsIngestDataCache'
import { SofieIngestRundownWithSource } from '@sofie-automation/corelib/dist/dataModel/SofieIngestDataCache'

/**
 * Insert or update a mos rundown
 */
export function handleMosRundownData(
	_context: JobContext,
	data: MosRundownProps
): IngestUpdateOperationFunction | null {
	// Create or update a rundown (ie from rundownCreate or rundownList)

	if (parseMosString(data.mosRunningOrder.ID) !== data.rundownExternalId)
		throw new Error('mosRunningOrder.ID and rundownExternalId mismatch!')

	return (ingestRundown) => {
		const ingestSegments = (data.mosRunningOrder.Stories || []).map((story) =>
			mosStoryToIngestSegment(story, data.isUpdateOperation)
		)

		// If this is a reload of a RO, then use cached data to make the change more seamless
		if (data.isUpdateOperation && ingestRundown) {
			const partCacheMap = new Map<string, IngestPart>()
			for (const segment of ingestRundown.segments) {
				for (const part of segment.parts) {
					partCacheMap.set(part.externalId, part)
				}
			}

			for (const newIngestSegment of ingestSegments) {
				const ingestPart = newIngestSegment.parts[0]
				if (!ingestPart) continue

				const cached = partCacheMap.get(ingestPart.externalId)
				if (cached && !ingestPart.payload) {
					ingestPart.payload = cached.payload
				}
			}
		}

		const newIngestRundown = literal<IngestRundownWithSource>({
			externalId: data.rundownExternalId,
			name: parseMosString(data.mosRunningOrder.Slug),
			type: 'mos',
			segments: ingestSegments,
			payload: data.mosRunningOrder,
			rundownSource: data.rundownSource,
		})
		updateRanksBasedOnOrder(newIngestRundown)

		return {
			ingestRundown: newIngestRundown,
			changes: {
				source: IngestChangeType.Ingest,
				rundownChanges: NrcsIngestRundownChangeDetails.Regenerate,
			},
		}
	}
}

/**
 * Update the payload of a mos rundown, without changing any parts or segments
 */
export function handleMosRundownMetadata(
	_context: JobContext,
	data: MosRundownMetadataProps
): IngestUpdateOperationFunction | null {
	return (ingestRundown) => {
		if (ingestRundown) {
			ingestRundown.payload = Object.assign(ingestRundown.payload as object, data.mosRunningOrderBase)

			return {
				// We modify in-place
				ingestRundown,
				changes: {
					source: IngestChangeType.Ingest,
					rundownChanges: NrcsIngestRundownChangeDetails.Payload,
				},
			}
		} else {
			throw new Error(`Rundown "${data.rundownExternalId}" not found`)
		}
	}
}

/**
 * Update the status of a mos rundown
 */
export async function handleMosRundownStatus(context: JobContext, data: MosRundownStatusProps): Promise<void> {
	const rundownId = getRundownId(context.studioId, data.rundownExternalId)

	return runWithRundownLock(context, rundownId, async (rundown) => {
		if (!rundown) throw new Error(`Rundown "${rundownId}" not found!`)

		if (!canRundownBeUpdated(rundown, false)) return

		await context.directCollections.Rundowns.update(rundown._id, {
			$set: {
				status: data.status,
			},
		})
	})
}

/**
 * Update the ready to air state of a mos rundown
 */
export async function handleMosRundownReadyToAir(
	context: JobContext,
	data: MosRundownReadyToAirProps,
	ingestModel: IngestModel,
	ingestRundown: SofieIngestRundownWithSource
): Promise<CommitIngestData | null> {
	if (!ingestModel.rundown || ingestModel.rundown.airStatus === data.status) return null

	// If rundown is orphaned, then it should be ignored
	if (ingestModel.rundown.orphaned) return null

	ingestModel.setRundownAirStatus(data.status)

	return updateRundownFromIngestData(context, ingestModel, ingestRundown, GenerateRundownMode.MetadataChange)
}
