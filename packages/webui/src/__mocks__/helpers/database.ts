import _ from 'underscore'
import { DBStudio } from '@sofie-automation/corelib/dist/dataModel/Studio'
import {
	PieceLifespan,
	IOutputLayer,
	ISourceLayer,
	SourceLayerType,
	IBlueprintPieceType,
} from '@sofie-automation/blueprints-integration'
import { DBShowStyleBase } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { DBShowStyleVariant } from '@sofie-automation/corelib/dist/dataModel/ShowStyleVariant'
import { ICoreSystem, SYSTEM_ID } from '@sofie-automation/meteor-lib/dist/collections/CoreSystem'
import { literal, getRandomId, Complete, normalizeArray } from '@sofie-automation/corelib/dist/lib'
import { protectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { EmptyPieceTimelineObjectsBlob, Piece } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { RundownBaselineAdLibItem } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineAdLibPiece'
import { AdLibPiece } from '@sofie-automation/corelib/dist/dataModel/AdLibPiece'
import { restartRandomId } from '../random.js'
import { MongoMock } from '../mongo.js'
import { defaultRundownPlaylist, defaultStudio } from '../defaultCollectionObjects.js'
import {
	applyAndValidateOverrides,
	wrapDefaultObject,
} from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { UIShowStyleBase } from '@sofie-automation/meteor-lib/dist/api/showStyles'
import { UIStudio } from '@sofie-automation/meteor-lib/dist/api/studios'
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
	Pieces,
	RundownBaselineAdLibPieces,
	RundownPlaylists,
	Rundowns,
	Segments,
	ShowStyleBases,
	ShowStyleVariants,
	Studios,
} from '../../client/collections/index.js'

export enum LAYER_IDS {
	SOURCE_CAM0 = 'cam0',
	SOURCE_VT0 = 'vt0',
	SOURCE_TRANSITION0 = 'transition0',
	SOURCE_GRAPHICS0 = 'graphics0',
	OUTPUT_PGM = 'pgm',
}

let dbI = 0
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
	CoreSystem.remove(SYSTEM_ID)
	CoreSystem.insert(coreSystem)
	return coreSystem
}
// export async function setupMockTriggeredActions(
// 	showStyleBaseId: ShowStyleBaseId | null = null,
// 	num = 3,
// 	doc?: Partial<DBTriggeredActions>
// ): Promise<DBTriggeredActions[]> {
// 	doc = doc || {}
// 	const mocks: DBTriggeredActions[] = []
// 	for (let i = 0; i < num; i++) {
// 		const mock: DBTriggeredActions = {
// 			_id: protectString(`mockTriggeredAction_${showStyleBaseId ?? 'core'}` + i),
// 			_rank: i * 1000,
// 			showStyleBaseId,
// 			blueprintUniqueId: null,
// 			actionsWithOverrides: wrapDefaultObject({
// 				'0': {
// 					action: PlayoutActions.adlib,
// 					filterChain: [
// 						{
// 							object: 'adLib',
// 							field: 'global',
// 							value: true,
// 						},
// 						{
// 							object: 'adLib',
// 							field: 'pick',
// 							value: i,
// 						},
// 					],
// 				},
// 			}),
// 			triggersWithOverrides: wrapDefaultObject({
// 				'0': {
// 					type: TriggerType.hotkey,
// 					keys: `Key${String.fromCharCode(65 + i)}`, // KeyA and so on
// 				},
// 			}),
// 			...doc,
// 		}
// 		mocks.push(mock)
// 		 TriggeredActions.insert(mock)
// 	}
// 	return mocks
// }
export async function setupMockStudio(doc?: Partial<DBStudio>): Promise<DBStudio> {
	doc = doc || {}

	const studio: DBStudio = {
		...defaultStudio(protectString('mockStudio' + dbI++)),
		name: 'mockStudio',
		_rundownVersionHash: 'asdf',
		...doc,
	}
	Studios.insert(studio)
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
		abChannelDisplay: undefined,
		_rundownVersionHash: '',
		lastBlueprintConfig: undefined,
		lastBlueprintFixUpHash: undefined,
	}
	const showStyleBase = _.extend(defaultShowStyleBase, doc)
	ShowStyleBases.insert(showStyleBase)
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
	ShowStyleVariants.insert(showStyleVariant)

	return showStyleVariant
}

export interface DefaultEnvironment {
	showStyleBaseId: ShowStyleBaseId
	showStyleVariantId: ShowStyleVariantId
	// studioBlueprint: Blueprint
	// showStyleBlueprint: Blueprint
	showStyleBase: DBShowStyleBase
	// triggeredActions: DBTriggeredActions[]
	showStyleVariant: DBShowStyleVariant
	studio: DBStudio
	core: ICoreSystem
	// systemTriggeredActions: DBTriggeredActions[]
}
export async function setupDefaultStudioEnvironment(): Promise<DefaultEnvironment> {
	const core = await setupMockCore({})
	// const systemTriggeredActions = await setupMockTriggeredActions()

	const showStyleBaseId: ShowStyleBaseId = getRandomId()
	const showStyleVariantId: ShowStyleVariantId = getRandomId()

	const showStyleBase = await setupMockShowStyleBase(protectString('blueprint0'), {
		_id: showStyleBaseId,
	})
	// const triggeredActions = await setupMockTriggeredActions(showStyleBase._id)
	const showStyleVariant = await setupMockShowStyleVariant(showStyleBase._id, { _id: showStyleVariantId })

	const studio = await setupMockStudio({
		blueprintId: protectString('blueprint0'),
		supportedShowStyleBase: [showStyleBaseId],
	})

	return {
		showStyleBaseId,
		showStyleVariantId,
		showStyleBase,
		// triggeredActions,
		showStyleVariant,
		studio,
		core,
		// systemTriggeredActions: systemTriggeredActions,
	}
}
export async function setupDefaultRundownPlaylist(
	env: DefaultEnvironment,
	rundownId0?: RundownId,
	customRundownFactory?: (env: DefaultEnvironment, playlistId: RundownPlaylistId, rundownId: RundownId) => RundownId
): Promise<{ rundownId: RundownId; playlistId: RundownPlaylistId }> {
	const rundownId: RundownId = rundownId0 || getRandomId()

	const playlist: DBRundownPlaylist = defaultRundownPlaylist(protectString('playlist_' + rundownId), env.studio._id)

	const playlistId: RundownPlaylistId = protectString(
		MongoMock.getInnerMockCollection(RundownPlaylists).insert(playlist)
	)

	return {
		rundownId: await (customRundownFactory || setupDefaultRundown)(env, playlistId, rundownId),
		playlistId,
	}
}
// export async function setupEmptyEnvironment(): Promise<{ core: ICoreSystem }> {
// 	const core = await setupMockCore({})

