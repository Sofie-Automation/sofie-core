import _ from 'underscore'
import path from 'path'
import { ReadStream, createReadStream, promises as fsp } from 'fs'
import { unprotectString, getRandomId } from '../../lib/tempLib'
import { getCurrentTime } from '../../lib/lib'
import { logger } from '../../logging'
import { Meteor } from 'meteor/meteor'
import { Blueprint } from '@sofie-automation/corelib/dist/dataModel/Blueprint'
import {
	BlueprintManifestType,
	IShowStyleConfigPreset,
	SomeBlueprintManifest,
	TranslationsBundle,
} from '@sofie-automation/blueprints-integration'
import { check, Match } from '../../lib/check'
import { NewBlueprintAPI, BlueprintAPIMethods } from '@sofie-automation/meteor-lib/dist/api/blueprint'
import { registerClassToMeteorMethods, ReplaceOptionalWithNullInMethodArguments } from '../../methods'
import { SYSTEM_ID } from '@sofie-automation/meteor-lib/dist/collections/CoreSystem'
import { parseVersion } from '../../systemStatus/semverUtils'
import { evalBlueprint } from './cache'
import { removeSystemStatus } from '../../systemStatus/systemStatus'
import { MethodContext, MethodContextAPI } from '../methodContext'
import { generateTranslationBundleOriginId, upsertBundles } from '../translationsBundles'
import { BlueprintId, OrganizationId, ShowStyleBaseId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { Blueprints, CoreSystem, ShowStyleBases, ShowStyleVariants, Studios } from '../../collections'
import { fetchBlueprintLight, BlueprintLight } from '../../serverOptimisations'
import { getSystemStorePath } from '../../coreSystem'
import { DBShowStyleBase } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { DBShowStyleVariant } from '@sofie-automation/corelib/dist/dataModel/ShowStyleVariant'
import { DBStudio } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { UserPermissions } from '@sofie-automation/meteor-lib/dist/userPermissions'
import { assertConnectionHasOneOfPermissions, RequestCredentials } from '../../security/auth'

const PERMISSIONS_FOR_MANAGE_BLUEPRINTS: Array<keyof UserPermissions> = ['configure']

export async function insertBlueprint(
	cred: RequestCredentials | null,
	type?: BlueprintManifestType,
	name?: string
): Promise<BlueprintId> {
	assertConnectionHasOneOfPermissions(cred, ...PERMISSIONS_FOR_MANAGE_BLUEPRINTS)

	return Blueprints.insertAsync({
		_id: getRandomId(),
		organizationId: null,
		name: name || 'New Blueprint',
		hasCode: false,
		code: '',
		modified: getCurrentTime(),
		created: getCurrentTime(),

		blueprintId: '',
		blueprintType: type,

		databaseVersion: {
			system: undefined,
		},

		blueprintVersion: '',
		integrationVersion: '',
		TSRVersion: '',

		blueprintHash: getRandomId(),
		hasFixUpFunction: false,
	})
}
export async function removeBlueprint(methodContext: MethodContext, blueprintId: BlueprintId): Promise<void> {
	check(blueprintId, String)

	assertConnectionHasOneOfPermissions(methodContext.connection, ...PERMISSIONS_FOR_MANAGE_BLUEPRINTS)

	if (!blueprintId) throw new Meteor.Error(404, `Blueprint id "${blueprintId}" was not found`)

	await Blueprints.removeAsync(blueprintId)
	removeSystemStatus('blueprintCompability_' + blueprintId)
}

export async function uploadBlueprint(
	cred: RequestCredentials,
	blueprintId: BlueprintId,
	body: string,
	blueprintName?: string,
	ignoreIdChange?: boolean
): Promise<Blueprint> {
	check(blueprintId, String)
	check(body, String)
	check(blueprintName, Match.Maybe(String))

	assertConnectionHasOneOfPermissions(cred, ...PERMISSIONS_FOR_MANAGE_BLUEPRINTS)

	if (!Meteor.isTest) logger.info(`Got blueprint '${blueprintId}'. ${body.length} bytes`)

	if (!blueprintId) throw new Meteor.Error(400, `Blueprint id "${blueprintId}" is not valid`)
	const blueprint = await fetchBlueprintLight(blueprintId)

	return innerUploadBlueprint(null, blueprint, blueprintId, body, blueprintName, ignoreIdChange)
}
export async function uploadBlueprintAsset(cred: RequestCredentials, fileId: string, body: string): Promise<void> {
	check(fileId, String)
	check(body, String)

	assertConnectionHasOneOfPermissions(cred, ...PERMISSIONS_FOR_MANAGE_BLUEPRINTS)

	const storePath = getSystemStorePath()

	// TODO: add access control here
	const data = Buffer.from(body, 'base64')
	const parsedPath = path.parse(fileId)
	logger.info(
		`Write ${data.length} bytes to ${path.join(storePath, fileId)} (storePath: ${storePath}, fileId: ${fileId})`
	)

	await fsp.mkdir(path.join(storePath, parsedPath.dir), { recursive: true })
	await fsp.writeFile(path.join(storePath, fileId), data)
}
export function retrieveBlueprintAsset(_cred: RequestCredentials, fileId: string): ReadStream {
	check(fileId, String)

	const storePath = getSystemStorePath()

	return createReadStream(path.join(storePath, fileId))
}
/** Only to be called from internal functions */
export async function internalUploadBlueprint(
	blueprintId: BlueprintId,
	body: string,
	blueprintName?: string,
	ignoreIdChange?: boolean,
	organizationId?: OrganizationId | null
): Promise<Blueprint> {
	organizationId = organizationId || null
	const blueprint = await fetchBlueprintLight(blueprintId)

	return innerUploadBlueprint(organizationId, blueprint, blueprintId, body, blueprintName, ignoreIdChange)
}
async function innerUploadBlueprint(
	organizationId: OrganizationId | null,
	blueprint: BlueprintLight | undefined,
	blueprintId: BlueprintId,
	body: string,
	blueprintName?: string,
	ignoreIdChange?: boolean
): Promise<Blueprint> {
	const newBlueprint: Blueprint = {
		_id: blueprintId,
		organizationId: organizationId,
		name: blueprint ? blueprint.name : blueprintName || unprotectString(blueprintId),
		created: blueprint ? blueprint.created : getCurrentTime(),
		code: body,
		hasCode: !!body,
		modified: getCurrentTime(),
		databaseVersion: blueprint
			? blueprint.databaseVersion
			: {
					system: undefined,
				},
		blueprintId: '',
		blueprintVersion: '',
		integrationVersion: '',
		TSRVersion: '',
		disableVersionChecks: false,
		blueprintType: undefined,
		blueprintHash: getRandomId(),
		hasFixUpFunction: false,
	}

	let blueprintManifest: SomeBlueprintManifest | undefined
	try {
		blueprintManifest = evalBlueprint(newBlueprint)
	} catch (_e) {
		throw new Meteor.Error(400, `Blueprint ${blueprintId} failed to parse`)
	}

	if (!_.isObject(blueprintManifest))
		throw new Meteor.Error(400, `Blueprint ${blueprintId} returned a manifest of type ${typeof blueprintManifest}`)

	if (!_.contains(_.values(BlueprintManifestType), blueprintManifest.blueprintType)) {
		throw new Meteor.Error(
			400,
			`Blueprint ${blueprintId} returned a manifest of unknown blueprintType "${blueprintManifest.blueprintType}"`
		)
	}

	newBlueprint.blueprintId = blueprintManifest.blueprintId || ''
	newBlueprint.blueprintType = blueprintManifest.blueprintType
	newBlueprint.blueprintVersion = blueprintManifest.blueprintVersion
	newBlueprint.integrationVersion = blueprintManifest.integrationVersion
	newBlueprint.TSRVersion = blueprintManifest.TSRVersion

	if (blueprint && blueprint.blueprintType && blueprint.blueprintType !== newBlueprint.blueprintType) {
		throw new Meteor.Error(
			400,
			`Cannot replace old blueprint (of type "${blueprint.blueprintType}") with new blueprint of type "${newBlueprint.blueprintType}"`
		)
	}
	if (blueprint && blueprint.blueprintId && blueprint.blueprintId !== newBlueprint.blueprintId) {
		if (ignoreIdChange) {
			logger.warn(
				`Replacing blueprint "${newBlueprint._id}" ("${blueprint.blueprintId}") with new blueprint "${newBlueprint.blueprintId}"`
			)

			// Force reset migrations
			newBlueprint.databaseVersion = {
				system: undefined,
			}
		} else {
			throw new Meteor.Error(
				422,
				`Cannot replace old blueprint "${newBlueprint._id}" ("${blueprint.blueprintId}") with new blueprint "${newBlueprint.blueprintId}"`
			)
		}
	}

	if (blueprintManifest.blueprintType === BlueprintManifestType.SHOWSTYLE) {
		newBlueprint.showStyleConfigSchema = blueprintManifest.showStyleConfigSchema
		newBlueprint.showStyleConfigPresets = blueprintManifest.configPresets
		newBlueprint.hasFixUpFunction = !!blueprintManifest.fixUpConfig
		newBlueprint.packageStatusMessages = blueprintManifest.packageStatusMessages
	} else if (blueprintManifest.blueprintType === BlueprintManifestType.STUDIO) {
		newBlueprint.studioConfigSchema = blueprintManifest.studioConfigSchema
		newBlueprint.studioConfigPresets = blueprintManifest.configPresets
		newBlueprint.hasFixUpFunction = !!blueprintManifest.fixUpConfig
	} else {
		newBlueprint.hasFixUpFunction = false
	}

	// Parse the versions, just to verify that the format is correct:
	parseVersion(blueprintManifest.blueprintVersion)
	parseVersion(blueprintManifest.integrationVersion)
	parseVersion(blueprintManifest.TSRVersion)

	await Blueprints.upsertAsync(newBlueprint._id, newBlueprint)

	// check for translations on the manifest and store them if they exist
	if (
		'translations' in blueprintManifest &&
		(blueprintManifest.blueprintType === BlueprintManifestType.SHOWSTYLE ||
			blueprintManifest.blueprintType === BlueprintManifestType.STUDIO ||
			blueprintManifest.blueprintType === BlueprintManifestType.SYSTEM)
	) {
		// Because the translations is bundled as stringified JSON and that string has already been
		// converted back to object form together with the rest of the manifest at this point
		// the casting is actually necessary.
		// Note that the type has to be string in the manifest interfaces to allow attaching the
		// stringified JSON in the first place.
		const translations = (blueprintManifest as any).translations as TranslationsBundle[]
		await upsertBundles(translations, generateTranslationBundleOriginId(blueprintId, 'blueprints'))
	}

	// Ensure anywhere that uses this blueprint has their configPreset updated
	if (blueprintManifest.blueprintType === BlueprintManifestType.SHOWSTYLE) {
		await syncConfigPresetsToShowStyles(newBlueprint)
	} else if (blueprintManifest.blueprintType === BlueprintManifestType.STUDIO) {
		await syncConfigPresetsToStudios(newBlueprint)
	}

	return newBlueprint
}

async function syncConfigPresetsToShowStyles(blueprint: Blueprint): Promise<void> {
	const showStyles = (await ShowStyleBases.findFetchAsync(
		{ blueprintId: blueprint._id },
		{
			projection: {
				_id: 1,
				blueprintConfigPresetId: 1,
			},
		}
	)) as Pick<DBShowStyleBase, '_id' | 'blueprintConfigPresetId'>[]

	const configPresets = blueprint.showStyleConfigPresets || {}

	const presetForShowStyle = new Map<ShowStyleBaseId, IShowStyleConfigPreset | undefined>()

	await Promise.all(
		showStyles.map(async (showStyle) => {
			const configPreset = showStyle.blueprintConfigPresetId
				? configPresets[showStyle.blueprintConfigPresetId]
				: undefined
			presetForShowStyle.set(showStyle._id, configPreset)

			return ShowStyleBases.updateAsync(showStyle._id, {
				$set: configPreset
					? {
							'blueprintConfigWithOverrides.defaults': configPreset.config,
							blueprintConfigPresetIdUnlinked: false,
						}
					: {
							blueprintConfigPresetIdUnlinked: true,
						},
			})
		})
	)

	const variants = (await ShowStyleVariants.findFetchAsync(
		{ showStyleBaseId: { $in: showStyles.map((s) => s._id) } },
		{
			projection: {
				_id: 1,
				showStyleBaseId: 1,
				blueprintConfigPresetId: 1,
			},
		}
	)) as Pick<DBShowStyleVariant, '_id' | 'blueprintConfigPresetId' | 'showStyleBaseId'>[]

	await Promise.all(
		variants.map(async (variant) => {
			const baseConfig = presetForShowStyle.get(variant.showStyleBaseId)
			const configPreset =
				baseConfig && variant.blueprintConfigPresetId
					? baseConfig.variants[variant.blueprintConfigPresetId]
					: undefined

			return ShowStyleVariants.updateAsync(variant._id, {
				$set: configPreset
					? {
							'blueprintConfigWithOverrides.defaults': configPreset.config,
							blueprintConfigPresetIdUnlinked: false,
						}
					: {
							blueprintConfigPresetIdUnlinked: true,
						},
			})
		})
	)
}
async function syncConfigPresetsToStudios(blueprint: Blueprint): Promise<void> {
	const studios = (await Studios.findFetchAsync(
		{ blueprintId: blueprint._id },
		{
			projection: {
				_id: 1,
				blueprintConfigPresetId: 1,
			},
		}
	)) as Pick<DBStudio, '_id' | 'blueprintConfigPresetId'>[]

	const configPresets = blueprint.studioConfigPresets || {}

	await Promise.all(
		studios.map(async (studio) => {
			const configPreset = studio.blueprintConfigPresetId
				? configPresets[studio.blueprintConfigPresetId]
				: undefined
			return Studios.updateAsync(studio._id, {
				$set: configPreset
					? {
							'blueprintConfigWithOverrides.defaults': configPreset.config,
							blueprintConfigPresetIdUnlinked: false,
						}
					: {
							blueprintConfigPresetIdUnlinked: true,
						},
			})
		})
	)
}

async function assignSystemBlueprint(methodContext: MethodContext, blueprintId: BlueprintId | null): Promise<void> {
	assertConnectionHasOneOfPermissions(methodContext.connection, ...PERMISSIONS_FOR_MANAGE_BLUEPRINTS)

	if (blueprintId !== undefined && blueprintId !== null) {
		check(blueprintId, String)

		const blueprint = await fetchBlueprintLight(blueprintId)
		if (!blueprint) throw new Meteor.Error(404, 'Blueprint not found')

		if (blueprint.blueprintType !== BlueprintManifestType.SYSTEM)
			throw new Meteor.Error(404, 'Blueprint not of type SYSTEM')

		await CoreSystem.updateAsync(SYSTEM_ID, {
			$set: {
				blueprintId: blueprintId,
			},
		})
	} else {
		await CoreSystem.updateAsync(SYSTEM_ID, {
			$unset: {
				blueprintId: 1,
			},
		})
	}
}

class ServerBlueprintAPI extends MethodContextAPI implements ReplaceOptionalWithNullInMethodArguments<NewBlueprintAPI> {
	async insertBlueprint() {
		return insertBlueprint(this.connection)
	}
	async removeBlueprint(blueprintId: BlueprintId) {
		return removeBlueprint(this, blueprintId)
	}
	async assignSystemBlueprint(blueprintId: BlueprintId | null) {
		return assignSystemBlueprint(this, blueprintId)
	}
}
registerClassToMeteorMethods(BlueprintAPIMethods, ServerBlueprintAPI, false)
