import { BlueprintId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import {
	ShowStyleBlueprintManifest,
	SomeBlueprintManifest,
	StudioBlueprintManifest,
	SystemBlueprintManifest,
} from '@sofie-automation/blueprints-integration'
import * as vm from 'vm'
import { ReadonlyDeep } from 'type-fest'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'
import { Blueprint } from '@sofie-automation/corelib/dist/dataModel/Blueprint'

export interface WrappedSystemBlueprint {
	blueprintId: BlueprintId
	blueprint: SystemBlueprintManifest
}
export interface WrappedStudioBlueprint {
	blueprintDoc: Blueprint | undefined
	blueprintId: BlueprintId
	blueprint: StudioBlueprintManifest
}
export interface WrappedShowStyleBlueprint {
	blueprintId: BlueprintId
	blueprint: ShowStyleBlueprintManifest
}

// export async function loadSystemBlueprints(system: ICoreSystem): Promise<WrappedSystemBlueprint | undefined> {
// 	if (!system.blueprintId) return undefined

// 	const blueprintManifest = await loadBlueprintById(system.blueprintId)
// 	if (!blueprintManifest) throw new Error(`Blueprint "${system.blueprintId}" not found! (referenced by CoreSystem)`)

// 	if (blueprintManifest.blueprintType !== BlueprintManifestType.SYSTEM) {
// 		throw new Error(
// 			`Blueprint "${system.blueprintId}" is not valid for a CoreSystem (${blueprintManifest.blueprintType})!`
// 		)
// 	}

// 	return {
// 		blueprintId: system.blueprintId,
// 		blueprint: blueprintManifest,
// 	}
// }

/**
 * Parse a Blueprint document into executable code
 */
export async function parseBlueprintDocument(
	blueprint: Blueprint | undefined
): Promise<ReadonlyDeep<SomeBlueprintManifest> | undefined> {
	if (!blueprint) return undefined

	if (blueprint.code) {
		let manifest: SomeBlueprintManifest
		try {
			const blueprintPath = `db:///blueprint/${blueprint.name || blueprint._id}-bundle.js`
			const context = vm.createContext(
				{
					fetch,
				},
				{}
			)
			const script = new vm.Script(
				`__run_result = ${blueprint.code}
__run_result || blueprint`,
				{
					filename: blueprintPath,
				}
			)
			// Future: we should look at freezing the object inside the vm
			const entry = script.runInContext(context)
			manifest = entry.default
		} catch (e) {
			throw new Error(`Syntax error in blueprint "${blueprint._id}": ${stringifyError(e)}`)
		}
		if (manifest.blueprintType !== blueprint.blueprintType) {
			throw new Error(
				`Evaluated Blueprint-manifest and document does not have the same blueprintType ("${manifest.blueprintType}", "${blueprint.blueprintType}")!`
			)
		}
		return manifest
	} else {
		throw new Error(`Blueprint "${blueprint._id}".code not set!`)
	}
}
