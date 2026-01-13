import _ from 'underscore'
import {
	PeripheralDevice,
	PeripheralDeviceType,
	PeripheralDeviceCategory,
	PERIPHERAL_SUBTYPE_PROCESS,
	PeripheralDeviceSubType,
} from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'
import { DBStudio } from '@sofie-automation/corelib/dist/dataModel/Studio'
import {
	PieceLifespan,
	IOutputLayer,
	ISourceLayer,
	SourceLayerType,
	StudioBlueprintManifest,
	BlueprintManifestType,
	BlueprintManifestBase,
	ShowStyleBlueprintManifest,
	IShowStyleContext,
	BlueprintResultRundown,
	BlueprintResultSegment,
	IBlueprintAdLibPiece,
	IBlueprintRundown,
	IBlueprintSegment,
	BlueprintResultPart,
	IBlueprintPart,
	IBlueprintPiece,
	TriggerType,
	PlayoutActions,
	StatusCode,
	IBlueprintPieceType,
	IBlueprintActionManifest,
	SofieIngestSegment,
	SofieIngestRundown,
} from '@sofie-automation/blueprints-integration'
import { DBShowStyleBase } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { DBShowStyleVariant } from '@sofie-automation/corelib/dist/dataModel/ShowStyleVariant'
import { Blueprint } from '@sofie-automation/corelib/dist/dataModel/Blueprint'
import { ICoreSystem, SYSTEM_ID } from '@sofie-automation/meteor-lib/dist/collections/CoreSystem'
import { stripVersion } from '../../server/systemStatus/semverUtils'
import { internalUploadBlueprint } from '../../server/api/blueprints/api'
import { literal, getRandomId, getRandomString, Complete, normalizeArray } from '@sofie-automation/corelib/dist/lib'
import { protectString, unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { EmptyPieceTimelineObjectsBlob, Piece } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { RundownBaselineAdLibItem } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineAdLibPiece'
import { AdLibPiece } from '@sofie-automation/corelib/dist/dataModel/AdLibPiece'
import { restartRandomId } from '../random'
import { MongoMock } from '../mongo'
import { defaultRundownPlaylist, defaultStudio } from '../defaultCollectionObjects'
import { PackageInfo } from '../../server/coreSystem'
import { DBTriggeredActions } from '@sofie-automation/meteor-lib/dist/collections/TriggeredActions'
import { WorkerStatus } from '@sofie-automation/meteor-lib/dist/collections/Workers'
import { WorkerThreadStatus } from '@sofie-automation/corelib/dist/dataModel/WorkerThreads'
import {
	applyAndValidateOverrides,
	wrapDefaultObject,
} from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { UIShowStyleBase } from '@sofie-automation/meteor-lib/dist/api/showStyles'
import {
	BlueprintId,
	RundownId,
	RundownPlaylistId,
	ShowStyleBaseId,
	ShowStyleVariantId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import {
	AdLibPieces,
	CoreSystem,
	Parts,
	PeripheralDevices,
	Pieces,
	RundownBaselineAdLibPieces,
	RundownPlaylists,
	Rundowns,
	Segments,
	ShowStyleBases,
	ShowStyleVariants,
	Studios,
	TriggeredActions,
	Workers,
	WorkerThreadStatuses,
} from '../../server/collections'
import { TSR_VERSION } from '@sofie-automation/shared-lib/dist/tsr'
import { JSONBlobStringify } from '@sofie-automation/shared-lib/dist/lib/JSONBlob'

export enum LAYER_IDS {
	SOURCE_CAM0 = 'cam0',
	SOURCE_VT0 = 'vt0',
	SOURCE_TRANSITION0 = 'transition0',
	SOURCE_GRAPHICS0 = 'graphics0',
	OUTPUT_PGM = 'pgm',
}

function getBlueprintDependencyVersions(): { TSR_VERSION: string; INTEGRATION_VERSION: string } {
	const INTEGRATION_VERSION =
		require('../../node_modules/@sofie-automation/blueprints-integration/package.json').version

	return {
		INTEGRATION_VERSION,
		TSR_VERSION,
	}
}

let dbI = 0
export async function setupMockPeripheralDevice(
	category: PeripheralDeviceCategory,
	type: PeripheralDeviceType,
	subType: PeripheralDeviceSubType,
	studio?: Pick<DBStudio, '_id'>,
	doc?: Partial<PeripheralDevice>
): Promise<PeripheralDevice> {
	doc = doc || {}

	const defaultDevice: PeripheralDevice = {
		_id: protectString('mockDevice' + dbI++),
		name: 'mockDevice',
		studioAndConfigId: studio ? { studioId: studio._id, configId: 'test' } : undefined,

		category: category,
		type: type,
		subType: subType,
		deviceName: `Mock ${type} Gateway`,

		created: 1234,
		status: {
			statusCode: StatusCode.GOOD,
		},
		lastSeen: 1234,
		lastConnected: 1234,
		connected: true,
		connectionId: 'myConnectionId',
		token: 'mockToken',
		configManifest: {
			deviceConfigSchema: JSONBlobStringify({}),
			subdeviceManifest: {},
		},
		versions: {
			'@sofie-automation/server-core-integration': stripVersion(PackageInfo.version),
		},
	}
	const device: PeripheralDevice = _.extend(defaultDevice, doc)
	await PeripheralDevices.insertAsync(device)
	return device
}
export async function setupMockCore(doc?: Partial<ICoreSystem>): Promise<ICoreSystem> {
	// Reset everything mongo, to keep the ids predictable
	restartRandomId()
	MongoMock.deleteAllData()

	doc = doc || {}

	const defaultCore: ICoreSystem = {
		_id: SYSTEM_ID,
		name: 'mock Core',
		created: 0,
		modified: 0,
		version: '0.0.0',
		previousVersion: '0.0.0',
		serviceMessages: {},
		settingsWithOverrides: wrapDefaultObject({
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
		}),
		lastBlueprintConfig: undefined,
	}
	const coreSystem = _.extend(defaultCore, doc)
	await CoreSystem.removeAsync(SYSTEM_ID)
	await CoreSystem.insertAsync(coreSystem)
	return coreSystem
}
export async function setupMockTriggeredActions(
	showStyleBaseId: ShowStyleBaseId | null = null,
	num = 3,
	doc?: Partial<DBTriggeredActions>
): Promise<DBTriggeredActions[]> {
	doc = doc || {}
	const mocks: DBTriggeredActions[] = []
	for (let i = 0; i < num; i++) {
		const mock: DBTriggeredActions = {
			_id: protectString(`mockTriggeredAction_${showStyleBaseId ?? 'core'}` + i),
			_rank: i * 1000,
			showStyleBaseId,
			blueprintUniqueId: null,
			actionsWithOverrides: wrapDefaultObject({
				'0': {
					action: PlayoutActions.adlib,
					filterChain: [
						{
							object: 'adLib',
							field: 'global',
							value: true,
						},
						{
							object: 'adLib',
							field: 'pick',
							value: i,
						},
					],
				},
			}),
			triggersWithOverrides: wrapDefaultObject({
				'0': {
					type: TriggerType.hotkey,
					keys: `Key${String.fromCharCode(65 + i)}`, // KeyA and so on
				},
			}),
			...doc,
		}
		mocks.push(mock)
		await TriggeredActions.insertAsync(mock)
	}
	return mocks
}
export async function setupMockStudio(doc?: Partial<DBStudio>): Promise<DBStudio> {
	doc = doc || {}

	const studio: DBStudio = {
		...defaultStudio(protectString('mockStudio' + dbI++)),
		name: 'mockStudio',
		_rundownVersionHash: 'asdf',
		...doc,
	}
	await Studios.insertAsync(studio)
	return studio
}
export async function setupMockShowStyleBase(
	blueprintId: BlueprintId,
	doc?: Partial<DBShowStyleBase>
): Promise<DBShowStyleBase> {
	doc = doc || {}

	const defaultShowStyleBase: DBShowStyleBase = {
		_id: protectString('mockShowStyleBase' + dbI++),
		name: 'mockShowStyleBase',
		outputLayersWithOverrides: wrapDefaultObject(
			normalizeArray(
				[
					literal<IOutputLayer>({
						_id: LAYER_IDS.OUTPUT_PGM,
						_rank: 0,
						isPGM: true,
						name: 'PGM',
					}),
				],
				'_id'
			)
		),
		sourceLayersWithOverrides: wrapDefaultObject(
			normalizeArray(
				[
					literal<ISourceLayer>({
						_id: LAYER_IDS.SOURCE_CAM0,
						_rank: 0,
						name: 'Camera',
						type: SourceLayerType.CAMERA,
						exclusiveGroup: 'main',
					}),
					literal<ISourceLayer>({
						_id: LAYER_IDS.SOURCE_VT0,
						_rank: 1,
						name: 'VT',
						type: SourceLayerType.VT,
						exclusiveGroup: 'main',
					}),
					literal<ISourceLayer>({
						_id: LAYER_IDS.SOURCE_TRANSITION0,
						_rank: 2,
						name: 'Transition',
						type: SourceLayerType.TRANSITION,
					}),
					literal<ISourceLayer>({
						_id: LAYER_IDS.SOURCE_GRAPHICS0,
						_rank: 3,
						name: 'Graphic',
						type: SourceLayerType.GRAPHICS,
					}),
				],
				'_id'
			)
		),
		blueprintConfigWithOverrides: wrapDefaultObject({}),
		blueprintId: blueprintId,
		// hotkeyLegend?: Array<HotkeyDefinition>
		_rundownVersionHash: '',
		lastBlueprintConfig: undefined,
		lastBlueprintFixUpHash: undefined,
	}
	const showStyleBase = _.extend(defaultShowStyleBase, doc)
	await ShowStyleBases.insertAsync(showStyleBase)
	return showStyleBase
}
export async function setupMockShowStyleVariant(
	showStyleBaseId: ShowStyleBaseId,
	doc?: Partial<DBShowStyleVariant>
): Promise<DBShowStyleVariant> {
	doc = doc || {}

	const defaultShowStyleVariant: DBShowStyleVariant = {
		_id: protectString('mockShowStyleVariant' + dbI++),
		name: 'mockShowStyleVariant',
		showStyleBaseId: showStyleBaseId,
		blueprintConfigWithOverrides: wrapDefaultObject({}),
		_rundownVersionHash: '',
		_rank: 0,
	}
	const showStyleVariant = _.extend(defaultShowStyleVariant, doc)
	await ShowStyleVariants.insertAsync(showStyleVariant)

	return showStyleVariant
}

export function packageBlueprint<T extends BlueprintManifestBase>(
	constants: { [constant: string]: string | number },
	blueprintFcn: () => T
): string {
	let code = blueprintFcn.toString()
	_.each(constants, (newConstant, constant) => {
		if (_.isString(newConstant)) {
			newConstant = newConstant.replace(/^\^/, '') || '0.0.0' // fix the version, the same way the bleprint does it
			newConstant = `'${newConstant}'`
		} else {
			newConstant = `${newConstant}`
		}

		code = code.replace(new RegExp(constant, 'g'), newConstant)
	})
	return `({default: (${code})()})`
}
export async function setupMockStudioBlueprint(showStyleBaseId: ShowStyleBaseId): Promise<Blueprint> {
	const { INTEGRATION_VERSION, TSR_VERSION } = getBlueprintDependencyVersions()

	const BLUEPRINT_TYPE = BlueprintManifestType.STUDIO
	const SHOW_STYLE_ID: string = unprotectString(showStyleBaseId)

	const code = packageBlueprint<StudioBlueprintManifest>(
		{
			// Constants to into code:
			BLUEPRINT_TYPE,
			INTEGRATION_VERSION,
			TSR_VERSION,
			SHOW_STYLE_ID,
		},
		function (): StudioBlueprintManifest {
			return {
				blueprintType: BLUEPRINT_TYPE,
				blueprintVersion: '0.0.0',
				integrationVersion: INTEGRATION_VERSION,
				TSRVersion: TSR_VERSION,

				configPresets: {
					main: {
						name: 'Main',
						config: {},
					},
				},

				studioConfigSchema: '{}' as any,
				getBaseline: () => {
					return {
						timelineObjects: [],
					}
				},
				getShowStyleId: (): string | null => {
					return SHOW_STYLE_ID
				},
			}
		}
	)

	const blueprintId: BlueprintId = protectString('mockBlueprint' + dbI++)
	const blueprintName = 'mockBlueprint'

	return internalUploadBlueprint(blueprintId, code, {
		blueprintName,
		ignoreIdChange: true,
	})
}
export async function setupMockShowStyleBlueprint(showStyleVariantId: ShowStyleVariantId): Promise<Blueprint> {
	const { INTEGRATION_VERSION, TSR_VERSION } = getBlueprintDependencyVersions()

	const BLUEPRINT_TYPE = BlueprintManifestType.SHOWSTYLE
	const SHOW_STYLE_VARIANT_ID: string = unprotectString(showStyleVariantId)

	const code = packageBlueprint<ShowStyleBlueprintManifest>(
		{
			// Constants to into code:
			BLUEPRINT_TYPE,
			INTEGRATION_VERSION,
			TSR_VERSION,
			SHOW_STYLE_VARIANT_ID,
		},
		function (): ShowStyleBlueprintManifest {
			return {
				blueprintType: BLUEPRINT_TYPE,
				blueprintVersion: '0.0.0',
				integrationVersion: INTEGRATION_VERSION,
				TSRVersion: TSR_VERSION,

				configPresets: {
					main: {
						name: 'Main',
						config: {},

						variants: {
							main: {
								name: 'Default',
								config: {},
							},
						},
					},
				},

				showStyleConfigSchema: '{}' as any,
				getShowStyleVariantId: (): string | null => {
					return SHOW_STYLE_VARIANT_ID
				},
				getRundown: (
					_context: IShowStyleContext,
					ingestRundown: SofieIngestRundown<any, any, any>
				): BlueprintResultRundown => {
					const rundown: IBlueprintRundown = {
						externalId: ingestRundown.externalId,
						name: ingestRundown.name,
						// expectedStart?:
						// expectedDuration?: number;
						privateData: ingestRundown.payload,
						timing: {
							type: 'none' as any,
						},
					}

					// Allow the rundown to specify a playlistExternalId that should be used
					const playlistId = ingestRundown.payload?.ForcePlaylistExternalId
					if (playlistId) rundown.playlistExternalId = playlistId

					return {
						rundown,
						globalAdLibPieces: [],
						globalActions: [],
						globalPieces: [],
						baseline: { timelineObjects: [] },
					}
				},
				getSegment: (
					_context: unknown,
					ingestSegment: SofieIngestSegment<any, any>
				): BlueprintResultSegment => {
					const segment: IBlueprintSegment = {
						name: ingestSegment.name ? ingestSegment.name : ingestSegment.externalId,
						privateData: ingestSegment.payload,
						isHidden: ingestSegment.payload?.hidden,
					}
					const parts: BlueprintResultPart[] = []

					_.each(ingestSegment.parts, (ingestPart) => {
						const part: IBlueprintPart = {
							externalId: ingestPart.externalId,
							title: ingestPart.name,
							privateData: ingestPart.payload,
							// autoNext?: boolean;
							// autoNextOverlap?: number;
							// prerollDuration?: number;
							// transitionPrerollDuration?: number | null;
							// transitionKeepaliveDuration?: number | null;
							// transitionDuration?: number | null;
							// disableOutTransition?: boolean;
							// expectedDuration?: number;
							// holdMode?: PartHoldMode;
							// updateStoryStatus?: boolean;
							// classes?: string[];
							// classesForNext?: string[];
							// displayDurationGroup?: string;
							// displayDuration?: number;
							// invalid?: boolean
						}
						const pieces: IBlueprintPiece[] = ingestPart.payload?.pieces ?? []
						const adLibPieces: IBlueprintAdLibPiece[] = []
						const actions: IBlueprintActionManifest[] = []
						parts.push({
							part,
							pieces,
							adLibPieces,
							actions,
						})
					})
					return {
						segment,
						parts,
					}
				},
				// onRundownActivate?: (context: EventContext & RundownContext) => Promise<void>,
				// onRundownFirstTake?: (context: EventContext & PartEventContext) => Promise<void>,
				// onRundownDeActivate?: (context: EventContext & RundownContext) => Promise<void>,
				// onPreTake?: (context: EventContext & PartEventContext) => Promise<void>,
				// onPostTake?: (context: EventContext & PartEventContext) => Promise<void>,
				// onTimelineGenerate?: (context: EventContext & RundownContext, timeline: Timeline.TimelineObject[]) => Promise<Timeline.TimelineObject[]>,
				// onAsRunEvent?: (context: EventContext & AsRunEventContext) => Promise<IBlueprintExternalMessageQueueObj[]>,
			}
		}
	)

	const blueprintId: BlueprintId = protectString('mockBlueprint' + dbI++)
	const blueprintName = 'mockBlueprint'

	return internalUploadBlueprint(blueprintId, code, {
		blueprintName,
		ignoreIdChange: true,
	})
}
export interface DefaultEnvironment {
	showStyleBaseId: ShowStyleBaseId
	showStyleVariantId: ShowStyleVariantId
	studioBlueprint: Blueprint
	showStyleBlueprint: Blueprint
	showStyleBase: DBShowStyleBase
	triggeredActions: DBTriggeredActions[]
	showStyleVariant: DBShowStyleVariant
	studio: DBStudio
	core: ICoreSystem
	systemTriggeredActions: DBTriggeredActions[]

	workers: WorkerStatus[]
	workerThreadStatuses: WorkerThreadStatus[]

	ingestDevice: PeripheralDevice
}
export async function setupDefaultStudioEnvironment(): Promise<DefaultEnvironment> {
	const core = await setupMockCore({})
	const systemTriggeredActions = await setupMockTriggeredActions()

	const showStyleBaseId: ShowStyleBaseId = getRandomId()
	const showStyleVariantId: ShowStyleVariantId = getRandomId()

	const studioBlueprint = await setupMockStudioBlueprint(showStyleBaseId)
	const showStyleBlueprint = await setupMockShowStyleBlueprint(showStyleVariantId)

	const showStyleBase = await setupMockShowStyleBase(showStyleBlueprint._id, {
		_id: showStyleBaseId,
	})
	const triggeredActions = await setupMockTriggeredActions(showStyleBase._id)
	const showStyleVariant = await setupMockShowStyleVariant(showStyleBase._id, { _id: showStyleVariantId })

	const studio = await setupMockStudio({
		blueprintId: studioBlueprint._id,
		supportedShowStyleBase: [showStyleBaseId],
	})
	const ingestDevice = await setupMockPeripheralDevice(
		PeripheralDeviceCategory.INGEST,
		PeripheralDeviceType.MOS,
		PERIPHERAL_SUBTYPE_PROCESS,
		studio
	)
	const { worker, workerThreadStatuses } = await setupMockWorker()

	return {
		showStyleBaseId,
		showStyleVariantId,
		studioBlueprint,
		showStyleBlueprint,
		showStyleBase,
		triggeredActions,
		showStyleVariant,
		studio,
		core,
		systemTriggeredActions: systemTriggeredActions,
		ingestDevice,
		workers: [worker],
		workerThreadStatuses,
	}
}
export async function setupDefaultRundownPlaylist(
	env: DefaultEnvironment,
	rundownId0?: RundownId,
	customRundownFactory?: (env: DefaultEnvironment, playlistId: RundownPlaylistId, rundownId: RundownId) => RundownId
): Promise<{ rundownId: RundownId; playlistId: RundownPlaylistId }> {
	const rundownId: RundownId = rundownId0 || getRandomId()

	const playlist: DBRundownPlaylist = defaultRundownPlaylist(protectString('playlist_' + rundownId), env.studio._id)

	const playlistId = await RundownPlaylists.mutableCollection.insertAsync(playlist)

	return {
		rundownId: await (customRundownFactory || setupDefaultRundown)(env, playlistId, rundownId),
		playlistId,
	}
}
export async function setupEmptyEnvironment(): Promise<{ core: ICoreSystem }> {
	const core = await setupMockCore({})

	return {
		core,
	}
}
export async function setupDefaultRundown(
	env: DefaultEnvironment,
	playlistId: RundownPlaylistId,
	rundownId: RundownId
): Promise<RundownId> {
	const outputLayerIds = Object.keys(applyAndValidateOverrides(env.showStyleBase.outputLayersWithOverrides).obj)
	const sourceLayerIds = Object.keys(applyAndValidateOverrides(env.showStyleBase.sourceLayersWithOverrides).obj)

	const rundown: DBRundown = {
		studioId: env.studio._id,
		showStyleBaseId: env.showStyleBase._id,
		showStyleVariantId: env.showStyleVariant._id,
		timing: {
			type: 'none' as any,
		},

		playlistId: playlistId,

		_id: rundownId,
		externalId: 'MOCK_RUNDOWN_' + rundownId,
		name: 'Default Rundown',

		created: Date.now(),
		modified: Date.now(),
		importVersions: {
			studio: '',
			showStyleBase: '',
			showStyleVariant: '',
			blueprint: '',
			core: '',
		},

		source: {
			type: 'nrcs',
			peripheralDeviceId: env.ingestDevice._id,
			nrcsName: 'mock',
		},
	}
	await Rundowns.mutableCollection.insertAsync(rundown)

	await RundownPlaylists.mutableCollection.updateAsync(playlistId, {
		$push: {
			rundownIdsInOrder: rundown._id,
		},
	})

	const segment0: DBSegment = {
		_id: protectString(rundownId + '_segment0'),
		_rank: 0,
		externalId: 'MOCK_SEGMENT_0',
		rundownId: rundown._id,
		name: 'Segment 0',
	}
	await Segments.mutableCollection.insertAsync(segment0)
	/* tslint:disable:ter-indent*/
	//
	const part00: DBPart = {
		_id: protectString(rundownId + '_part0_0'),
		segmentId: segment0._id,
		rundownId: rundown._id,
		_rank: 0,
		externalId: 'MOCK_PART_0_0',
		title: 'Part 0 0',
		expectedDurationWithTransition: undefined,
	}
	await Parts.mutableCollection.insertAsync(part00)

	const piece000: Piece = {
		_id: protectString(rundownId + '_piece000'),
		externalId: 'MOCK_PIECE_000',
		startRundownId: rundown._id,
		startSegmentId: part00.segmentId,
		startPartId: part00._id,
		name: 'Piece 000',
		enable: {
			start: 0,
		},
		sourceLayerId: sourceLayerIds[0],
		outputLayerId: outputLayerIds[0],
		lifespan: PieceLifespan.WithinPart,
		pieceType: IBlueprintPieceType.Normal,
		invalid: false,
		content: {},
		timelineObjectsString: EmptyPieceTimelineObjectsBlob,
	}
	await Pieces.mutableCollection.insertAsync(piece000)

	const piece001: Piece = {
		_id: protectString(rundownId + '_piece001'),
		externalId: 'MOCK_PIECE_001',
		startRundownId: rundown._id,
		startSegmentId: part00.segmentId,
		startPartId: part00._id,
		name: 'Piece 001',
		enable: {
			start: 0,
		},
		sourceLayerId: sourceLayerIds[1],
		outputLayerId: outputLayerIds[0],
		lifespan: PieceLifespan.WithinPart,
		pieceType: IBlueprintPieceType.Normal,
		invalid: false,
		content: {},
		timelineObjectsString: EmptyPieceTimelineObjectsBlob,
	}
	await Pieces.mutableCollection.insertAsync(piece001)

	const adLibPiece000: AdLibPiece = {
		_id: protectString(rundownId + '_adLib000'),
		_rank: 0,
		expectedDuration: 1000,
		lifespan: PieceLifespan.WithinPart,
		externalId: 'MOCK_ADLIB_000',
		partId: part00._id,
		rundownId: segment0.rundownId,
		name: 'AdLib 0',
		sourceLayerId: sourceLayerIds[1],
		outputLayerId: outputLayerIds[0],
		content: {},
		timelineObjectsString: EmptyPieceTimelineObjectsBlob,
	}

	await AdLibPieces.mutableCollection.insertAsync(adLibPiece000)

	const part01: DBPart = {
		_id: protectString(rundownId + '_part0_1'),
		segmentId: segment0._id,
		rundownId: segment0.rundownId,
		_rank: 1,
		externalId: 'MOCK_PART_0_1',
		title: 'Part 0 1',
		expectedDurationWithTransition: undefined,
	}
	await Parts.mutableCollection.insertAsync(part01)

	const piece010: Piece = {
		_id: protectString(rundownId + '_piece010'),
		externalId: 'MOCK_PIECE_010',
		startRundownId: rundown._id,
		startSegmentId: part01.segmentId,
		startPartId: part01._id,
		name: 'Piece 010',
		enable: {
			start: 0,
		},
		sourceLayerId: sourceLayerIds[0],
		outputLayerId: outputLayerIds[0],
		lifespan: PieceLifespan.WithinPart,
		pieceType: IBlueprintPieceType.Normal,
		invalid: false,
		content: {},
		timelineObjectsString: EmptyPieceTimelineObjectsBlob,
	}
	await Pieces.mutableCollection.insertAsync(piece010)

	const segment1: DBSegment = {
		_id: protectString(rundownId + '_segment1'),
		_rank: 1,
		externalId: 'MOCK_SEGMENT_2',
		rundownId: rundown._id,
		name: 'Segment 1',
	}
	await Segments.mutableCollection.insertAsync(segment1)

	const part10: DBPart = {
		_id: protectString(rundownId + '_part1_0'),
		segmentId: segment1._id,
		rundownId: segment1.rundownId,
		_rank: 0,
		externalId: 'MOCK_PART_1_0',
		title: 'Part 1 0',
		expectedDurationWithTransition: undefined,
	}
	await Parts.mutableCollection.insertAsync(part10)

	const part11: DBPart = {
		_id: protectString(rundownId + '_part1_1'),
		segmentId: segment1._id,
		rundownId: segment1.rundownId,
		_rank: 1,
		externalId: 'MOCK_PART_1_1',
		title: 'Part 1 1',
		expectedDurationWithTransition: undefined,
	}
	await Parts.mutableCollection.insertAsync(part11)

	const part12: DBPart = {
		_id: protectString(rundownId + '_part1_2'),
		segmentId: segment1._id,
		rundownId: segment1.rundownId,
		_rank: 2,
		externalId: 'MOCK_PART_1_2',
		title: 'Part 1 2',
		expectedDurationWithTransition: undefined,
	}
	await Parts.mutableCollection.insertAsync(part12)

	const segment2: DBSegment = {
		_id: protectString(rundownId + '_segment2'),
		_rank: 2,
		externalId: 'MOCK_SEGMENT_2',
		rundownId: rundown._id,
		name: 'Segment 2',
	}
	await Segments.mutableCollection.insertAsync(segment2)

	const globalAdLib0: RundownBaselineAdLibItem = {
		_id: protectString(rundownId + '_globalAdLib0'),
		_rank: 0,
		externalId: 'MOCK_GLOBAL_ADLIB_0',
		lifespan: PieceLifespan.OutOnRundownEnd,
		rundownId: segment0.rundownId,
		name: 'Global AdLib 0',
		sourceLayerId: sourceLayerIds[0],
		outputLayerId: outputLayerIds[0],
		content: {},
		timelineObjectsString: EmptyPieceTimelineObjectsBlob,
	}

	const globalAdLib1: RundownBaselineAdLibItem = {
		_id: protectString(rundownId + '_globalAdLib1'),
		_rank: 0,
		externalId: 'MOCK_GLOBAL_ADLIB_1',
		lifespan: PieceLifespan.OutOnRundownEnd,
		rundownId: segment0.rundownId,
		name: 'Global AdLib 1',
		sourceLayerId: sourceLayerIds[1],
		outputLayerId: outputLayerIds[0],
		content: {},
		timelineObjectsString: EmptyPieceTimelineObjectsBlob,
	}

	await RundownBaselineAdLibPieces.mutableCollection.insertAsync(globalAdLib0)
	await RundownBaselineAdLibPieces.mutableCollection.insertAsync(globalAdLib1)

	return rundownId
}

export async function setupMockWorker(doc?: Partial<WorkerStatus>): Promise<{
	worker: WorkerStatus
	workerThreadStatuses: WorkerThreadStatus[]
}> {
	doc = doc || {}

	const worker: WorkerStatus = {
		_id: getRandomId(),
		name: 'Mock Worker',
		instanceId: getRandomString(),
		createdTime: Date.now(),
		startTime: Date.now(),
		lastUpdatedTime: Date.now(),
		connected: true,
		status: 'OK',

		...doc,
	}
	await Workers.insertAsync(worker)

	const workerThreadStatus0: WorkerThreadStatus = {
		_id: getRandomId(),
		workerId: worker._id,
		instanceId: getRandomString(),
		name: 'thread 0',
		statusCode: StatusCode.GOOD,
		reason: 'OK',
	}
	await WorkerThreadStatuses.insertAsync(workerThreadStatus0)
	const workerThreadStatus1: WorkerThreadStatus = {
		_id: getRandomId(),
		workerId: worker._id,
		instanceId: getRandomString(),
		name: 'thread 1',
		statusCode: StatusCode.GOOD,
		reason: 'OK',
	}
	await WorkerThreadStatuses.insertAsync(workerThreadStatus1)

	return { worker, workerThreadStatuses: [workerThreadStatus0, workerThreadStatus1] }
}

// const studioBlueprint
// const showStyleBlueprint
// const showStyleVariant

export function convertToUIShowStyleBase(showStyleBase: DBShowStyleBase): UIShowStyleBase {
	return literal<Complete<UIShowStyleBase>>({
		_id: showStyleBase._id,
		name: showStyleBase.name,
		hotkeyLegend: showStyleBase.hotkeyLegend,
		sourceLayers: applyAndValidateOverrides(showStyleBase.sourceLayersWithOverrides).obj,
		outputLayers: applyAndValidateOverrides(showStyleBase.outputLayersWithOverrides).obj,
	})
}
