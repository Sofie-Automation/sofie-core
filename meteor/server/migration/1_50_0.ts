import { addMigrationSteps } from './databaseMigration'
import {
	AdLibActions,
	AdLibPieces,
	ExpectedPackages,
	PartInstances,
	Parts,
	PeripheralDevices,
	Pieces,
	RundownPlaylists,
	Studios,
} from '../collections'
import { assertNever, clone, literal } from '@sofie-automation/corelib/dist/lib'
import {
	MappingExt,
	StudioIngestDevice,
	StudioInputDevice,
	StudioPlayoutDevice,
	StudioRouteSet,
} from '@sofie-automation/corelib/dist/dataModel/Studio'
import {
	PeripheralDeviceCategory,
	PeripheralDeviceType,
} from '@sofie-automation/shared-lib/dist/peripheralDevice/peripheralDeviceAPI'
import _ from 'underscore'
import { DBStudio } from '@sofie-automation/corelib/dist/dataModel/Studio'
import {
	wrapDefaultObject,
	ObjectOverrideSetOp,
	SomeObjectOverrideOp,
} from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { JSONBlobStringify, JSONSchema, TSR } from '@sofie-automation/blueprints-integration'
import { DEFAULT_MINIMUM_TAKE_SPAN } from '@sofie-automation/shared-lib/dist/core/constants'
import { PartId } from '@sofie-automation/shared-lib/dist/core/model/Ids'
import { protectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import { ExpectedPackageDBType } from '@sofie-automation/corelib/dist/dataModel/ExpectedPackages'
import {
	AdLibActionId,
	BucketAdLibActionId,
	BucketAdLibId,
	PieceId,
	RundownBaselineAdLibActionId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { Piece } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { AdLibPiece } from '@sofie-automation/corelib/dist/dataModel/AdLibPiece'
import { AdLibAction } from '@sofie-automation/corelib/dist/dataModel/AdlibAction'

// Release 50

const mappingBaseOptions: Array<keyof MappingExt> = [
	'_id' as any,
	'device',
	'deviceId',
	'layerName',
	'lookahead',
	'lookaheadDepth',
	'lookaheadMaxSearchDistance',
]

function convertMappingsOverrideOps(studio: DBStudio) {
	let changed = false

	const newOverrides = clone(studio.mappingsWithOverrides.overrides)

	// Note: we can ignore the defaults of the mappings, as they will be replaced by an updated blueprint

	for (const overrideOp of newOverrides) {
		const parsedOp = overrideOp.path.match(/^([^.]+).(.+)$/i)
		// eg `casparcg_cg_effects.lookahead`, `casparcg_cg_effects.channel`, `casparcg_cg_effects.options.channel`

		if (!parsedOp && overrideOp.op === 'set' && !overrideOp.value.options) {
			// Op looks to be defining a local mapping, update how it works
			overrideOp.value = {
				..._.pick(overrideOp.value, ...mappingBaseOptions),
				options: _.omit(overrideOp.value, ...mappingBaseOptions),
			}
			changed = true
		} else if (
			parsedOp &&
			!parsedOp[2].startsWith('options.') &&
			!mappingBaseOptions.includes(parsedOp[2] as keyof MappingExt)
		) {
			// Path looks to not be a common property, so adjust
			overrideOp.path = `${parsedOp[1]}.options.${parsedOp[2]}`
			changed = true
		}
	}

	return changed && newOverrides
}

function convertRouteSetMappings(routeSets: Record<string, StudioRouteSet>) {
	let changed = false

	const newRouteSets = clone(routeSets || {})
	for (const routeSet of Object.values<StudioRouteSet>(newRouteSets)) {
		for (const route of routeSet.routes) {
			if (route.remapping && !route.remapping.options) {
				// Update the remapping for a route
				route.remapping = {
					..._.pick(route.remapping, ...mappingBaseOptions),
					options: _.omit(route.remapping, ...mappingBaseOptions),
				}
				// console.log('new route', route)
				changed = true
			}
		}
	}

	return changed && newRouteSets
}

enum OldDeviceType {
	ABSTRACT = 0,
	CASPARCG = 1,
	ATEM = 2,
	LAWO = 3,
	HTTPSEND = 4,
	PANASONIC_PTZ = 5,
	TCPSEND = 6,
	HYPERDECK = 7,
	PHAROS = 8,
	OSC = 9,
	HTTPWATCHER = 10,
	SISYFOS = 11,
	QUANTEL = 12,
	VIZMSE = 13,
	SINGULAR_LIVE = 14,
	SHOTOKU = 15,
	VMIX = 20,
	OBS = 21,
	SOFIE_CHEF = 22,
	TELEMETRICS = 23,
	TRICASTER = 24,
	MULTI_OSC = 25,
}

const oldDeviceTypeToNewMapping = {
	[OldDeviceType.ABSTRACT]: TSR.DeviceType.ABSTRACT,
	[OldDeviceType.CASPARCG]: TSR.DeviceType.CASPARCG,
	[OldDeviceType.ATEM]: TSR.DeviceType.ATEM,
	[OldDeviceType.LAWO]: TSR.DeviceType.LAWO,
	[OldDeviceType.HTTPSEND]: TSR.DeviceType.HTTPSEND,
	[OldDeviceType.PANASONIC_PTZ]: TSR.DeviceType.PANASONIC_PTZ,
	[OldDeviceType.TCPSEND]: TSR.DeviceType.TCPSEND,
	[OldDeviceType.HYPERDECK]: TSR.DeviceType.HYPERDECK,
	[OldDeviceType.PHAROS]: TSR.DeviceType.PHAROS,
	[OldDeviceType.OSC]: TSR.DeviceType.OSC,
	[OldDeviceType.HTTPWATCHER]: TSR.DeviceType.HTTPWATCHER,
	[OldDeviceType.SISYFOS]: TSR.DeviceType.SISYFOS,
	[OldDeviceType.QUANTEL]: TSR.DeviceType.QUANTEL,
	[OldDeviceType.VIZMSE]: TSR.DeviceType.VIZMSE,
	[OldDeviceType.SINGULAR_LIVE]: TSR.DeviceType.SINGULAR_LIVE,
	[OldDeviceType.SHOTOKU]: TSR.DeviceType.SHOTOKU,
	[OldDeviceType.VMIX]: TSR.DeviceType.VMIX,
	[OldDeviceType.OBS]: TSR.DeviceType.OBS,
	[OldDeviceType.SOFIE_CHEF]: TSR.DeviceType.SOFIE_CHEF,
	[OldDeviceType.TELEMETRICS]: TSR.DeviceType.TELEMETRICS,
	[OldDeviceType.TRICASTER]: TSR.DeviceType.TRICASTER,
	[OldDeviceType.MULTI_OSC]: TSR.DeviceType.MULTI_OSC,
}

const EXPECTED_PACKAGE_TYPES_ADDED_PART_ID = [
	ExpectedPackageDBType.PIECE,
	ExpectedPackageDBType.ADLIB_PIECE,
	ExpectedPackageDBType.ADLIB_ACTION,
]

export const addSteps = addMigrationSteps('1.50.0', [
	{
		id: `Mos gateway fix up config`,
		canBeRunAutomatically: true,
		validate: async () => {
			const objects = await PeripheralDevices.findFetchAsync({
				type: PeripheralDeviceType.MOS,
				'settings.device': { $exists: true },
			})
			const badObject = objects.find(
				(device) =>
					!!Object.values<unknown>((device as any).settings?.['devices'] ?? {}).find(
						(subdev: any) => !subdev?.type || !subdev?.options
					)
			)

			if (badObject) {
				return `object needs to be updated`
			}
			return false
		},
		migrate: async () => {
			const objects = await PeripheralDevices.findFetchAsync({
				type: PeripheralDeviceType.MOS,
				'settings.device': { $exists: true },
			})
			for (const obj of objects) {
				const newDevices: any = clone((obj as any).settings?.['devices'] || {})

				for (const [id, subdev] of Object.entries<any>(newDevices)) {
					if (!subdev) continue

					const newdev = subdev.options ? subdev : { options: subdev }
					delete newdev.options.type
					newdev.type = 'default'

					newDevices[id] = newdev
				}

				await PeripheralDevices.updateAsync(obj._id, {
					$set: {
						'settings.devices': newDevices,
					},
				})
			}
		},
	},

	{
		id: `Fix up studio mappings`,
		canBeRunAutomatically: true,
		validate: async () => {
			const studios = await Studios.findFetchAsync({ mappingsWithOverrides: { $exists: true } })

			for (const studio of studios) {
				const newOverrides = convertMappingsOverrideOps(studio)
				if (newOverrides) {
					return `object needs to be updated`
				}
			}

			return false
		},
		migrate: async () => {
			const studios = await Studios.findFetchAsync({ mappingsWithOverrides: { $exists: true } })

			for (const studio of studios) {
				// Note: we can ignore the defaults of the mappings, as they will be replaced by an updated blueprint

				const newOverrides = convertMappingsOverrideOps(studio)

				if (newOverrides) {
					await Studios.updateAsync(studio._id, {
						$set: {
							'mappingsWithOverrides.overrides': newOverrides,
						},
					})
				}
			}
		},
	},

	{
		id: `Fix up studio routesets`,
		canBeRunAutomatically: true,
		validate: async () => {
			const studios = await Studios.findFetchAsync({ routeSets: { $exists: true } })
			for (const studio of studios) {
				// Ignore this if the routeSets has been converted into an OverrideWithObjects:
				if (studio.routeSetsWithOverrides) continue
				//@ts-expect-error routeSets are not part of the typings:
				const plainRouteSets = studio.routeSets as any as Record<string, StudioRouteSet>
				const newRouteSets = convertRouteSetMappings(plainRouteSets)
				if (newRouteSets) {
					return `object needs to be updated`
				}
			}

			return false
		},
		migrate: async () => {
			const studios = await Studios.findFetchAsync({ routeSets: { $exists: true } })

			for (const studio of studios) {
				// Ignore this if the routeSets already has been converted into an OverrideWithObjects:
				if (studio.routeSetsWithOverrides) continue
				//@ts-expect-error routeSets are not part of the typings:
				const plainRouteSets = studio.routeSets as any as Record<string, StudioRouteSet>

				const newRouteSets = convertRouteSetMappings(plainRouteSets)

				if (newRouteSets) {
					await Studios.updateAsync(studio._id, {
						$set: {
							routeSets: newRouteSets,
						},
					})
				}
			}
		},
	},

	{
		id: `Ingest gateway populate nrcsName`,
		canBeRunAutomatically: true,
		validate: async () => {
			const objectCount = await PeripheralDevices.countDocuments({
				category: PeripheralDeviceCategory.INGEST,
				nrcsName: { $exists: false },
			})

			if (objectCount) {
				return `object needs to be updated`
			}
			return false
		},
		migrate: async () => {
			const objects = await PeripheralDevices.findFetchAsync({
				category: PeripheralDeviceCategory.INGEST,
				nrcsName: { $exists: false },
			})
			for (const device of objects) {
				let nrcsName = ''

				if (device.type === PeripheralDeviceType.MOS) {
					nrcsName = 'ENPS'
				} else if (device.type === PeripheralDeviceType.INEWS) {
					nrcsName = 'iNews'
				} else if (device.type === PeripheralDeviceType.SPREADSHEET) {
					nrcsName = 'Google Sheet'
				}

				await PeripheralDevices.updateAsync(device._id, {
					$set: {
						nrcsName: nrcsName,
					},
				})
			}
		},
	},
	{
		id: `PeripheralDevice populate documentationUrl`,
		canBeRunAutomatically: true,
		validate: async () => {
			const objectCount = await PeripheralDevices.countDocuments({
				documentationUrl: { $exists: false },
			})

			if (objectCount) {
				return `object needs to be updated`
			}
			return false
		},
		migrate: async () => {
			const objects = await PeripheralDevices.findFetchAsync({
				documentationUrl: { $exists: false },
			})
			for (const device of objects) {
				let documentationUrl = ''

				if (device.type === PeripheralDeviceType.MOS) {
					documentationUrl = 'https://github.com/Sofie-Automation/sofie-core'
				} else if (device.type === PeripheralDeviceType.SPREADSHEET) {
					documentationUrl = 'https://github.com/SuperFlyTV/spreadsheet-gateway'
				} else if (device.type === PeripheralDeviceType.PLAYOUT) {
					documentationUrl = 'https://github.com/Sofie-Automation/sofie-core'
				} else if (device.type === PeripheralDeviceType.INEWS) {
					documentationUrl = 'https://github.com/olzzon/tv2-inews-ftp-gateway'
				} else if (device.type === PeripheralDeviceType.PACKAGE_MANAGER) {
					documentationUrl = 'https://github.com/Sofie-Automation/sofie-package-manager'
				} else if (device.type === PeripheralDeviceType.INPUT) {
					documentationUrl = 'https://github.com/Sofie-Automation/sofie-input-gateway'
				} else if (device.type === PeripheralDeviceType.LIVE_STATUS) {
					documentationUrl = 'https://sofie-automation.github.io/sofie-core/'
				} else {
					assertNever(device.type)
				}

				await PeripheralDevices.updateAsync(device._id, {
					$set: {
						documentationUrl: documentationUrl,
					},
				})
			}
		},
	},

	{
		// This is excessively verbose, but sometimes the db gets into a bad state with these objects being only partially defined
		id: `Studio ensure peripheralDeviceSettings field`,
		canBeRunAutomatically: true,
		validate: async () => {
			const objectCount = await Studios.countDocuments({
				$or: [
					{
						peripheralDeviceSettings: { $exists: false },
					},
					{
						'peripheralDeviceSettings.playoutDevices.defaults': { $exists: false },
					},
					{
						'peripheralDeviceSettings.playoutDevices.overrides': { $exists: false },
					},
					{
						'peripheralDeviceSettings.ingestDevices.defaults': { $exists: false },
					},
					{
						'peripheralDeviceSettings.ingestDevices.overrides': { $exists: false },
					},
					{
						'peripheralDeviceSettings.inputDevices.defaults': { $exists: false },
					},
					{
						'peripheralDeviceSettings.inputDevices.overrides': { $exists: false },
					},
				],
			})

			if (objectCount) {
				return `object needs to be updated`
			}
			return false
		},
		migrate: async () => {
			const objects = await Studios.findFetchAsync({
				$or: [
					{
						peripheralDeviceSettings: { $exists: false },
					},
					{
						'peripheralDeviceSettings.playoutDevices.defaults': { $exists: false },
					},
					{
						'peripheralDeviceSettings.playoutDevices.overrides': { $exists: false },
					},
					{
						'peripheralDeviceSettings.ingestDevices.defaults': { $exists: false },
					},
					{
						'peripheralDeviceSettings.ingestDevices.overrides': { $exists: false },
					},
					{
						'peripheralDeviceSettings.inputDevices.defaults': { $exists: false },
					},
					{
						'peripheralDeviceSettings.inputDevices.overrides': { $exists: false },
					},
				],
			})
			for (const studio of objects) {
				if (!studio.peripheralDeviceSettings) {
					await Studios.updateAsync(studio._id, {
						$set: {
							peripheralDeviceSettings: {
								deviceSettings: wrapDefaultObject({}),
								playoutDevices: wrapDefaultObject({}),
								ingestDevices: wrapDefaultObject({}),
								inputDevices: wrapDefaultObject({}),
							},
						},
					})
				} else {
					const update: any = {}
					if (!studio.peripheralDeviceSettings.playoutDevices.defaults) {
						update['peripheralDeviceSettings.playoutDevices.defaults'] = {}
					}
					if (!studio.peripheralDeviceSettings.playoutDevices.overrides) {
						update['peripheralDeviceSettings.playoutDevices.overrides'] = []
					}
					if (!studio.peripheralDeviceSettings.ingestDevices.defaults) {
						update['peripheralDeviceSettings.ingestDevices.defaults'] = {}
					}
					if (!studio.peripheralDeviceSettings.ingestDevices.overrides) {
						update['peripheralDeviceSettings.ingestDevices.overrides'] = []
					}
					if (!studio.peripheralDeviceSettings.inputDevices.defaults) {
						update['peripheralDeviceSettings.inputDevices.defaults'] = {}
					}
					if (!studio.peripheralDeviceSettings.inputDevices.overrides) {
						update['peripheralDeviceSettings.inputDevices.overrides'] = []
					}

					if (Object.keys(update).length) {
						await Studios.updateAsync(studio._id, {
							$set: update,
						})
					}
				}
			}
		},
	},

	{
		id: `Studio move playout-gateway subdevices`,
		dependOnResultFrom: `Studio ensure peripheralDeviceSettings field`,
		canBeRunAutomatically: true,
		validate: async () => {
			const objectCount = await PeripheralDevices.countDocuments({
				category: PeripheralDeviceCategory.PLAYOUT,
				studioId: { $exists: true },
				'settings.devices': { $exists: true },
			})

			if (objectCount) {
				return `object needs to be updated`
			}
			return false
		},
		migrate: async () => {
			const objects = await PeripheralDevices.findFetchAsync({
				category: PeripheralDeviceCategory.PLAYOUT,
				studioId: { $exists: true },
				'settings.devices': { $exists: true },
			})
			for (const device of objects) {
				// @ts-expect-error removed in 1.52
				const studioId: StudioId = device.studioId
				if (!studioId) continue

				const newOverrides: SomeObjectOverrideOp[] = []

				for (const [id, subDevice] of Object.entries<unknown>((device as any).settings?.['devices'] || {})) {
					newOverrides.push(
						literal<ObjectOverrideSetOp>({
							op: 'set',
							path: id,
							value: literal<StudioPlayoutDevice>({
								peripheralDeviceId: device._id,
								options: subDevice as any,
							}),
						})
					)
				}

				await Studios.updateAsync(studioId, {
					$set: {
						[`peripheralDeviceSettings.playoutDevices.overrides`]: newOverrides,
					},
				})

				await PeripheralDevices.updateAsync(device._id, {
					$unset: {
						'settings.devices': 1,
					},
				})
			}
		},
	},
	{
		id: `Studio move ingest subdevices`,
		dependOnResultFrom: `Studio ensure peripheralDeviceSettings field`,
		canBeRunAutomatically: true,
		validate: async () => {
			const objectCount = await PeripheralDevices.countDocuments({
				category: PeripheralDeviceCategory.INGEST,
				studioId: { $exists: true },
				'settings.devices': { $exists: true },
			})

			if (objectCount) {
				return `object needs to be updated`
			}
			return false
		},
		migrate: async () => {
			const objects = await PeripheralDevices.findFetchAsync({
				category: PeripheralDeviceCategory.INGEST,
				studioId: { $exists: true },
				'settings.devices': { $exists: true },
			})
			for (const device of objects) {
				// @ts-expect-error removed in 1.52
				const studioId: StudioId = device.studioId
				if (!studioId) continue

				const newOverrides: SomeObjectOverrideOp[] = []

				for (const [id, subDevice] of Object.entries<unknown>((device as any).settings?.['devices'] || {})) {
					newOverrides.push(
						literal<ObjectOverrideSetOp>({
							op: 'set',
							path: id,
							value: literal<StudioIngestDevice>({
								peripheralDeviceId: device._id,
								options: subDevice as any,
							}),
						})
					)
				}

				await Studios.updateAsync(studioId, {
					$set: {
						[`peripheralDeviceSettings.ingestDevices.overrides`]: newOverrides,
					},
				})

				await PeripheralDevices.updateAsync(device._id, {
					$unset: {
						'settings.devices': 1,
					},
				})
			}
		},
	},
	{
		id: `Studio move input subdevices`,
		dependOnResultFrom: `Studio ensure peripheralDeviceSettings field`,
		canBeRunAutomatically: true,
		validate: async () => {
			const objectCount = await PeripheralDevices.countDocuments({
				category: PeripheralDeviceCategory.TRIGGER_INPUT,
				studioId: { $exists: true },
				'settings.devices': { $exists: true },
			})

			if (objectCount) {
				return `object needs to be updated`
			}
			return false
		},
		migrate: async () => {
			const objects = await PeripheralDevices.findFetchAsync({
				category: PeripheralDeviceCategory.TRIGGER_INPUT,
				studioId: { $exists: true },
				'settings.devices': { $exists: true },
			})
			for (const device of objects) {
				// @ts-expect-error removed in 1.52
				const studioId: StudioId = device.studioId
				if (!studioId) continue

				const newOverrides: SomeObjectOverrideOp[] = []

				for (const [id, subDevice] of Object.entries<unknown>((device as any).settings?.['devices'] || {})) {
					newOverrides.push(
						literal<ObjectOverrideSetOp>({
							op: 'set',
							path: id,
							value: literal<StudioInputDevice>({
								peripheralDeviceId: device._id,
								options: subDevice as any,
							}),
						})
					)
				}

				await Studios.updateAsync(studioId, {
					$set: {
						[`peripheralDeviceSettings.inputDevices.overrides`]: newOverrides,
					},
				})

				await PeripheralDevices.updateAsync(device._id, {
					$unset: {
						'settings.devices': 1,
					},
				})
			}
		},
	},

	{
		id: `PeripheralDevice cleanup unused properties on child devices`,
		canBeRunAutomatically: true,
		validate: async () => {
			const objectCount = await PeripheralDevices.countDocuments({
				parentDeviceId: { $exists: true },
				// One of:
				configManifest: { $exists: true },
			})

			if (objectCount) {
				return `object needs to be updated`
			}
			return false
		},
		migrate: async () => {
			await PeripheralDevices.updateAsync(
				{ parentDeviceId: { $exists: true } },
				{
					$unset: {
						configManifest: 1,
					},
				},
				{
					multi: true,
				}
			)
		},
	},

	{
		id: `RundownPlaylist move nextPartManual to nextPartInfo.manuallySelected`,
		canBeRunAutomatically: true,
		validate: async () => {
			const objectCount = await RundownPlaylists.countDocuments({
				nextPartManual: { $exists: true },
			})

			if (objectCount) {
				return `object needs to be updated`
			}
			return false
		},
		migrate: async () => {
			const playlists = await RundownPlaylists.findFetchAsync({
				nextPartManual: { $exists: true },
			})

			for (const playlist of playlists) {
				const nextPartManual = !!(playlist as any).nextPartManual
				await RundownPlaylists.mutableCollection.updateAsync(playlist._id, {
					$set: playlist.nextPartInfo
						? {
								'nextPartInfo.manuallySelected': nextPartManual,
							}
						: undefined,
					$unset: {
						nextPartManual: 1,
					},
				})
			}
		},
	},

	{
		id: `PeripheralDevice ensure deviceConfigSchema and subdeviceManifest exists`,
		canBeRunAutomatically: true,
		validate: async () => {
			const objectCount = await PeripheralDevices.countDocuments({
				parentDeviceId: { $exists: false },
				$or: [
					{
						'configManifest.deviceConfigSchema': {
							$exists: false,
						},
					},
					{
						'configManifest.subdeviceManifest': {
							$exists: false,
						},
					},
				],
			})

			if (objectCount) {
				return `object needs to be updated`
			}
			return false
		},
		migrate: async () => {
			await PeripheralDevices.updateAsync(
				{
					parentDeviceId: { $exists: false },
					$or: [
						{
							'configManifest.deviceConfigSchema': {
								$exists: false,
							},
						},
						{
							'configManifest.subdeviceManifest': {
								$exists: false,
							},
						},
					],
				},
				{
					$set: {
						configManifest: {
							deviceConfigSchema: JSONBlobStringify<JSONSchema>({}),
							subdeviceManifest: {},
						},
					},
				},
				{
					multi: true,
				}
			)
		},
	},

	{
		id: `Studio playoutDevices ensure new DeviceType values`,
		canBeRunAutomatically: true,
		dependOnResultFrom: 'Studio move playout-gateway subdevices',
		validate: async () => {
			const studios = await Studios.findFetchAsync({})
			const objectCount = studios.filter(
				(studio) =>
					studio.peripheralDeviceSettings.playoutDevices.overrides.filter(updatePlayoutDeviceTypeInOverride)
						.length
			).length

			if (objectCount) {
				return `object needs to be updated`
			}
			return false
		},
		migrate: async () => {
			const studios = await Studios.findFetchAsync({})
			for (const studio of studios) {
				const newOverrides = studio.peripheralDeviceSettings.playoutDevices.overrides.map(
					(override) => updatePlayoutDeviceTypeInOverride(override) || override
				)

				await Studios.updateAsync(studio._id, {
					$set: {
						[`peripheralDeviceSettings.playoutDevices.overrides`]: newOverrides,
					},
				})
			}
		},
	},

	{
		id: `Studio mappings ensure new DeviceType values`,
		canBeRunAutomatically: true,
		validate: async () => {
			const studios = await Studios.findFetchAsync({})
			const objectCount = studios.filter(
				(studio) => studio.mappingsWithOverrides.overrides.filter(updateMappingDeviceTypeInOverride).length > 0
			).length

			if (objectCount) {
				return `object needs to be updated`
			}
			return false
		},
		migrate: async () => {
			const studios = await Studios.findFetchAsync({})
			for (const studio of studios) {
				const newOverrides = studio.mappingsWithOverrides.overrides.map(
					(override) => updateMappingDeviceTypeInOverride(override) || override
				)

				await Studios.updateAsync(studio._id, {
					$set: {
						[`mappingsWithOverrides.overrides`]: newOverrides,
					},
				})
			}
		},
	},

	{
		id: `Studio.settings.minimumTakeSpan`,
		canBeRunAutomatically: true,
		validate: async () => {
			const count = await Studios.countDocuments({
				'settings.minimumTakeSpan': {
					$exists: false,
				},
			})
			if (count > 0) return `${count} studios need to be updated`
			return false
		},
		migrate: async () => {
			await Studios.updateAsync(
				{
					'settings.minimumTakeSpan': {
						$exists: false,
					},
				},
				{
					$set: {
						'settings.minimumTakeSpan': DEFAULT_MINIMUM_TAKE_SPAN,
					},
				},
				{ multi: true }
			)
		},
	},

	{
		id: `ExpectedPackageDBFromAdLibAction and ExpectedPackageDBFromPiece add partId`,
		canBeRunAutomatically: true,
		validate: async () => {
			const objectCount = await ExpectedPackages.countDocuments({
				fromPieceType: { $in: EXPECTED_PACKAGE_TYPES_ADDED_PART_ID as any }, // Force the types, as the query does not match due to the interfaces
				partId: { $exists: false },
			})

			if (objectCount) {
				return `object needs to be updated`
			}
			return false
		},
		migrate: async () => {
			const objects = await ExpectedPackages.findFetchAsync({
				fromPieceType: { $in: EXPECTED_PACKAGE_TYPES_ADDED_PART_ID as any }, // Force the types, as the query does not match due to the interfaces
				partId: { $exists: false },
			})

			const neededPieceIds: Array<
				PieceId | AdLibActionId | RundownBaselineAdLibActionId | BucketAdLibId | BucketAdLibActionId
			> = _.compact(objects.map((obj) => obj.pieceId))
			const [pieces, adlibPieces, adlibActions] = await Promise.all([
				Pieces.findFetchAsync(
					{
						_id: { $in: neededPieceIds as PieceId[] },
					},
					{
						projection: {
							_id: 1,
							startPartId: 1,
						},
					}
				) as Promise<Pick<Piece, '_id' | 'startPartId'>[]>,
				AdLibPieces.findFetchAsync(
					{
						_id: { $in: neededPieceIds as PieceId[] },
					},
					{
						projection: {
							_id: 1,
							partId: 1,
						},
					}
				) as Promise<Pick<AdLibPiece, '_id' | 'partId'>[]>,
				AdLibActions.findFetchAsync(
					{
						_id: { $in: neededPieceIds as AdLibActionId[] },
					},
					{
						projection: {
							_id: 1,
							partId: 1,
						},
					}
				) as Promise<Pick<AdLibAction, '_id' | 'partId'>[]>,
			])

			const partIdLookup = new Map<
				PieceId | AdLibActionId | RundownBaselineAdLibActionId | BucketAdLibId | BucketAdLibActionId,
				PartId
			>()
			for (const piece of pieces) {
				if (piece.startPartId) partIdLookup.set(piece._id, piece.startPartId)
			}
			for (const adlib of adlibPieces) {
				if (adlib.partId) partIdLookup.set(adlib._id, adlib.partId)
			}
			for (const action of adlibActions) {
				partIdLookup.set(action._id, action.partId)
			}

			for (const expectedPackage of objects) {
				if (!expectedPackage.pieceId) continue

				await ExpectedPackages.mutableCollection.updateAsync(expectedPackage._id, {
					$set: {
						partId: partIdLookup.get(expectedPackage.pieceId) ?? protectString(''),
					},
				})
			}
		},
	},

	{
		id: `Part rename 'expectedDurationWithPreroll' to 'expectedDurationWithTransition'`,
		canBeRunAutomatically: true,
		validate: async () => {
			const objectCount = await Parts.countDocuments({
				expectedDurationWithTransition: { $exists: false },
				expectedDurationWithPreroll: { $exists: true },
			})

			if (objectCount) {
				return `object needs to be updated`
			}
			return false
		},
		migrate: async () => {
			const objects = await Parts.findFetchAsync({
				expectedDurationWithTransition: { $exists: false },
				expectedDurationWithPreroll: { $exists: true },
			})

			for (const part of objects) {
				await Parts.mutableCollection.updateAsync(part._id, {
					$set: {
						expectedDurationWithTransition: (part as any).expectedDurationWithPreroll,
					},
					$unset: {
						expectedDurationWithPreroll: 1,
					},
				})
			}
		},
	},
	{
		id: `PartInstance rename 'part.expectedDurationWithPreroll' to 'part.expectedDurationWithTransition'`,
		canBeRunAutomatically: true,
		validate: async () => {
			const objectCount = await PartInstances.countDocuments({
				'part.expectedDurationWithTransition': { $exists: false },
				'part.expectedDurationWithPreroll': { $exists: true },
			})

			if (objectCount) {
				return `object needs to be updated`
			}
			return false
		},
		migrate: async () => {
			const objects = await PartInstances.findFetchAsync({
				'part.expectedDurationWithTransition': { $exists: false },
				'part.expectedDurationWithPreroll': { $exists: true },
			})

			for (const partInstance of objects) {
				await PartInstances.mutableCollection.updateAsync(partInstance._id, {
					$set: {
						'part.expectedDurationWithTransition': (partInstance.part as any).expectedDurationWithPreroll,
					},
					$unset: {
						'part.expectedDurationWithPreroll': 1,
					},
				})
			}
		},
	},
])

function updatePlayoutDeviceTypeInOverride(op: SomeObjectOverrideOp): ObjectOverrideSetOp | undefined {
	if (op.op !== 'set') return undefined
	if (!op.path.includes('.')) {
		// Root level
		const value = op.value
		if (typeof value.options?.type === 'number') {
			value.options.type =
				oldDeviceTypeToNewMapping[value.options.type as OldDeviceType] ?? TSR.DeviceType.ABSTRACT
			return op
		}
	} else if (op.path.endsWith('.options.type')) {
		// Single property override
		if (typeof op.value === 'number') {
			op.value = oldDeviceTypeToNewMapping[op.value as OldDeviceType] ?? TSR.DeviceType.ABSTRACT
			return op
		}
	}

	return undefined
}

function updateMappingDeviceTypeInOverride(op: SomeObjectOverrideOp): ObjectOverrideSetOp | undefined {
	if (op.op !== 'set') return undefined
	if (!op.path.includes('.')) {
		// Root level
		const value = op.value as Partial<TSR.Mapping<any, any>>
		if (typeof value.device === 'number') {
			value.device = oldDeviceTypeToNewMapping[value.device as OldDeviceType] ?? TSR.DeviceType.ABSTRACT
			return op
		}
	} else if (op.path.endsWith('.device')) {
		// Single property override
		if (typeof op.value === 'number') {
			op.value = oldDeviceTypeToNewMapping[op.value as OldDeviceType] ?? TSR.DeviceType.ABSTRACT
			return op
		}
	}

	return undefined
}
