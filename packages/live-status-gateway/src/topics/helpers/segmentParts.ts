import { PartInstanceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { unprotectString } from '@sofie-automation/server-core-integration'
import _ = require('underscore')

export interface CurrentSegmentPart {
	id: string
	name: string
	autoNext: boolean | undefined
	timing: {
		expectedDurationMs?: number
	}
}

export function getCurrentSegmentParts(
	segmentPartInstances: DBPartInstance[],
	segmentParts: DBPart[]
): CurrentSegmentPart[] {
	const partInstancesByPartId: Record<string, { _id: string | PartInstanceId; part: DBPart }> = _.indexBy(
		segmentPartInstances,
		(partInstance) => unprotectString(partInstance.part._id)
	)
	segmentParts.forEach((part) => {
		const partId = unprotectString(part._id)
		if (partInstancesByPartId[partId]) return
		const partInstance = {
			_id: partId,
			part,
		}
		partInstancesByPartId[partId] = partInstance
	})
	return Object.values<{ _id: string | PartInstanceId; part: DBPart }>(partInstancesByPartId)
		.sort((a, b) => a.part._rank - b.part._rank)
		.map(
			(partInstance): CurrentSegmentPart => ({
				id: unprotectString(partInstance.part._id),
				name: partInstance.part.title,
				autoNext: partInstance.part.autoNext,
				timing: {
					expectedDurationMs: partInstance.part.expectedDuration,
				},
			})
		)
}
