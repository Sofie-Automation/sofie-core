import {
	getSchemaUIField,
	IShowStyleConfigPreset,
	IStudioConfigPreset,
	ITranslatableMessage,
	JSONBlob,
	JSONBlobParse,
	JSONSchema,
	SchemaFormUIField,
} from '@sofie-automation/blueprints-integration'
import { BlueprintHash } from '@sofie-automation/corelib/dist/dataModel/Blueprint'
import { BlueprintId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBShowStyleBase } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { DBStudio } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { joinObjectPathFragments, objectPathGet } from '@sofie-automation/corelib/dist/lib'
import { applyAndValidateOverrides } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { generateTranslation } from '@sofie-automation/corelib/dist/lib'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { logger } from '../../logging'
import { CoreSystemFields, ShowStyleBaseFields, StudioFields } from './reactiveContentCache'
import _ from 'underscore'
import { UIBlueprintUpgradeStatusBase } from '@sofie-automation/meteor-lib/dist/api/upgradeStatus'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'
import { ICoreSystem } from '@sofie-automation/meteor-lib/dist/collections/CoreSystem'

export interface BlueprintMapEntry {
	_id: BlueprintId
	configPresets: Record<string, IStudioConfigPreset> | Record<string, IShowStyleConfigPreset> | undefined
	configSchema: JSONBlob<JSONSchema> | undefined
	blueprintHash: BlueprintHash | undefined
	hasFixUpFunction: boolean
}

export function checkDocUpgradeStatus(
	blueprintMap: Map<BlueprintId, BlueprintMapEntry>,
	doc: Pick<DBStudio, StudioFields> | Pick<DBShowStyleBase, ShowStyleBaseFields>
): Pick<UIBlueprintUpgradeStatusBase, 'invalidReason' | 'changes' | 'pendingRunOfFixupFunction'> {
	// Check the blueprintId is valid
	const blueprint = doc.blueprintId ? blueprintMap.get(doc.blueprintId) : null
	if (!blueprint || !blueprint.configPresets) {
		// Studio blueprint is missing/invalid
		return {
			invalidReason: generateTranslation('Invalid blueprint: "{{blueprintId}}"', {
				blueprintId: doc.blueprintId ?? 'undefined',
			}),
			pendingRunOfFixupFunction: false,
			changes: [],
		}
	}

	// Check the blueprintConfigPresetId is valid
	const configPreset = doc.blueprintConfigPresetId ? blueprint.configPresets[doc.blueprintConfigPresetId] : undefined
	if (!configPreset) {
		return {
			invalidReason: generateTranslation(
				'Invalid config preset for blueprint: "{{configPresetId}}" ({{blueprintId}})',
				{
					configPresetId: doc.blueprintConfigPresetId ?? '',
					blueprintId: doc.blueprintId,
				}
			),
			pendingRunOfFixupFunction: false, // TODO - verify
			changes: [],
		}
	}

	if (blueprint.hasFixUpFunction) {
		// If the blueprint has a 'fixUpConfig' function, that must be run before we can do any real diffing of the config
		const pendingRunOfFixupFunction =
			!doc.lastBlueprintFixUpHash || doc.lastBlueprintFixUpHash !== blueprint.blueprintHash

		if (pendingRunOfFixupFunction) {
			return {
				pendingRunOfFixupFunction: true,
				changes: [generateTranslation('Config requires fixing up before it can be validated')],
			}
		}
	}

	const changes: ITranslatableMessage[] = []

	// Some basic property checks
	if (!doc.lastBlueprintConfig) {
		changes.push(generateTranslation('Config has not been applied before'))
	} else if (doc.lastBlueprintConfig.blueprintId !== doc.blueprintId) {
		changes.push(
			generateTranslation('Blueprint has been changed. From "{{ oldValue }}", to "{{ newValue }}"', {
				oldValue: doc.lastBlueprintConfig.blueprintId || '',
				newValue: doc.blueprintId || '',
			})
		)
	} else if (doc.lastBlueprintConfig.blueprintConfigPresetId !== doc.blueprintConfigPresetId) {
		changes.push(
			generateTranslation(
				'Blueprint config preset has been changed. From "{{ oldValue }}", to "{{ newValue }}"',
				{
					oldValue: doc.lastBlueprintConfig.blueprintConfigPresetId || '',
					newValue: doc.blueprintConfigPresetId || '',
				}
			)
		)
	} else if (doc.lastBlueprintConfig.blueprintHash !== blueprint.blueprintHash) {
		changes.push(generateTranslation('Blueprint has a new version'))
	}

	if (doc.lastBlueprintConfig && doc.blueprintConfigWithOverrides) {
		// Check if the config blob has changed since last run
		const newConfig = applyAndValidateOverrides(doc.blueprintConfigWithOverrides).obj
		const oldConfig = doc.lastBlueprintConfig.config

		// Do a simple check, in case we miss the change when comparing the manifest properties
		if (!_.isEqual(newConfig, oldConfig)) {
			changes.push(generateTranslation('Blueprint config has changed'))

			// also do a deeper diff
			if (blueprint.configSchema) {
				try {
					changes.push(
						...diffJsonSchemaObjects(
							JSONBlobParse(blueprint.configSchema),
							['blueprint_' + doc.blueprintId],
							oldConfig,
							newConfig
						)
					)
				} catch (e) {
					changes.push(generateTranslation('Failed to compare config changes'))
					logger.error(`Faield to compare configs: ${stringifyError(e)}`)
				}
			}
		}
	}

	return {
		changes,
		pendingRunOfFixupFunction: false,
	}
}

