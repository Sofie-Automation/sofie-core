import * as vm from 'vm'
import { logger } from '../../logging'
import { Blueprint } from '@sofie-automation/corelib/dist/dataModel/Blueprint'
import { SomeBlueprintManifest } from '@sofie-automation/blueprints-integration'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'

export function evalBlueprint(blueprint: Pick<Blueprint, '_id' | 'name' | 'code'>): SomeBlueprintManifest {
	const blueprintPath = `db:///blueprint/${blueprint.name || blueprint._id}-bundle.js`
	const context = vm.createContext({}, {})
	const script = new vm.Script(
		`__run_result = ${blueprint.code}
__run_result || blueprint`,
		{
			filename: blueprintPath,
		}
	)
	const entry = script.runInContext(context)

	const manifest: SomeBlueprintManifest = entry.default

	// Wrap the functions, to emit better errors
	for (const key of Object.keys(manifest)) {
		const value = (manifest as any)[key]
		if (typeof value === 'function') {
			;(manifest as any)[key] = (...args: any[]) => {
				try {
					return value(...args)
				} catch (e) {
					logger.error(`Error in Blueprint "${blueprint._id}".${key}: "${stringifyError(e)}"`)
					throw e
				}
			}
		}
	}

	return manifest
}
