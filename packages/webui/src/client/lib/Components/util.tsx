import { SomeObjectOverrideOp } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { ReadonlyDeep } from 'type-fest'

export function hasOpWithPath(allOps: ReadonlyDeep<SomeObjectOverrideOp[]>, id: string, subpath: string): boolean {
	const path = `${id}.${subpath}`
	return !!allOps.find((op) => op.path === path)
}
