import { IngestRundown, IngestSegment, IngestPart } from '@sofie-automation/blueprints-integration'
import { NrcsIngestDataCacheObjId, RundownId, SegmentId, PartId } from './Ids.js'
import { RundownSource } from './Rundown.js'

/*
	The NRCSIngestDataCache collection is used to store raw data that comes from an NRCS.
	See also ./SofieIngestDataCache.ts
	For where the ingested data is stored after being processed/modified by Sofie.
*/

export enum NrcsIngestCacheType {
	RUNDOWN = 'rundown',
	SEGMENT = 'segment',
	PART = 'part',
}
export type IngestCacheData = IngestRundown | IngestSegment | IngestPart

export interface IngestRundownWithSource<TRundownPayload = unknown, TSegmentPayload = unknown, TPartPayload = unknown>
	extends IngestRundown<TRundownPayload, TSegmentPayload, TPartPayload> {
	rundownSource: RundownSource
}

interface IngestDataCacheObjBase {
	_id: NrcsIngestDataCacheObjId
	modified: number
	type: NrcsIngestCacheType

	/** Id of the Rundown */
	rundownId: RundownId
	segmentId?: SegmentId
	partId?: PartId

	data: IngestCacheData
}

export interface NrcsIngestDataCacheObjRundown extends IngestDataCacheObjBase {
	type: NrcsIngestCacheType.RUNDOWN
	rundownId: RundownId
	data: IngestRundownWithSource
}
export interface NrcsIngestDataCacheObjSegment extends IngestDataCacheObjBase {
	type: NrcsIngestCacheType.SEGMENT
	rundownId: RundownId
	segmentId: SegmentId

	data: IngestSegment
}
export interface NrcsIngestDataCacheObjPart extends IngestDataCacheObjBase {
	type: NrcsIngestCacheType.PART
	rundownId: RundownId
	segmentId: SegmentId
	partId: PartId
	data: IngestPart
}
export type NrcsIngestDataCacheObj =
	| NrcsIngestDataCacheObjRundown
	| NrcsIngestDataCacheObjSegment
	| NrcsIngestDataCacheObjPart
