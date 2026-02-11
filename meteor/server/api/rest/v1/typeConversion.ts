import {
	BlueprintManifestType,
	IBlueprintConfig,
	IConfigMessage,
	IOutputLayer,
	ISourceLayer,
	ShowStyleBlueprintManifest,
	SourceLayerType,
	StatusCode,
	StudioBlueprintManifest,
} from '@sofie-automation/blueprints-integration'
import { PeripheralDevice, PeripheralDeviceType } from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'
import { Blueprint } from '@sofie-automation/corelib/dist/dataModel/Blueprint'
import {
	BlueprintId,
	BucketId,
	ShowStyleBaseId,
	ShowStyleVariantId,
	StudioId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBStudio, IStudioSettings } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { assertNever, Complete, getRandomId, literal } from '@sofie-automation/corelib/dist/lib'
import { protectString, unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import {
	applyAndValidateOverrides,
	ObjectOverrideSetOp,
	wrapDefaultObject,
	updateOverrides,
	convertObjectIntoOverrides,
	ObjectWithOverrides,
} from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import {
	APIBlueprint,
	APIBucket,
	APIBucketComplete,
	APIOutputLayer,
	APIPeripheralDevice,
	APIShowStyleBase,
	APIShowStyleVariant,
	APISourceLayer,
	APIStudio,
	APIStudioSettings,
	APIPlaylistSnapshotOptions,
	APISystemSnapshotOptions,
} from '../../../lib/rest/v1'
import { DBShowStyleBase } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { DBShowStyleVariant } from '@sofie-automation/corelib/dist/dataModel/ShowStyleVariant'
import { Blueprints, ShowStyleBases, Studios } from '../../../collections'
import { Meteor } from 'meteor/meteor'
import { evalBlueprint } from '../../blueprints/cache'
import { CommonContext } from '../../../migration/upgrades/context'
import { logger } from '../../../logging'
import {
	DEFAULT_MINIMUM_TAKE_SPAN,
	DEFAULT_FALLBACK_PART_DURATION,
} from '@sofie-automation/shared-lib/dist/core/constants'
import { Bucket } from '@sofie-automation/corelib/dist/dataModel/Bucket'
import { ForceQuickLoopAutoNext } from '@sofie-automation/shared-lib/dist/core/model/StudioSettings'
import { PlaylistSnapshotOptions, SystemSnapshotOptions } from '@sofie-automation/meteor-lib/dist/api/shapshot'

/*
This file contains functions that convert between the internal Sofie-Core types and types exposed to the external API.
When making changes to this file, be wary of breaking changes to the API.
*/

export async function showStyleBaseFrom(
	apiShowStyleBase: APIShowStyleBase,
	existingId?: ShowStyleBaseId
): Promise<DBShowStyleBase | undefined> {
	const blueprint = await Blueprints.findOneAsync(protectString(apiShowStyleBase.blueprintId))
	if (!blueprint) return undefined
	if (blueprint.blueprintType !== BlueprintManifestType.SHOWSTYLE) return undefined

	let showStyleBase: DBShowStyleBase | undefined
	if (existingId) showStyleBase = await ShowStyleBases.findOneAsync(existingId)

	const newOutputLayers = apiShowStyleBase.outputLayers.reduce<Record<string, IOutputLayer>>(
		(acc, op) => {
			acc[op.id] = { _id: op.id, name: op.name, _rank: op.rank, isPGM: op.isPgm }
			return acc
		},
		{} as Record<string, IOutputLayer>
	)
	const outputLayers = showStyleBase
		? updateOverrides(showStyleBase.outputLayersWithOverrides, newOutputLayers)
		: wrapDefaultObject({})

	const newSourceLayers = apiShowStyleBase.sourceLayers.reduce<Record<string, ISourceLayer>>(
		(acc, op) => {
			acc[op.id] = sourceLayerFrom(op)
			return acc
		},
		{} as Record<string, ISourceLayer>
	)
	const sourceLayers = showStyleBase
		? updateOverrides(showStyleBase.sourceLayersWithOverrides, newSourceLayers)
		: wrapDefaultObject({})

	const blueprintManifest = evalBlueprint(blueprint) as ShowStyleBlueprintManifest
	let blueprintConfig: ObjectWithOverrides<IBlueprintConfig>
	if (typeof blueprintManifest.blueprintConfigFromAPI !== 'function') {
		blueprintConfig = showStyleBase
			? updateOverrides(showStyleBase.blueprintConfigWithOverrides, apiShowStyleBase.config as IBlueprintConfig)
			: wrapDefaultObject({})
	} else {
		blueprintConfig = showStyleBase
			? updateOverrides(
					showStyleBase.blueprintConfigWithOverrides,
					await ShowStyleBaseBlueprintConfigFromAPI(apiShowStyleBase, blueprintManifest)
				)
			: convertObjectIntoOverrides(await ShowStyleBaseBlueprintConfigFromAPI(apiShowStyleBase, blueprintManifest))
	}

	return {
		_id: existingId ?? getRandomId(),
		name: apiShowStyleBase.name,
		blueprintId: protectString(apiShowStyleBase.blueprintId),
		blueprintConfigPresetId: apiShowStyleBase.blueprintConfigPresetId,
		outputLayersWithOverrides: outputLayers,
		sourceLayersWithOverrides: sourceLayers,
		blueprintConfigWithOverrides: blueprintConfig,
		_rundownVersionHash: showStyleBase?._rundownVersionHash ?? '',
		lastBlueprintConfig: undefined,
		lastBlueprintFixUpHash: undefined,
	}
}

export async function APIShowStyleBaseFrom(showStyleBase: DBShowStyleBase): Promise<APIShowStyleBase> {
	return {
		name: showStyleBase.name,
		blueprintId: unprotectString(showStyleBase.blueprintId),
		blueprintConfigPresetId: showStyleBase.blueprintConfigPresetId,
		outputLayers: Object.values<IOutputLayer | undefined>(
			applyAndValidateOverrides(showStyleBase.outputLayersWithOverrides).obj
		).map((layer) => APIOutputLayerFrom(layer!)),
		sourceLayers: Object.values<ISourceLayer | undefined>(
			applyAndValidateOverrides(showStyleBase.sourceLayersWithOverrides).obj
		).map((layer) => APISourceLayerFrom(layer!)),
		config: await APIShowStyleBlueprintConfigFrom(showStyleBase, showStyleBase.blueprintId),
	}
}

export function showStyleVariantFrom(
	apiShowStyleVariant: APIShowStyleVariant,
	existingId?: ShowStyleVariantId
): DBShowStyleVariant | undefined {
	const blueprintConfig = wrapDefaultObject({})
	blueprintConfig.overrides = Object.entries<any>(apiShowStyleVariant.config).map(([key, value]) =>
		literal<ObjectOverrideSetOp>({
			op: 'set',
			path: key,
			value,
		})
	)
	return {
		_id: existingId ?? getRandomId(),
		_rank: apiShowStyleVariant.rank,
		showStyleBaseId: protectString(apiShowStyleVariant.showStyleBaseId),
		name: apiShowStyleVariant.name,
		blueprintConfigWithOverrides: blueprintConfig,
		_rundownVersionHash: '',
	}
}

export async function APIShowStyleVariantFrom(
	showStyleBase: DBShowStyleBase,
	showStyleVariant: DBShowStyleVariant
): Promise<APIShowStyleVariant> {
	return {
		name: showStyleVariant.name,
		rank: showStyleVariant._rank,
		showStyleBaseId: unprotectString(showStyleVariant.showStyleBaseId),
		blueprintConfigPresetId: showStyleVariant.blueprintConfigPresetId,
		config: await APIShowStyleBlueprintConfigFrom(showStyleVariant, showStyleBase.blueprintId),
	}
}

export function sourceLayerFrom(apiSourceLayer: APISourceLayer): ISourceLayer {
	let layerType: SourceLayerType
	switch (apiSourceLayer.layerType) {
		case 'audio':
			layerType = SourceLayerType.AUDIO
			break
		case 'camera':
			layerType = SourceLayerType.CAMERA
			break
		case 'graphics':
			layerType = SourceLayerType.GRAPHICS
			break
		case 'live-speak':
			layerType = SourceLayerType.LIVE_SPEAK
			break
		case 'local':
			layerType = SourceLayerType.LOCAL
			break
		case 'lower-third':
			layerType = SourceLayerType.LOWER_THIRD
			break
		case 'remote':
			layerType = SourceLayerType.REMOTE
			break
		case 'script':
			layerType = SourceLayerType.SCRIPT
			break
		case 'splits':
			layerType = SourceLayerType.SPLITS
			break
		case 'transition':
			layerType = SourceLayerType.TRANSITION
			break
		case 'lights':
			layerType = SourceLayerType.LIGHTS
			break
		case 'unknown':
			layerType = SourceLayerType.UNKNOWN
			break
		case 'vt':
			layerType = SourceLayerType.VT
			break
		case 'studio-screen':
			layerType = SourceLayerType.STUDIO_SCREEN
			break
		case 'remote-speak':
			layerType = SourceLayerType.REMOTE_SPEAK
			break
		default:
			layerType = SourceLayerType.UNKNOWN
			assertNever(apiSourceLayer.layerType)
	}

	return {
		_id: apiSourceLayer.id,
		name: apiSourceLayer.name,
		abbreviation: apiSourceLayer.abbreviation,
		_rank: apiSourceLayer.rank,
		type: layerType,
		exclusiveGroup: apiSourceLayer.exclusiveGroup,
	}
}

export function APISourceLayerFrom(sourceLayer: ISourceLayer): APISourceLayer {
	let layerType: APISourceLayer['layerType']
	switch (sourceLayer.type) {
		case SourceLayerType.AUDIO:
			layerType = 'audio'
			break
		case SourceLayerType.CAMERA:
			layerType = 'camera'
			break
		case SourceLayerType.GRAPHICS:
			layerType = 'graphics'
			break
		case SourceLayerType.LIVE_SPEAK:
			layerType = 'live-speak'
			break
		case SourceLayerType.LOCAL:
			layerType = 'local'
			break
		case SourceLayerType.LOWER_THIRD:
			layerType = 'lower-third'
			break
		case SourceLayerType.REMOTE:
			layerType = 'remote'
			break
		case SourceLayerType.SCRIPT:
			layerType = 'script'
			break
		case SourceLayerType.SPLITS:
			layerType = 'splits'
			break
		case SourceLayerType.TRANSITION:
			layerType = 'transition'
			break
		case SourceLayerType.LIGHTS:
			layerType = 'lights'
			break
		case SourceLayerType.UNKNOWN:
			layerType = 'unknown'
			break
		case SourceLayerType.VT:
			layerType = 'vt'
			break
		case SourceLayerType.STUDIO_SCREEN:
			layerType = 'studio-screen'
			break
		case SourceLayerType.REMOTE_SPEAK:
			layerType = 'remote-speak'
			break
		default:
			layerType = 'unknown'
			assertNever(sourceLayer.type)
	}

	return {
		id: sourceLayer._id,
		name: sourceLayer.name,
		abbreviation: sourceLayer.abbreviation,
		rank: sourceLayer._rank,
		layerType,
		exclusiveGroup: sourceLayer.exclusiveGroup,
	}
}

export async function studioFrom(apiStudio: APIStudio, existingId?: StudioId): Promise<DBStudio | undefined> {
	let blueprint: Blueprint | undefined
	if (apiStudio.blueprintId) {
		blueprint = await Blueprints.findOneAsync(protectString(apiStudio.blueprintId))
		if (blueprint?.blueprintType !== BlueprintManifestType.STUDIO) return undefined
	}
	if (!blueprint) return undefined

	let existingStudio: DBStudio | undefined
	if (existingId) existingStudio = await Studios.findOneAsync(existingId)

	const blueprintManifest = evalBlueprint(blueprint) as StudioBlueprintManifest

	return buildStudioFromResolved({
		apiStudio,
		existingStudio,
		blueprintManifest,
		blueprintId: blueprint._id,
		studioId: existingId ?? getRandomId(),
	})
}

export async function buildStudioFromResolved({
	apiStudio,
	existingStudio,
	blueprintManifest,
	blueprintId,
	studioId,
}: {
	apiStudio: APIStudio
	existingStudio?: DBStudio
	blueprintManifest: StudioBlueprintManifest
	blueprintId: BlueprintId
	studioId: StudioId
}): Promise<DBStudio> {
	let blueprintConfig: ObjectWithOverrides<IBlueprintConfig>
	if (typeof blueprintManifest.blueprintConfigFromAPI !== 'function') {
		blueprintConfig = existingStudio
			? updateOverrides(existingStudio.blueprintConfigWithOverrides, apiStudio.config as IBlueprintConfig)
			: wrapDefaultObject({})
	} else {
		blueprintConfig = existingStudio
			? updateOverrides(
					existingStudio.blueprintConfigWithOverrides,
					await StudioBlueprintConfigFromAPI(apiStudio, blueprintManifest)
				)
			: convertObjectIntoOverrides(await StudioBlueprintConfigFromAPI(apiStudio, blueprintManifest))
	}

	const studioSettings = studioSettingsFrom(apiStudio.settings)

	return {
		// fill in the blanks if there is no existing studio
		mappingsWithOverrides: wrapDefaultObject({}),
		routeSetsWithOverrides: wrapDefaultObject({}),
		_rundownVersionHash: '',
		routeSetExclusivityGroupsWithOverrides: wrapDefaultObject({}),
		packageContainersWithOverrides: wrapDefaultObject({}),
		previewContainerIds: [],
		thumbnailContainerIds: [],
		peripheralDeviceSettings: {
			deviceSettings: wrapDefaultObject({}),
			playoutDevices: wrapDefaultObject({}),
			ingestDevices: wrapDefaultObject({}),
			inputDevices: wrapDefaultObject({}),
		},
		lastBlueprintConfig: undefined,
		lastBlueprintFixUpHash: undefined,

		// take what existing studio might have
		...existingStudio,

		// override what apiStudio can
		_id: studioId,
		name: apiStudio.name,
		blueprintId,
		blueprintConfigPresetId: apiStudio.blueprintConfigPresetId,
		blueprintConfigWithOverrides: blueprintConfig,
		settingsWithOverrides: existingStudio
			? updateOverrides(existingStudio.settingsWithOverrides, studioSettings)
			: wrapDefaultObject(studioSettings),
		supportedShowStyleBase: apiStudio.supportedShowStyleBase?.map((id) => protectString<ShowStyleBaseId>(id)) ?? [],
	}
}

export async function APIStudioFrom(studio: DBStudio): Promise<Complete<APIStudio>> {
	const studioSettings = APIStudioSettingsFrom(applyAndValidateOverrides(studio.settingsWithOverrides).obj)

	return {
		name: studio.name,
		blueprintId: unprotectString(studio.blueprintId),
		blueprintConfigPresetId: studio.blueprintConfigPresetId,
		config: await APIStudioBlueprintConfigFrom(studio),
		settings: studioSettings,
		supportedShowStyleBase: studio.supportedShowStyleBase.map((id) => unprotectString(id)),
	}
}

export function studioSettingsFrom(apiStudioSettings: APIStudioSettings): Complete<IStudioSettings> {
	return {
		frameRate: apiStudioSettings.frameRate,
		mediaPreviewsUrl: apiStudioSettings.mediaPreviewsUrl,
		slackEvaluationUrls: apiStudioSettings.slackEvaluationUrls?.join(','),
		supportedMediaFormats: apiStudioSettings.supportedMediaFormats?.join(','),
		supportedAudioStreams: apiStudioSettings.supportedAudioStreams?.join(','),
		enablePlayFromAnywhere: apiStudioSettings.enablePlayFromAnywhere,
		forceMultiGatewayMode: apiStudioSettings.forceMultiGatewayMode,
		multiGatewayNowSafeLatency: apiStudioSettings.multiGatewayNowSafeLatency,
		allowRundownResetOnAir: apiStudioSettings.allowRundownResetOnAir,
		preserveOrphanedSegmentPositionInRundown: apiStudioSettings.preserveOrphanedSegmentPositionInRundown,
		allowTestingAdlibsToPersist: apiStudioSettings.allowTestingAdlibsToPersist,
		minimumTakeSpan: apiStudioSettings.minimumTakeSpan ?? DEFAULT_MINIMUM_TAKE_SPAN,
		enableQuickLoop: apiStudioSettings.enableQuickLoop,
		forceQuickLoopAutoNext: forceQuickLoopAutoNextFrom(apiStudioSettings.forceQuickLoopAutoNext),
		fallbackPartDuration: apiStudioSettings.fallbackPartDuration ?? DEFAULT_FALLBACK_PART_DURATION,
		enableUserEdits: apiStudioSettings.enableUserEdits,
		allowAdlibTestingSegment: apiStudioSettings.allowAdlibTestingSegment,
		allowHold: apiStudioSettings.allowHold ?? true, // Backwards compatible
		allowPieceDirectPlay: apiStudioSettings.allowPieceDirectPlay ?? true, // Backwards compatible
		enableBuckets: apiStudioSettings.enableBuckets ?? true, // Backwards compatible
		enableEvaluationForm: apiStudioSettings.enableEvaluationForm ?? true, // Backwards compatible
		mockPieceContentStatus: apiStudioSettings.mockPieceContentStatus,
		rundownGlobalPiecesPrepareTime: apiStudioSettings.rundownGlobalPiecesPrepareTime,
	}
}

export function APIStudioSettingsFrom(settings: IStudioSettings): Complete<APIStudioSettings> {
	return {
		frameRate: settings.frameRate,
		mediaPreviewsUrl: settings.mediaPreviewsUrl,
		slackEvaluationUrls: settings.slackEvaluationUrls?.split(','),
		supportedMediaFormats: settings.supportedMediaFormats?.split(','),
		supportedAudioStreams: settings.supportedAudioStreams?.split(','),
		enablePlayFromAnywhere: settings.enablePlayFromAnywhere,
		forceMultiGatewayMode: settings.forceMultiGatewayMode,
		multiGatewayNowSafeLatency: settings.multiGatewayNowSafeLatency,
		allowRundownResetOnAir: settings.allowRundownResetOnAir,
		preserveOrphanedSegmentPositionInRundown: settings.preserveOrphanedSegmentPositionInRundown,
		minimumTakeSpan: settings.minimumTakeSpan,
		enableQuickLoop: settings.enableQuickLoop,
		forceQuickLoopAutoNext: APIForceQuickLoopAutoNextFrom(settings.forceQuickLoopAutoNext),
		fallbackPartDuration: settings.fallbackPartDuration,
		enableUserEdits: settings.enableUserEdits,
		allowAdlibTestingSegment: settings.allowAdlibTestingSegment,
		allowTestingAdlibsToPersist: settings.allowTestingAdlibsToPersist,
		allowHold: settings.allowHold,
		allowPieceDirectPlay: settings.allowPieceDirectPlay,
		enableBuckets: settings.enableBuckets,
		enableEvaluationForm: settings.enableEvaluationForm,
		mockPieceContentStatus: settings.mockPieceContentStatus,
		rundownGlobalPiecesPrepareTime: settings.rundownGlobalPiecesPrepareTime,
	}
}

export function forceQuickLoopAutoNextFrom(
	forceQuickLoopAutoNext: APIStudioSettings['forceQuickLoopAutoNext']
): ForceQuickLoopAutoNext | undefined {
	if (!forceQuickLoopAutoNext) return undefined
	switch (forceQuickLoopAutoNext) {
		case 'disabled':
			return ForceQuickLoopAutoNext.DISABLED
		case 'enabled_forcing_min_duration':
			return ForceQuickLoopAutoNext.ENABLED_FORCING_MIN_DURATION
		case 'enabled_when_valid_duration':
			return ForceQuickLoopAutoNext.ENABLED_WHEN_VALID_DURATION
		default:
			assertNever(forceQuickLoopAutoNext)
			return undefined
	}
}

export function APIForceQuickLoopAutoNextFrom(
	forceQuickLoopAutoNext: ForceQuickLoopAutoNext | undefined
): APIStudioSettings['forceQuickLoopAutoNext'] {
	if (!forceQuickLoopAutoNext) return undefined
	switch (forceQuickLoopAutoNext) {
		case ForceQuickLoopAutoNext.DISABLED:
			return 'disabled'
		case ForceQuickLoopAutoNext.ENABLED_FORCING_MIN_DURATION:
			return 'enabled_forcing_min_duration'
		case ForceQuickLoopAutoNext.ENABLED_WHEN_VALID_DURATION:
			return 'enabled_when_valid_duration'
		default:
			assertNever(forceQuickLoopAutoNext)
	}
}

export function APIPeripheralDeviceFrom(device: PeripheralDevice): APIPeripheralDevice {
	let status: APIPeripheralDevice['status'] = 'unknown'
	switch (device.status.statusCode) {
		case StatusCode.BAD:
			status = 'bad'
			break
		case StatusCode.FATAL:
			status = 'fatal'
			break
		case StatusCode.GOOD:
			status = 'good'
			break
		case StatusCode.WARNING_MAJOR:
			status = 'warning_major'
			break
		case StatusCode.WARNING_MINOR:
			status = 'marning_minor'
			break
		case StatusCode.UNKNOWN:
			status = 'unknown'
			break
		default:
			assertNever(device.status.statusCode)
	}

	let deviceType: APIPeripheralDevice['deviceType'] = 'unknown'
	switch (device.type) {
		case PeripheralDeviceType.INEWS:
			deviceType = 'inews'
			break
		case PeripheralDeviceType.LIVE_STATUS:
			deviceType = 'live_status'
			break
		case PeripheralDeviceType.MOS:
			deviceType = 'mos'
			break
		case PeripheralDeviceType.PACKAGE_MANAGER:
			deviceType = 'package_manager'
			break
		case PeripheralDeviceType.PLAYOUT:
			deviceType = 'playout'
			break
		case PeripheralDeviceType.SPREADSHEET:
			deviceType = 'spreadsheet'
			break
		case PeripheralDeviceType.INPUT:
			deviceType = 'input'
			break
		default:
			assertNever(device.type)
	}

	return {
		id: unprotectString(device._id),
		name: device.name,
		status,
		messages: device.status.messages ?? [],
		deviceType,
		connected: device.connected,
	}
}

export function APIBlueprintFrom(blueprint: Blueprint): APIBlueprint | undefined {
	if (!blueprint.blueprintType) return undefined

	return {
		id: unprotectString(blueprint._id),
		name: blueprint.name,
		blueprintType: blueprint.blueprintType,
		blueprintVersion: blueprint.blueprintVersion,
	}
}

export function APIOutputLayerFrom(outputLayer: IOutputLayer): APIOutputLayer {
	return {
		id: outputLayer._id,
		name: outputLayer.name,
		rank: outputLayer._rank,
		isPgm: outputLayer.isPGM,
	}
}

async function getBlueprint(
	blueprintId: BlueprintId | undefined,
	blueprintType: BlueprintManifestType
): Promise<Blueprint> {
	const blueprint = blueprintId
		? await Blueprints.findOneAsync({
				_id: blueprintId,
				blueprintType,
			})
		: undefined
	if (!blueprint) throw new Meteor.Error(404, `Blueprint "${blueprintId}" not found!`)

	if (!blueprint.blueprintHash) throw new Meteor.Error(500, 'Blueprint is not valid')

	return blueprint
}

export async function validateAPIBlueprintConfigForShowStyle(
	apiShowStyle: APIShowStyleBase | APIShowStyleVariant,
	blueprintId: BlueprintId
): Promise<Array<IConfigMessage>> {
	if (!apiShowStyle.blueprintConfigPresetId) {
		logger.warn(`ShowStyle ${apiShowStyle.name} is missing config preset`)
		return []
	}
	const blueprint = await getBlueprint(blueprintId, BlueprintManifestType.SHOWSTYLE)
	const blueprintManifest = evalBlueprint(blueprint) as ShowStyleBlueprintManifest

	if (typeof blueprintManifest.validateConfigFromAPI !== 'function') {
		logger.info(`Blueprint ${blueprintManifest.blueprintId} does not support Config validation`)
		return []
	}

	const blueprintContext = new CommonContext(
		'validateAPIBlueprintConfig',
		`showStyle:${apiShowStyle.name},blueprint:${blueprint._id}`
	)

	return blueprintManifest.validateConfigFromAPI(blueprintContext, apiShowStyle.config)
}

export async function ShowStyleBaseBlueprintConfigFromAPI(
	apiShowStyleBase: APIShowStyleBase,
	blueprintManifest: ShowStyleBlueprintManifest
): Promise<IBlueprintConfig> {
	if (!apiShowStyleBase.blueprintConfigPresetId) {
		logger.warn(`ShowStyleBase ${apiShowStyleBase.name} is missing config preset`)
		return apiShowStyleBase.config as IBlueprintConfig
	}

	if (typeof blueprintManifest.blueprintConfigFromAPI !== 'function') {
		return apiShowStyleBase.config as IBlueprintConfig
	}

	const blueprintContext = new CommonContext(
		'BlueprintConfigFromAPI',
		`showStyleBase:${apiShowStyleBase.name},blueprint:${blueprintManifest.blueprintId}`
	)

	return blueprintManifest.blueprintConfigFromAPI(blueprintContext, apiShowStyleBase.config)
}

export async function APIShowStyleBlueprintConfigFrom(
	showStyle: DBShowStyleBase | DBShowStyleVariant,
	blueprintId: BlueprintId
): Promise<object> {
	if (!showStyle.blueprintConfigPresetId) {
		logger.warn(`ShowStyle ${showStyle._id} is missing config preset`)
		return applyAndValidateOverrides(showStyle.blueprintConfigWithOverrides).obj
	}
	const blueprint = await getBlueprint(blueprintId, BlueprintManifestType.SHOWSTYLE)
	const blueprintManifest = evalBlueprint(blueprint) as ShowStyleBlueprintManifest

	if (typeof blueprintManifest.blueprintConfigToAPI !== 'function')
		return applyAndValidateOverrides(showStyle.blueprintConfigWithOverrides).obj

	const blueprintContext = new CommonContext(
		'APIShowStyleBlueprintConfigFrom',
		`showStyleBase:${showStyle._id},blueprint:${blueprint._id}`
	)

	return blueprintManifest.blueprintConfigToAPI(
		blueprintContext,
		applyAndValidateOverrides(showStyle.blueprintConfigWithOverrides).obj
	)
}

export async function validateAPIBlueprintConfigForStudio(apiStudio: APIStudio): Promise<Array<IConfigMessage>> {
	if (!apiStudio.blueprintConfigPresetId) {
		logger.warn(`Studio ${apiStudio.name} is missing config preset`)
		return []
	}
	const blueprint = await getBlueprint(protectString(apiStudio.blueprintId), BlueprintManifestType.STUDIO)
	const blueprintManifest = evalBlueprint(blueprint) as StudioBlueprintManifest

	if (typeof blueprintManifest.validateConfigFromAPI !== 'function') {
		logger.info(`Blueprint ${blueprintManifest.blueprintId} does not support Config validation`)
		return []
	}

	const blueprintContext = new CommonContext(
		'validateAPIBlueprintConfig',
		`studio:${apiStudio.name},blueprint:${blueprint._id}`
	)

	return blueprintManifest.validateConfigFromAPI(blueprintContext, apiStudio.config)
}

export async function StudioBlueprintConfigFromAPI(
	apiStudio: APIStudio,
	blueprintManifest: StudioBlueprintManifest
): Promise<IBlueprintConfig> {
	if (!apiStudio.blueprintConfigPresetId) {
		logger.warn(`Studio ${apiStudio.name} is missing config preset`)
		return apiStudio.config as IBlueprintConfig
	}

	if (typeof blueprintManifest.blueprintConfigFromAPI !== 'function') {
		return apiStudio.config as IBlueprintConfig
	}

	const blueprintContext = new CommonContext(
		'BlueprintConfigFromAPI',
		`studio:${apiStudio.name},blueprint:${blueprintManifest.blueprintId}`
	)

	return blueprintManifest.blueprintConfigFromAPI(blueprintContext, apiStudio.config)
}

export async function APIStudioBlueprintConfigFrom(studio: DBStudio): Promise<object> {
	if (!studio.blueprintConfigPresetId) {
		logger.warn(`Studio ${studio._id} is missing config preset`)
		return applyAndValidateOverrides(studio.blueprintConfigWithOverrides).obj
	}
	const blueprint = await getBlueprint(studio.blueprintId, BlueprintManifestType.STUDIO)
	const blueprintManifest = evalBlueprint(blueprint) as StudioBlueprintManifest

	if (typeof blueprintManifest.blueprintConfigToAPI !== 'function')
		return applyAndValidateOverrides(studio.blueprintConfigWithOverrides).obj

	const blueprintContext = new CommonContext(
		'APIStudioBlueprintConfigFrom',
		`studio:${studio.name},blueprint:${blueprint._id}`
	)

	return blueprintManifest.blueprintConfigToAPI(
		blueprintContext,
		applyAndValidateOverrides(studio.blueprintConfigWithOverrides).obj
	)
}

export function bucketFrom(apiBucket: APIBucket, existingId?: BucketId): Bucket {
	return {
		_id: existingId ?? getRandomId(),
		studioId: protectString(apiBucket.studioId),
		name: apiBucket.name,
		_rank: 0,
		width: undefined,
		buttonWidthScale: 1,
		buttonHeightScale: 1,
	}
}

export function APIBucketFrom(bucket: Bucket): APIBucketComplete {
	return {
		id: unprotectString(bucket._id),
		name: bucket.name,
		studioId: unprotectString(bucket.studioId),
	}
}

export function systemSnapshotOptionsFrom(options: APISystemSnapshotOptions): SystemSnapshotOptions {
	return {
		withDeviceSnapshots: !!options.withDeviceSnapshots,
		studioId: typeof options.studioId === 'string' ? protectString(options.studioId) : undefined,
	}
}

export function playlistSnapshotOptionsFrom(options: APIPlaylistSnapshotOptions): PlaylistSnapshotOptions {
	return {
		withDeviceSnapshots: !!options.withDeviceSnapshots,
		withArchivedDocuments: !!options.withArchivedDocuments,
		withTimeline: !!options.withTimeline,
	}
}

export async function validateAPIRundownPayload(
	blueprintId: BlueprintId | undefined,
	rundownPayload: unknown
): Promise<string[] | undefined> {
	const blueprint = await getBlueprint(blueprintId, BlueprintManifestType.STUDIO)
	const blueprintManifest = evalBlueprint(blueprint) as StudioBlueprintManifest

	if (typeof blueprintManifest.validateRundownPayloadFromAPI !== 'function') {
		logger.info(`Blueprint ${blueprintManifest.blueprintId} does not support rundown payload validation`)
		return []
	}

	const blueprintContext = new CommonContext('validateAPIRundownPayload', `blueprint:${blueprint._id}`)

	return blueprintManifest.validateRundownPayloadFromAPI(blueprintContext, rundownPayload)
}

export async function validateAPISegmentPayload(
	blueprintId: BlueprintId | undefined,
	segmentPayload: unknown
): Promise<string[] | undefined> {
	const blueprint = await getBlueprint(blueprintId, BlueprintManifestType.STUDIO)
	const blueprintManifest = evalBlueprint(blueprint) as StudioBlueprintManifest

	if (typeof blueprintManifest.validateSegmentPayloadFromAPI !== 'function') {
		logger.info(`Blueprint ${blueprintManifest.blueprintId} does not support segment payload validation`)
		return []
	}

	const blueprintContext = new CommonContext('validateAPISegmentPayload', `blueprint:${blueprint._id}`)

	return blueprintManifest.validateSegmentPayloadFromAPI(blueprintContext, segmentPayload)
}

export async function validateAPIPartPayload(
	blueprintId: BlueprintId | undefined,
	partPayload: unknown
): Promise<string[] | undefined> {
	const blueprint = await getBlueprint(blueprintId, BlueprintManifestType.STUDIO)
	const blueprintManifest = evalBlueprint(blueprint) as StudioBlueprintManifest

	if (typeof blueprintManifest.validatePartPayloadFromAPI !== 'function') {
		logger.info(`Blueprint ${blueprintManifest.blueprintId} does not support part payload validation`)
		return []
	}

	const blueprintContext = new CommonContext('validateAPIPartPayload', `blueprint:${blueprint._id}`)

	return blueprintManifest.validatePartPayloadFromAPI(blueprintContext, partPayload)
}
