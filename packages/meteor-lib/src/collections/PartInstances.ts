import { protectString, unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { PartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { PartId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { wrapPartToTemporaryInstance } from '@sofie-automation/corelib/dist/playout/stateCacheResolver'

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
