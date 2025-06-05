import { protectString, unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { PartId, RundownPlaylistActivationId } from '@sofie-automation/corelib/dist/dataModel/Ids'

import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'

export interface PartInstance extends DBPartInstance {
	isTemporary: boolean
}

export function wrapPartToTemporaryInstance(
	playlistActivationId: RundownPlaylistActivationId,
	part: DBPart
): PartInstance {
	return {
		isTemporary: true,
		_id: protectString(`${part._id}_tmp_instance`),
		rundownId: part.rundownId,
		segmentId: part.segmentId,
		playlistActivationId,
		segmentPlayoutId: protectString(''), // Only needed when stored in the db, and filled in nearer the time
		takeCount: -1,
		rehearsal: false,
		part: part,
	}
}

export function findPartInstanceInMapOrWrapToTemporary<T extends Partial<PartInstance>>(
	partInstancesMap: Map<PartId, T>,
	part: DBPart
): T {
	return partInstancesMap.get(part._id) || (wrapPartToTemporaryInstance(protectString(''), part) as T)
}

export function findPartInstanceOrWrapToTemporary<T extends Partial<PartInstance>>(
	partInstances: { [partId: string]: T | undefined },
	part: DBPart
): T {
	return partInstances[unprotectString(part._id)] || (wrapPartToTemporaryInstance(protectString(''), part) as T)
}
