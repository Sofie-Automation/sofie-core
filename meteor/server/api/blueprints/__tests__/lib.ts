import { BlueprintManifestType, SomeBlueprintManifest } from '@sofie-automation/blueprints-integration'
import { getRandomId, literal } from '@sofie-automation/corelib/dist/lib'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { Blueprint } from '@sofie-automation/corelib/dist/dataModel/Blueprint'
import { JSONBlobStringify } from '@sofie-automation/shared-lib/dist/lib/JSONBlob'

export function generateFakeBlueprint(
	id: string,
	type?: BlueprintManifestType,
	codeFcn?: () => SomeBlueprintManifest
): Blueprint {
	const codeFcnString = codeFcn
		? codeFcn.toString()
		: `\
() => ({
  blueprintType: ${type ? `"${type}"` : 'undefined'},
  blueprintVersion: '0.0.0',
  integrationVersion: '0.0.0',
  TSRVersion: '0.0.0',
  studioConfigManifest: [],
  getBaseline: () => {
	return {
      timelineObjects: [],
    }
  },
  getShowStyleId: () => null
})`

	return literal<Blueprint>({
		_id: protectString(id),
		name: 'Fake blueprint',
		hasCode: true,
		code: `({default: (${codeFcnString})()})`,
		created: 0,
		modified: 0,

		blueprintId: '',
		blueprintType: type,
		blueprintHash: getRandomId(),

		studioConfigSchema: JSONBlobStringify({}),
		showStyleConfigSchema: JSONBlobStringify({}),

		databaseVersion: {
			system: undefined,
		},

		blueprintVersion: '',
		integrationVersion: '',
		TSRVersion: '',
		hasFixUpFunction: false,
	})
}