// 	return {
// 		core,
// 	}
// }
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
			peripheralDeviceId: protectString('ingest0'),
			nrcsName: 'mock',
		},
	}
	MongoMock.getInnerMockCollection(Rundowns).insert(rundown)

	MongoMock.getInnerMockCollection(RundownPlaylists).update(playlistId, {
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
	MongoMock.getInnerMockCollection(Segments).insert(segment0)
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
	MongoMock.getInnerMockCollection(Parts).insert(part00)

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
	MongoMock.getInnerMockCollection(Pieces).insert(piece000)

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
	MongoMock.getInnerMockCollection(Pieces).insert(piece001)

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

	MongoMock.getInnerMockCollection(AdLibPieces).insert(adLibPiece000)

	const part01: DBPart = {
		_id: protectString(rundownId + '_part0_1'),
		segmentId: segment0._id,
		rundownId: segment0.rundownId,
		_rank: 1,
		externalId: 'MOCK_PART_0_1',
		title: 'Part 0 1',
		expectedDurationWithTransition: undefined,
	}
	MongoMock.getInnerMockCollection(Parts).insert(part01)

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
	MongoMock.getInnerMockCollection(Pieces).insert(piece010)

	const segment1: DBSegment = {
		_id: protectString(rundownId + '_segment1'),
		_rank: 1,
		externalId: 'MOCK_SEGMENT_2',
		rundownId: rundown._id,
		name: 'Segment 1',
	}
	MongoMock.getInnerMockCollection(Segments).insert(segment1)

	const part10: DBPart = {
		_id: protectString(rundownId + '_part1_0'),
		segmentId: segment1._id,
		rundownId: segment1.rundownId,
		_rank: 0,
		externalId: 'MOCK_PART_1_0',
		title: 'Part 1 0',
		expectedDurationWithTransition: undefined,
	}
	MongoMock.getInnerMockCollection(Parts).insert(part10)

	const part11: DBPart = {
		_id: protectString(rundownId + '_part1_1'),
		segmentId: segment1._id,
		rundownId: segment1.rundownId,
		_rank: 1,
		externalId: 'MOCK_PART_1_1',
		title: 'Part 1 1',
		expectedDurationWithTransition: undefined,
	}
	MongoMock.getInnerMockCollection(Parts).insert(part11)

	const part12: DBPart = {
		_id: protectString(rundownId + '_part1_2'),
		segmentId: segment1._id,
		rundownId: segment1.rundownId,
		_rank: 2,
		externalId: 'MOCK_PART_1_2',
		title: 'Part 1 2',
		expectedDurationWithTransition: undefined,
	}
	MongoMock.getInnerMockCollection(Parts).insert(part12)

	const segment2: DBSegment = {
		_id: protectString(rundownId + '_segment2'),
		_rank: 2,
		externalId: 'MOCK_SEGMENT_2',
		rundownId: rundown._id,
		name: 'Segment 2',
	}
	MongoMock.getInnerMockCollection(Segments).insert(segment2)

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

	MongoMock.getInnerMockCollection(RundownBaselineAdLibPieces).insert(globalAdLib0)
	MongoMock.getInnerMockCollection(RundownBaselineAdLibPieces).insert(globalAdLib1)

	return rundownId
}

// // const studioBlueprint
// // const showStyleBlueprint
// // const showStyleVariant

export function convertToUIShowStyleBase(showStyleBase: DBShowStyleBase): UIShowStyleBase {
	return literal<Complete<UIShowStyleBase>>({
		_id: showStyleBase._id,
		name: showStyleBase.name,
		hotkeyLegend: showStyleBase.hotkeyLegend,
		sourceLayers: applyAndValidateOverrides(showStyleBase.sourceLayersWithOverrides).obj,
		outputLayers: applyAndValidateOverrides(showStyleBase.outputLayersWithOverrides).obj,
		abChannelDisplay: showStyleBase.abChannelDisplay,
	})
}
export function convertToUIStudio(studio: DBStudio): UIStudio {
	return literal<Complete<UIStudio>>({
		_id: studio._id,
		settings: applyAndValidateOverrides(studio.settingsWithOverrides).obj,
		name: studio.name,
		routeSets: applyAndValidateOverrides(studio.routeSetsWithOverrides).obj,
		routeSetExclusivityGroups: applyAndValidateOverrides(studio.routeSetExclusivityGroupsWithOverrides).obj,
		mappings: {},
	})
}
