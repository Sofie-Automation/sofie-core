import { Blueprint } from '@sofie-automation/corelib/dist/dataModel/Blueprint'
import { BlueprintId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { DBShowStyleBase } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { DBStudio } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { Blueprints, ShowStyleBases, Studios } from '../collections'
import { getCoreSystemAsync } from '../coreSystem/collection'

/**
 * Returns the versions for all Blueprints that are in use (in Studio, System or ShowStyles)
 */
export async function getBlueprintVersions(): Promise<{
	[blueprintId: string]: {
		name: string
		version: string
	}
}> {
	const versions: {
		[blueprintId: string]: {
			name: string
			version: string
		}
	} = {}

	const pCoreSystem = getCoreSystemAsync()

	const pStudios = Studios.findFetchAsync(
		{ blueprintId: { $exists: true } },
		{
			projection: {
				_id: 1,
				blueprintId: 1,
			},
		}
	) as Promise<Array<Pick<DBStudio, '_id' | 'blueprintId'>>>

	const pShowStyleBases = ShowStyleBases.findFetchAsync(
		{ blueprintId: { $exists: true } },
		{
			projection: {
				_id: 1,

				blueprintId: 1,
			},
		}
	) as Promise<Array<Pick<DBShowStyleBase, '_id' | 'blueprintId'>>>

	// Collect Blueprint versions:
	const blueprintIds: BlueprintId[] = []

	{
		const coreSystem = await pCoreSystem
		if (coreSystem?.blueprintId) blueprintIds.push(coreSystem.blueprintId)
	}

	for (const studio of await pStudios) {
		if (studio.blueprintId) blueprintIds.push(studio.blueprintId)
	}

	for (const showStyleBase of await pShowStyleBases) {
		if (showStyleBase.blueprintId) blueprintIds.push(showStyleBase.blueprintId)
	}

	const blueprints = (await Blueprints.findFetchAsync(
		{
			_id: { $in: blueprintIds },
		},
		{
			projection: {
				_id: 1,
				name: 1,
				blueprintVersion: 1,
			},
		}
	)) as Pick<Blueprint, '_id' | 'name' | 'blueprintVersion'>[]

	for (const blueprint of blueprints) {
		versions[unprotectString(blueprint._id)] = {
			name: blueprint.name,
			version: blueprint.blueprintVersion,
		}
	}

	return versions
}
