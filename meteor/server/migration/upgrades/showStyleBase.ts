import {
	BlueprintManifestType,
	JSONBlobParse,
	ShowStyleBlueprintManifest,
} from '@sofie-automation/blueprints-integration'
import { ShowStyleBaseId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { normalizeArray } from '@sofie-automation/corelib/dist/lib'
import { applyAndValidateOverrides } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { wrapTranslatableMessageFromBlueprints } from '@sofie-automation/corelib/dist/TranslatableMessage'
import { BlueprintValidateConfigForStudioResult } from '@sofie-automation/corelib/dist/worker/studio'
import { Meteor } from 'meteor/meteor'
import { Blueprints, ShowStyleBases } from '../../collections'
import { DBShowStyleBase } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { evalBlueprint } from '../../api/blueprints/cache'
import { logger } from '../../logging'
import { CommonContext } from './context'
import { FixUpBlueprintConfigContext } from '@sofie-automation/corelib/dist/fixUpBlueprintConfig/context'
import { Blueprint } from '@sofie-automation/corelib/dist/dataModel/Blueprint'
import { BlueprintFixUpConfigMessage } from '@sofie-automation/meteor-lib/dist/api/migration'
import { updateTriggeredActionsForShowStyleBaseId } from './lib'

export async function fixupConfigForShowStyleBase(
	showStyleBaseId: ShowStyleBaseId
): Promise<BlueprintFixUpConfigMessage[]> {
	const { showStyleBase, blueprint, blueprintManifest } = await loadShowStyleAndBlueprint(showStyleBaseId)

	if (typeof blueprintManifest.fixUpConfig !== 'function') {
		if (showStyleBase.lastBlueprintFixUpHash) {
			// Cleanup property to avoid getting stuck
			await ShowStyleBases.updateAsync(showStyleBaseId, {
				$unset: {
					lastBlueprintFixUpHash: 1,
				},
			})
		}
		throw new Meteor.Error(500, 'Blueprint does not support this config flow')
	}

	const commonContext = new CommonContext(
		'fixupConfig',
		`showStyleBase:${showStyleBaseId},blueprint:${blueprint._id}`
	)
	const blueprintContext = new FixUpBlueprintConfigContext(
		commonContext,
		JSONBlobParse(blueprintManifest.showStyleConfigSchema),
		showStyleBase.blueprintConfigWithOverrides
	)

	blueprintManifest.fixUpConfig(blueprintContext)

	// Save the 'fixed' config
	await ShowStyleBases.updateAsync(showStyleBaseId, {
		$set: {
			lastBlueprintFixUpHash: blueprint.blueprintHash,
			blueprintConfigWithOverrides: blueprintContext.configObject,
		},
	})

	return blueprintContext.messages.map((msg) => ({
		message: wrapTranslatableMessageFromBlueprints(msg.message, [blueprint._id]),
		path: msg.path,
	}))
}

export async function ignoreFixupConfigForShowStyleBase(showStyleBaseId: ShowStyleBaseId): Promise<void> {
	const { showStyleBase, blueprint, blueprintManifest } = await loadShowStyleAndBlueprint(showStyleBaseId)

	if (typeof blueprintManifest.fixUpConfig !== 'function') {
		if (showStyleBase.lastBlueprintFixUpHash) {
			// Cleanup property to avoid getting stuck
			await ShowStyleBases.updateAsync(showStyleBaseId, {
				$unset: {
					lastBlueprintFixUpHash: 1,
				},
			})
		}
		throw new Meteor.Error(500, 'Blueprint does not support this config flow')
	}

	// Save the 'fixed' config
	await ShowStyleBases.updateAsync(showStyleBaseId, {
		$set: {
			lastBlueprintFixUpHash: blueprint.blueprintHash,
		},
	})
}

export async function validateConfigForShowStyleBase(
	showStyleBaseId: ShowStyleBaseId
): Promise<BlueprintValidateConfigForStudioResult> {
	const { showStyleBase, blueprint, blueprintManifest } = await loadShowStyleAndBlueprint(showStyleBaseId)

	if (typeof blueprintManifest.validateConfig !== 'function')
		throw new Meteor.Error(500, 'Blueprint does not support this config flow')

	throwIfNeedsFixupConfigRunning(showStyleBase, blueprint, blueprintManifest)

	const blueprintContext = new CommonContext(
		'validateConfig',
		`showStyleBase:${showStyleBaseId},blueprint:${blueprint._id}`
	)
	const rawBlueprintConfig = applyAndValidateOverrides(showStyleBase.blueprintConfigWithOverrides).obj

	const messages = blueprintManifest.validateConfig(blueprintContext, rawBlueprintConfig)

	return {
		messages: messages.map((msg) => ({
			level: msg.level,
			message: wrapTranslatableMessageFromBlueprints(msg.message, [blueprint._id]),
		})),
	}
}

export async function runUpgradeForShowStyleBase(showStyleBaseId: ShowStyleBaseId): Promise<void> {
	logger.info(`Running upgrade for ShowStyleBase "${showStyleBaseId}"`)

	const { showStyleBase, blueprint, blueprintManifest } = await loadShowStyleAndBlueprint(showStyleBaseId)

	if (typeof blueprintManifest.applyConfig !== 'function')
		throw new Meteor.Error(500, 'Blueprint does not support this config flow')

	throwIfNeedsFixupConfigRunning(showStyleBase, blueprint, blueprintManifest)

	const blueprintContext = new CommonContext(
		'applyConfig',
		`showStyleBase:${showStyleBaseId},blueprint:${blueprint.blueprintId}`
	)
	const rawBlueprintConfig = applyAndValidateOverrides(showStyleBase.blueprintConfigWithOverrides).obj

	const result = blueprintManifest.applyConfig(blueprintContext, rawBlueprintConfig)

	await ShowStyleBases.updateAsync(showStyleBaseId, {
		$set: {
			'sourceLayersWithOverrides.defaults': normalizeArray(result.sourceLayers, '_id'),
			'outputLayersWithOverrides.defaults': normalizeArray(result.outputLayers, '_id'),
			lastBlueprintConfig: {
				blueprintHash: blueprint.blueprintHash,
				blueprintId: blueprint._id,
				blueprintConfigPresetId: showStyleBase.blueprintConfigPresetId ?? '',
				config: rawBlueprintConfig,
			},
		},
	})

	await updateTriggeredActionsForShowStyleBaseId(showStyleBaseId, result.triggeredActions)
}

async function loadShowStyleAndBlueprint(showStyleBaseId: ShowStyleBaseId) {
	const showStyleBase = (await ShowStyleBases.findOneAsync(showStyleBaseId, {
		projection: {
			_id: 1,
			blueprintId: 1,
			blueprintConfigPresetId: 1,
			blueprintConfigWithOverrides: 1,
			lastBlueprintFixUpHash: 1,
		},
	})) as
		| Pick<
				DBShowStyleBase,
				| '_id'
				| 'blueprintId'
				| 'blueprintConfigPresetId'
				| 'blueprintConfigWithOverrides'
				| 'lastBlueprintFixUpHash'
		  >
		| undefined
	if (!showStyleBase) throw new Meteor.Error(404, `ShowStyleBase "${showStyleBaseId}" not found!`)

	if (!showStyleBase.blueprintConfigPresetId) throw new Meteor.Error(500, 'ShowStyleBase is missing config preset')

	const blueprint = showStyleBase.blueprintId
		? await Blueprints.findOneAsync({
				_id: showStyleBase.blueprintId,
				blueprintType: BlueprintManifestType.SHOWSTYLE,
			})
		: undefined
	if (!blueprint) throw new Meteor.Error(404, `Blueprint "${showStyleBase.blueprintId}" not found!`)

	if (!blueprint.blueprintHash) throw new Meteor.Error(500, 'Blueprint is not valid')

	const blueprintManifest = evalBlueprint(blueprint) as ShowStyleBlueprintManifest

	return {
		showStyleBase,
		blueprint,
		blueprintManifest,
	}
}

function throwIfNeedsFixupConfigRunning(
	showStyleBase: Pick<DBShowStyleBase, 'lastBlueprintFixUpHash'>,
	blueprint: Blueprint,
	blueprintManifest: ShowStyleBlueprintManifest
): void {
	if (typeof blueprintManifest.fixUpConfig !== 'function') return

	if (blueprint.blueprintHash !== showStyleBase.lastBlueprintFixUpHash)
		throw new Meteor.Error(500, `fixupConfigForShowStyleBase must be called first`)
}
