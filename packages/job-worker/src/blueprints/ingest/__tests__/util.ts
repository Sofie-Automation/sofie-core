import type {
	IngestPart,
	SofieIngestPart,
	IngestSegment,
	SofieIngestSegment,
} from '@sofie-automation/blueprints-integration'
import type { IngestRundownWithSource } from '@sofie-automation/corelib/dist/dataModel/NrcsIngestDataCache'
import type { SofieIngestRundownWithSource } from '@sofie-automation/corelib/dist/dataModel/SofieIngestDataCache'

function toSofieIngestPart(ingestPart: IngestPart): SofieIngestPart {
	return {
		...ingestPart,
		userEditStates: {},
	}
}
function toSofieIngestSegment(ingestSegment: IngestSegment): SofieIngestSegment {
	return {
		...ingestSegment,
		userEditStates: {},
		parts: ingestSegment.parts.map(toSofieIngestPart),
	}
}
export function toSofieIngestRundown(ingestRundown: IngestRundownWithSource): SofieIngestRundownWithSource {
	return {
		...ingestRundown,
		userEditStates: {},
		segments: ingestRundown.segments.map(toSofieIngestSegment),
	}
}
