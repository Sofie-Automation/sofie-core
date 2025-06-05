import { Meteor } from 'meteor/meteor'
import { logger } from '../../logging'
import { Blueprints, CoreSystem } from '../../collections'
import {
	BlueprintManifestType,
	BlueprintResultApplySystemConfig,
	IBlueprintTriggeredActions,
	SystemBlueprintManifest,
} from '@sofie-automation/blueprints-integration'
import { evalBlueprint } from '../../api/blueprints/cache'
import { CoreSystemApplyConfigContext } from './context'
import { updateTriggeredActionsForShowStyleBaseId } from './lib'
import { CoreSystemId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DEFAULT_CORE_TRIGGERS } from './defaultSystemActionTriggers'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { ICoreSystemSettings } from '@sofie-automation/shared-lib/dist/core/model/CoreSystemSettings'

export async function runUpgradeForCoreSystem(coreSystemId: CoreSystemId): Promise<void> {
	logger.info(`Running upgrade for CoreSystem`)

	const { coreSystem, blueprint, blueprintManifest } = await loadCoreSystemAndBlueprint(coreSystemId)

	let result: BlueprintResultApplySystemConfig

	if (blueprintManifest && typeof blueprintManifest.applyConfig === 'function') {
		const blueprintContext = new CoreSystemApplyConfigContext(
			'applyConfig',
			`coreSystem:${coreSystem._id},blueprint:${blueprint.blueprintId}`
		)

		result = blueprintManifest.applyConfig(blueprintContext)
	} else {
		// Ensure some defaults are populated when no blueprint method is present
		result = generateDefaultSystemConfig()
	}

	const coreSystemSettings: ICoreSystemSettings = result.settings

	await CoreSystem.updateAsync(coreSystemId, {
		$set: {
			'settingsWithOverrides.defaults': coreSystemSettings,
			lastBlueprintConfig: {
				blueprintHash: blueprint?.blueprintHash ?? protectString('default'),
				blueprintId: blueprint?._id ?? protectString('default'),
				blueprintConfigPresetId: undefined,
				config: {},
			},
		},
	})

	await updateTriggeredActionsForShowStyleBaseId(null, result.triggeredActions)
}

async function loadCoreSystemAndBlueprint(coreSystemId: CoreSystemId) {
	const coreSystem = await CoreSystem.findOneAsync(coreSystemId)
	if (!coreSystem) throw new Meteor.Error(404, `CoreSystem "${coreSystemId}" not found!`)

	if (!coreSystem.blueprintId) {
		// No blueprint is valid
		return {
			coreSystem,
			blueprint: undefined,
			blueprintHash: undefined,
		}
	}

	// if (!showStyleBase.blueprintConfigPresetId) throw new Meteor.Error(500, 'ShowStyleBase is missing config preset')

	const blueprint = await Blueprints.findOneAsync({
		_id: coreSystem.blueprintId,
		blueprintType: BlueprintManifestType.SYSTEM,
	})
	if (!blueprint) throw new Meteor.Error(404, `Blueprint "${coreSystem.blueprintId}" not found!`)

	if (!blueprint.blueprintHash) throw new Meteor.Error(500, 'Blueprint is not valid')

	const blueprintManifest = evalBlueprint(blueprint) as SystemBlueprintManifest

	return {
		coreSystem,
		blueprint,
		blueprintManifest,
	}
}

function generateDefaultSystemConfig(): BlueprintResultApplySystemConfig {
	return {
		settings: {
			cron: {
				casparCGRestart: {
					enabled: true,
				},
				storeRundownSnapshots: {
					enabled: false,
				},
			},
			support: {
				message: '',
			},
			evaluationsMessage: {
				enabled: false,
				heading: '',
				message: '',
			},
		},
		triggeredActions: Object.values<IBlueprintTriggeredActions>(DEFAULT_CORE_TRIGGERS),
	}
}