export function checkSystemUpgradeStatus(
	blueprintMap: Map<BlueprintId, BlueprintMapEntry>,
	doc: Pick<ICoreSystem, CoreSystemFields>
): Pick<UIBlueprintUpgradeStatusBase, 'invalidReason' | 'changes' | 'pendingRunOfFixupFunction'> {
	const changes: ITranslatableMessage[] = []

	// Check the blueprintId is valid
	if (doc.blueprintId) {
		const blueprint = blueprintMap.get(doc.blueprintId)
		if (!blueprint || !blueprint.configPresets) {
			// Studio blueprint is missing/invalid
			return {
				invalidReason: generateTranslation('Invalid blueprint: "{{blueprintId}}"', {
					blueprintId: doc.blueprintId ?? 'undefined',
				}),
				pendingRunOfFixupFunction: false,
				changes: [],
			}
		}

		// Some basic property checks
		if (!doc.lastBlueprintConfig) {
			changes.push(generateTranslation('Config has not been applied before'))
		} else if (doc.lastBlueprintConfig.blueprintId !== doc.blueprintId) {
			changes.push(
				generateTranslation('Blueprint has been changed. From "{{ oldValue }}", to "{{ newValue }}"', {
					oldValue: doc.lastBlueprintConfig.blueprintId || '',
					newValue: doc.blueprintId || '',
				})
			)
		} else if (doc.lastBlueprintConfig.blueprintHash !== blueprint.blueprintHash) {
			changes.push(generateTranslation('Blueprint has a new version'))
		}
	} else {
		// No blueprint assigned

		const defaultId = protectString('default')

		// Some basic property checks
		if (!doc.lastBlueprintConfig) {
			changes.push(generateTranslation('Config has not been applied before'))
		} else if (doc.lastBlueprintConfig.blueprintId !== defaultId) {
			changes.push(
				generateTranslation('Blueprint has been changed. From "{{ oldValue }}", to "{{ newValue }}"', {
					oldValue: doc.lastBlueprintConfig.blueprintId || '',
					newValue: defaultId,
				})
			)
		} else if (doc.lastBlueprintConfig.blueprintHash !== defaultId) {
			changes.push(generateTranslation('Blueprint has a new version'))
		}
	}

	return {
		changes,
		pendingRunOfFixupFunction: false,
	}
}

/**
 * This is a slightly crude diffing of objects based on a jsonschema. Only keys in the schema will be compared.
 * For now this has some limitations such as not looking inside of arrays, but this could be expanded later on
 */
function diffJsonSchemaObjects(
	schema: JSONSchema,
	translationNamespaces: string[],
	objA: unknown,
	objB: unknown,
	pathPrefix?: string
): ITranslatableMessage[] {
	const changes: ITranslatableMessage[] = []

	for (const [id, propSchema] of Object.entries<JSONSchema>(schema.properties || {})) {
		const propPath = joinObjectPathFragments(pathPrefix, id)
		const valueA = objectPathGet(objA, id)
		const valueB = objectPathGet(objB, id)

		if (propSchema.type === 'object' && !propSchema.patternProperties) {
			changes.push(...diffJsonSchemaObjects(propSchema, translationNamespaces, valueA, valueB, propPath))
		} else {
			if (!_.isEqual(valueA, valueB)) {
				changes.push(
					generateTranslation(
						'Config value "{{ name }}" has changed. From "{{ oldValue }}", to "{{ newValue }}"',
						{
							name: getSchemaUIField(propSchema, SchemaFormUIField.Title) || propPath,
							// Future: this is not pretty when it is an object
							oldValue: JSON.stringify(valueA) ?? '',
							newValue: JSON.stringify(valueB) ?? '',
						},
						translationNamespaces
					)
				)
			}
		}
	}

	return changes
}
