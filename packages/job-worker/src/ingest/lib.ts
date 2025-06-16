import { PartId, RundownId, SegmentId, StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { getHash } from '@sofie-automation/corelib/dist/lib'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { ReadonlyDeep } from 'type-fest'
import { logger } from '../logging.js'
import { ExtendedIngestRundown, SofieIngestRundown } from '@sofie-automation/blueprints-integration'
import { SegmentOrphanedReason } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { convertRundownToBlueprints } from '../blueprints/context/lib.js'
import { IngestSegmentModel } from './model/IngestSegmentModel.js'

export function getRundownId(studioId: StudioId, rundownExternalId: string): RundownId {
	if (!studioId) throw new Error('getRundownId: studio not set!')
	if (!rundownExternalId) throw new Error('getRundownId: rundownExternalId must be set!')
	return protectString<RundownId>(getHash(`${studioId}_${rundownExternalId}`))
}
export function getSegmentId(rundownId: RundownId, segmentExternalId: string): SegmentId {
	if (!rundownId) throw new Error('getSegmentId: rundownId must be set!')
	if (!segmentExternalId) throw new Error('getSegmentId: segmentExternalId must be set!')
	return protectString<SegmentId>(getHash(`${rundownId}_segment_${segmentExternalId}`))
}
export function getPartId(rundownId: RundownId, partExternalId: string): PartId {
	if (!rundownId) throw new Error('getPartId: rundownId must be set!')
	if (!partExternalId) throw new Error('getPartId: partExternalId must be set!')
	return protectString<PartId>(getHash(`${rundownId}_part_${partExternalId}`))
}

export function canRundownBeUpdated(rundown: ReadonlyDeep<DBRundown> | undefined, isCreateAction: boolean): boolean {
	if (!rundown) return true
	if (rundown.orphaned && !isCreateAction) {
		logger.info(`Rundown "${rundown._id}" has been unsynced and needs to be synced before it can be updated.`)
		return false
	}
	return true
}
export function canSegmentBeUpdated(
	rundown: ReadonlyDeep<DBRundown> | undefined,
	segment: ReadonlyDeep<IngestSegmentModel> | undefined,
	isCreateAction: boolean
): boolean {
	if (!canRundownBeUpdated(rundown, false)) {
		return false
	}

	if (!segment) return true
	if (segment.segment.orphaned === SegmentOrphanedReason.DELETED && !isCreateAction) {
		logger.info(
			`Segment "${segment.segment._id}" has been unsynced and needs to be synced before it can be updated.`
		)
		return false
	}

	if (segment.segment.orphaned === SegmentOrphanedReason.ADLIB_TESTING) {
		logger.error(
			`Ingest cannot update Segment "${segment.segment._id}" which is owned by the AdlibTesting Segment.`
		)
		return false
	}

	return true
}

export function extendIngestRundownCore(
	ingestRundown: SofieIngestRundown,
	existingDbRundown: ReadonlyDeep<DBRundown> | undefined
): ExtendedIngestRundown {
	const extendedIngestRundown: ExtendedIngestRundown = {
		...ingestRundown,
		coreData: existingDbRundown && convertRundownToBlueprints(existingDbRundown),
	}
	return extendedIngestRundown
}
