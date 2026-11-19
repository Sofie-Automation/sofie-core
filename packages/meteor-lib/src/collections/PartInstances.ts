import { protectString, unprotectString } from '@sofie-automation/corelib/dist/protectedString.js'
import type { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part.js'
import type { PartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance.js'
import type { PartId } from '@sofie-automation/corelib/dist/dataModel/Ids.js'
import { wrapPartToTemporaryInstance } from '@sofie-automation/corelib/dist/playout/stateCacheResolver.js'

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
