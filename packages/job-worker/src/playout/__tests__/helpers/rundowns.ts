import { IBlueprintPieceType, PieceLifespan, PartHoldMode } from '@sofie-automation/blueprints-integration'
import { RundownPlaylistId, RundownId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { EmptyPieceTimelineObjectsBlob, Piece } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { ReadonlyDeep } from 'type-fest'
import { ProcessedShowStyleCompound } from '../../../jobs/index.js'
import { getCurrentTime } from '../../../lib/index.js'
import { MockJobContext } from '../../../__mocks__/context.js'

export async function setupRundownBase(
	context: MockJobContext,
	playlistId: RundownPlaylistId,
	rundownId: RundownId,
	showStyle: ReadonlyDeep<ProcessedShowStyleCompound>,
	partPropsOverride: Partial<DBPart> = {},
	piecePropsOverride: { piece0: Partial<Piece>; piece1: Partial<Piece> } = { piece0: {}, piece1: {} }
): Promise<{ rundown: DBRundown; segment0: DBSegment; part00: DBPart }> {
	const outputLayerIds = Object.keys(showStyle.outputLayers)
	const sourceLayerIds = Object.keys(showStyle.sourceLayers)

	const rundown: DBRundown = {
		studioId: context.studio._id,
		showStyleBaseId: showStyle._id,
		showStyleVariantId: showStyle.showStyleVariantId,
		timing: {
			type: 'none' as any,
		},

		playlistId: playlistId,

		_id: rundownId,
		externalId: 'MOCK_RUNDOWN',
		name: 'Default Rundown',

		created: getCurrentTime(),
		modified: getCurrentTime(),
		importVersions: {
			studio: '',
			showStyleBase: '',
			showStyleVariant: '',
			blueprint: '',
			core: '',
		},

		source: {
			type: 'http',
			// nrcsName: 'mock',
		},
	}
	await context.mockCollections.Rundowns.insertOne(rundown)

	const segment0: DBSegment = {
		_id: protectString(rundownId + '_segment0'),
		_rank: 0,
		externalId: 'MOCK_SEGMENT_0',
		rundownId: rundown._id,
		name: 'Segment 0',
	}
	await context.mockCollections.Segments.insertOne(segment0)
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

		...partPropsOverride,
	}
	await context.mockCollections.Parts.insertOne(part00)

	const piece000: Piece = {
		_id: protectString(rundownId + '_piece000'),
		externalId: 'MOCK_PIECE_000',
		startRundownId: rundown._id,
		startSegmentId: part00.segmentId,
		startPartId: part00._id,
		name: 'Piece 000',
		pieceType: IBlueprintPieceType.Normal,
		enable: {
			start: 0,
		},
		sourceLayerId: sourceLayerIds[0],
		outputLayerId: outputLayerIds[0],
		lifespan: PieceLifespan.WithinPart,
		invalid: false,
		content: {},
		timelineObjectsString: EmptyPieceTimelineObjectsBlob,
		...piecePropsOverride.piece0,
	}
	await context.mockCollections.Pieces.insertOne(piece000)

	const piece001: Piece = {
		_id: protectString(rundownId + '_piece001'),
		externalId: 'MOCK_PIECE_001',
		startRundownId: rundown._id,
		startSegmentId: part00.segmentId,
		startPartId: part00._id,
		name: 'Piece 001',
		pieceType: IBlueprintPieceType.Normal,
		enable: {
			start: 0,
		},
		sourceLayerId: sourceLayerIds[1],
		outputLayerId: outputLayerIds[0],
		lifespan: PieceLifespan.WithinPart,
		invalid: false,
		content: {},
		timelineObjectsString: EmptyPieceTimelineObjectsBlob,
		...piecePropsOverride.piece1,
	}
	await context.mockCollections.Pieces.insertOne(piece001)

	return { rundown, segment0, part00 }
}

export async function setupPart2(
	context: MockJobContext,
	rundownId: RundownId,
	showStyle: ReadonlyDeep<ProcessedShowStyleCompound>,
	rundown: DBRundown,
	segment0: DBSegment,
	partPropsOverride: Partial<DBPart> = {},
	piece0PropsOverride: Partial<Piece> = {}
): Promise<{ part01: DBPart }> {
	const outputLayerIds = Object.keys(showStyle.outputLayers)
	const sourceLayerIds = Object.keys(showStyle.sourceLayers)

	const part01: DBPart = {
		_id: protectString(rundownId + '_part0_1'),
		segmentId: segment0._id,
		rundownId: segment0.rundownId,
		_rank: 1,
		externalId: 'MOCK_PART_0_1',
		title: 'Part 0 1',
		expectedDurationWithTransition: undefined,

		...partPropsOverride,
	}
	await context.mockCollections.Parts.insertOne(part01)

	const piece010: Piece = {
		_id: protectString(rundownId + '_piece010'),
		externalId: 'MOCK_PIECE_010',
		startRundownId: rundown._id,
		startSegmentId: part01.segmentId,
		startPartId: part01._id,
		name: 'Piece 010',
		pieceType: IBlueprintPieceType.Normal,
		enable: {
			start: 0,
		},
		sourceLayerId: sourceLayerIds[0],
		outputLayerId: outputLayerIds[0],
		lifespan: PieceLifespan.WithinPart,
		invalid: false,
		content: {},
		timelineObjectsString: EmptyPieceTimelineObjectsBlob,

		...piece0PropsOverride,
	}
	await context.mockCollections.Pieces.insertOne(piece010)

	return { part01 }
}

export async function setupRundownWithPreroll(
	context: MockJobContext,
	playlistId: RundownPlaylistId,
	rundownId: RundownId,
	showStyle: ReadonlyDeep<ProcessedShowStyleCompound>
): Promise<RundownId> {
	const { rundown, segment0 } = await setupRundownBase(context, playlistId, rundownId, showStyle)

	await setupPart2(context, rundownId, showStyle, rundown, segment0, {}, { prerollDuration: 500 })

	return rundownId
}

export async function setupRundownWithInTransition(
	context: MockJobContext,
	playlistId: RundownPlaylistId,
	rundownId: RundownId,
	showStyle: ReadonlyDeep<ProcessedShowStyleCompound>
): Promise<RundownId> {
	const { rundown, segment0 } = await setupRundownBase(context, playlistId, rundownId, showStyle)

	await setupPart2(context, rundownId, showStyle, rundown, segment0, {
		inTransition: {
			blockTakeDuration: 1000,
			previousPartKeepaliveDuration: 1000,
			partContentDelayDuration: 0,
		},
	})

	return rundownId
}

export async function setupRundownWithInTransitionPlannedPiece(
	context: MockJobContext,
	playlistId: RundownPlaylistId,
	rundownId: RundownId,
	showStyle: ReadonlyDeep<ProcessedShowStyleCompound>
): Promise<RundownId> {
	const outputLayerIds = Object.keys(showStyle.outputLayers)
	const sourceLayerIds = Object.keys(showStyle.sourceLayers)

	const { rundown, segment0 } = await setupRundownBase(context, playlistId, rundownId, showStyle)

	const { part01 } = await setupPart2(context, rundownId, showStyle, rundown, segment0, {
		inTransition: {
			blockTakeDuration: 1000,
			previousPartKeepaliveDuration: 1000,
			partContentDelayDuration: 500,
		},
	})

	const piece011: Piece = {
		_id: protectString(rundownId + '_piece011'),
		externalId: 'MOCK_PIECE_011',
		startRundownId: rundown._id,
		startSegmentId: part01.segmentId,
		startPartId: part01._id,
		name: 'Piece 011',
		enable: {
			start: 0,
		},
		sourceLayerId: sourceLayerIds[2],
		outputLayerId: outputLayerIds[0],
		lifespan: PieceLifespan.WithinPart,
		invalid: false,
		content: {},
		timelineObjectsString: EmptyPieceTimelineObjectsBlob,
		pieceType: IBlueprintPieceType.InTransition,
	}
	await context.mockCollections.Pieces.insertOne(piece011)

	// delayed piece
	const piece012: Piece = {
		_id: protectString(rundownId + '_piece012'),
		externalId: 'MOCK_PIECE_012',
		startRundownId: rundown._id,
		startSegmentId: part01.segmentId,
		startPartId: part01._id,
		name: 'Piece 012',
		pieceType: IBlueprintPieceType.Normal,
		enable: {
			start: 1000,
			duration: 1000,
		},
		sourceLayerId: sourceLayerIds[3],
		outputLayerId: outputLayerIds[0],
		lifespan: PieceLifespan.WithinPart,
		invalid: false,
		content: {},
		timelineObjectsString: EmptyPieceTimelineObjectsBlob,
	}
	await context.mockCollections.Pieces.insertOne(piece012)

	return rundownId
}

export async function setupRundownWithInTransitionContentDelay(
	context: MockJobContext,
	playlistId: RundownPlaylistId,
	rundownId: RundownId,
	showStyle: ReadonlyDeep<ProcessedShowStyleCompound>
): Promise<RundownId> {
	const outputLayerIds = Object.keys(showStyle.outputLayers)
	const sourceLayerIds = Object.keys(showStyle.sourceLayers)

	const { rundown, segment0 } = await setupRundownBase(context, playlistId, rundownId, showStyle)

	const { part01 } = await setupPart2(context, rundownId, showStyle, rundown, segment0, {
		inTransition: {
			blockTakeDuration: 1000,
			previousPartKeepaliveDuration: 1000,
			partContentDelayDuration: 500,
		},
	})

	const piece011: Piece = {
		_id: protectString(rundownId + '_piece011'),
		externalId: 'MOCK_PIECE_011',
		startRundownId: rundown._id,
		startSegmentId: part01.segmentId,
		startPartId: part01._id,
		name: 'Piece 011',
		enable: {
			start: 0,
		},
		sourceLayerId: sourceLayerIds[2],
		outputLayerId: outputLayerIds[0],
		lifespan: PieceLifespan.WithinPart,
		invalid: false,
		content: {},
		timelineObjectsString: EmptyPieceTimelineObjectsBlob,
		pieceType: IBlueprintPieceType.InTransition,
	}
	await context.mockCollections.Pieces.insertOne(piece011)

	return rundownId
}

export async function setupRundownWithInTransitionContentDelayAndPreroll(
	context: MockJobContext,
	playlistId: RundownPlaylistId,
	rundownId: RundownId,
	showStyle: ReadonlyDeep<ProcessedShowStyleCompound>
): Promise<RundownId> {
	const outputLayerIds = Object.keys(showStyle.outputLayers)
	const sourceLayerIds = Object.keys(showStyle.sourceLayers)

	const { rundown, segment0 } = await setupRundownBase(context, playlistId, rundownId, showStyle)

	const { part01 } = await setupPart2(
		context,
		rundownId,
		showStyle,
		rundown,
		segment0,
		{
			inTransition: {
				blockTakeDuration: 1000,
				previousPartKeepaliveDuration: 1000,
				partContentDelayDuration: 500,
			},
		},
		{
			prerollDuration: 250,
		}
	)

	const piece011: Piece = {
		_id: protectString(rundownId + '_piece011'),
		externalId: 'MOCK_PIECE_011',
		startRundownId: rundown._id,
		startSegmentId: part01.segmentId,
		startPartId: part01._id,
		name: 'Piece 011',
		enable: {
			start: 0,
		},
		sourceLayerId: sourceLayerIds[2],
		outputLayerId: outputLayerIds[0],
		lifespan: PieceLifespan.WithinPart,
		invalid: false,
		content: {},
		timelineObjectsString: EmptyPieceTimelineObjectsBlob,
		pieceType: IBlueprintPieceType.InTransition,
	}
	await context.mockCollections.Pieces.insertOne(piece011)

	return rundownId
}

export async function setupRundownWithInTransitionExistingInfinite(
	context: MockJobContext,
	playlistId: RundownPlaylistId,
	rundownId: RundownId,
	showStyle: ReadonlyDeep<ProcessedShowStyleCompound>
): Promise<RundownId> {
	const outputLayerIds = Object.keys(showStyle.outputLayers)
	const sourceLayerIds = Object.keys(showStyle.sourceLayers)

	const { rundown, segment0, part00 } = await setupRundownBase(context, playlistId, rundownId, showStyle)

	const piece002: Piece = {
		_id: protectString(rundownId + '_piece002'),
		externalId: 'MOCK_PIECE_002',
		startRundownId: rundown._id,
		startSegmentId: part00.segmentId,
		startPartId: part00._id,
		name: 'Piece 002',
		pieceType: IBlueprintPieceType.Normal,
		enable: {
			start: 0,
		},
		sourceLayerId: sourceLayerIds[3],
		outputLayerId: outputLayerIds[0],
		lifespan: PieceLifespan.OutOnSegmentEnd,
		invalid: false,
		content: {},
		timelineObjectsString: EmptyPieceTimelineObjectsBlob,
	}
	await context.mockCollections.Pieces.insertOne(piece002)

	const { part01 } = await setupPart2(context, rundownId, showStyle, rundown, segment0, {
		inTransition: {
			blockTakeDuration: 1000,
			previousPartKeepaliveDuration: 1000,
			partContentDelayDuration: 500,
		},
	})

	const piece011: Piece = {
		_id: protectString(rundownId + '_piece011'),
		externalId: 'MOCK_PIECE_011',
		startRundownId: rundown._id,
		startSegmentId: part01.segmentId,
		startPartId: part01._id,
		name: 'Piece 011',
		enable: {
			start: 0,
		},
		sourceLayerId: sourceLayerIds[2],
		outputLayerId: outputLayerIds[0],
		lifespan: PieceLifespan.WithinPart,
		invalid: false,
		content: {},
		timelineObjectsString: EmptyPieceTimelineObjectsBlob,
		pieceType: IBlueprintPieceType.InTransition,
	}
	await context.mockCollections.Pieces.insertOne(piece011)

	return rundownId
}

export async function setupRundownWithInTransitionNewInfinite(
	context: MockJobContext,
	playlistId: RundownPlaylistId,
	rundownId: RundownId,
	showStyle: ReadonlyDeep<ProcessedShowStyleCompound>
): Promise<RundownId> {
	const outputLayerIds = Object.keys(showStyle.outputLayers)
	const sourceLayerIds = Object.keys(showStyle.sourceLayers)

	const { rundown, segment0, part00 } = await setupRundownBase(context, playlistId, rundownId, showStyle)

	const { part01 } = await setupPart2(context, rundownId, showStyle, rundown, segment0, {
		inTransition: {
			blockTakeDuration: 1000,
			previousPartKeepaliveDuration: 1000,
			partContentDelayDuration: 500,
		},
	})

	const piece011: Piece = {
		_id: protectString(rundownId + '_piece011'),
		externalId: 'MOCK_PIECE_011',
		startRundownId: rundown._id,
		startSegmentId: part01.segmentId,
		startPartId: part01._id,
		name: 'Piece 011',
		enable: {
			start: 0,
		},
		sourceLayerId: sourceLayerIds[2],
		outputLayerId: outputLayerIds[0],
		lifespan: PieceLifespan.WithinPart,
		invalid: false,
		content: {},
		timelineObjectsString: EmptyPieceTimelineObjectsBlob,
		pieceType: IBlueprintPieceType.InTransition,
	}
	await context.mockCollections.Pieces.insertOne(piece011)

	const piece012: Piece = {
		_id: protectString(rundownId + '_piece012'),
		externalId: 'MOCK_PIECE_012',
		startRundownId: rundown._id,
		startSegmentId: part00.segmentId,
		startPartId: part01._id,
		name: 'Piece 012',
		pieceType: IBlueprintPieceType.Normal,
		enable: {
			start: 0,
		},
		sourceLayerId: sourceLayerIds[3],
		outputLayerId: outputLayerIds[0],
		lifespan: PieceLifespan.OutOnSegmentEnd,
		invalid: false,
		content: {},
		timelineObjectsString: EmptyPieceTimelineObjectsBlob,
	}
	await context.mockCollections.Pieces.insertOne(piece012)

	return rundownId
}

export async function setupRundownWithInTransitionEnableHold(
	context: MockJobContext,
	playlistId: RundownPlaylistId,
	rundownId: RundownId,
	showStyle: ReadonlyDeep<ProcessedShowStyleCompound>
): Promise<RundownId> {
	const outputLayerIds = Object.keys(showStyle.outputLayers)
	const sourceLayerIds = Object.keys(showStyle.sourceLayers)

	const { rundown, segment0 } = await setupRundownBase(context, playlistId, rundownId, showStyle, {
		holdMode: PartHoldMode.FROM,
	})

	const { part01 } = await setupPart2(context, rundownId, showStyle, rundown, segment0, {
		inTransition: {
			blockTakeDuration: 1000,
			previousPartKeepaliveDuration: 1000,
			partContentDelayDuration: 500,
		},

		holdMode: PartHoldMode.TO,
	})

	const piece011: Piece = {
		_id: protectString(rundownId + '_piece011'),
		externalId: 'MOCK_PIECE_011',
		startRundownId: rundown._id,
		startSegmentId: part01.segmentId,
		startPartId: part01._id,
		name: 'Piece 011',
		enable: {
			start: 0,
		},
		sourceLayerId: sourceLayerIds[2],
		outputLayerId: outputLayerIds[0],
		lifespan: PieceLifespan.WithinPart,
		invalid: false,
		content: {},
		timelineObjectsString: EmptyPieceTimelineObjectsBlob,
		pieceType: IBlueprintPieceType.InTransition,
	}
	await context.mockCollections.Pieces.insertOne(piece011)

	return rundownId
}

export async function setupRundownWithInTransitionDisabled(
	context: MockJobContext,
	playlistId: RundownPlaylistId,
	rundownId: RundownId,
	showStyle: ReadonlyDeep<ProcessedShowStyleCompound>
): Promise<RundownId> {
	const outputLayerIds = Object.keys(showStyle.outputLayers)
	const sourceLayerIds = Object.keys(showStyle.sourceLayers)

	const { rundown, segment0 } = await setupRundownBase(context, playlistId, rundownId, showStyle, {
		disableNextInTransition: true,
	})

	const { part01 } = await setupPart2(context, rundownId, showStyle, rundown, segment0, {
		inTransition: {
			blockTakeDuration: 1000,
			previousPartKeepaliveDuration: 1000,
			partContentDelayDuration: 500,
		},
	})

	const piece011: Piece = {
		_id: protectString(rundownId + '_piece011'),
		externalId: 'MOCK_PIECE_011',
		startRundownId: rundown._id,
		startSegmentId: part01.segmentId,
		startPartId: part01._id,
		name: 'Piece 011',
		enable: {
			start: 0,
		},
		sourceLayerId: sourceLayerIds[2],
		outputLayerId: outputLayerIds[0],
		lifespan: PieceLifespan.WithinPart,
		invalid: false,
		content: {},
		timelineObjectsString: EmptyPieceTimelineObjectsBlob,
		pieceType: IBlueprintPieceType.InTransition,
	}
	await context.mockCollections.Pieces.insertOne(piece011)

	return rundownId
}

export async function setupRundownWithOutTransition(
	context: MockJobContext,
	playlistId: RundownPlaylistId,
	rundownId: RundownId,
	showStyle: ReadonlyDeep<ProcessedShowStyleCompound>
): Promise<RundownId> {
	const outputLayerIds = Object.keys(showStyle.outputLayers)
	const sourceLayerIds = Object.keys(showStyle.sourceLayers)

	const { rundown, segment0, part00 } = await setupRundownBase(context, playlistId, rundownId, showStyle, {
		outTransition: { duration: 1000 },
	})

	const piece002: Piece = {
		_id: protectString(rundownId + '_piece002'),
		externalId: 'MOCK_PIECE_002',
		startRundownId: rundown._id,
		startSegmentId: part00.segmentId,
		startPartId: part00._id,
		name: 'Piece 002',
		pieceType: IBlueprintPieceType.OutTransition,
		enable: {
			start: 0, // will be overwritten
			duration: 1000,
		},
		sourceLayerId: sourceLayerIds[0],
		outputLayerId: outputLayerIds[0],
		lifespan: PieceLifespan.WithinPart,
		invalid: false,
		content: {},
		timelineObjectsString: EmptyPieceTimelineObjectsBlob,
	}
	await context.mockCollections.Pieces.insertOne(piece002)

	await setupPart2(context, rundownId, showStyle, rundown, segment0)

	return rundownId
}

export async function setupRundownWithOutTransitionAndPreroll(
	context: MockJobContext,
	playlistId: RundownPlaylistId,
	rundownId: RundownId,
	showStyle: ReadonlyDeep<ProcessedShowStyleCompound>
): Promise<RundownId> {
	const outputLayerIds = Object.keys(showStyle.outputLayers)
	const sourceLayerIds = Object.keys(showStyle.sourceLayers)

	const { rundown, segment0, part00 } = await setupRundownBase(context, playlistId, rundownId, showStyle, {
		outTransition: { duration: 1000 },
	})

	const piece002: Piece = {
		_id: protectString(rundownId + '_piece002'),
		externalId: 'MOCK_PIECE_002',
		startRundownId: rundown._id,
		startSegmentId: part00.segmentId,
		startPartId: part00._id,
		name: 'Piece 002',
		pieceType: IBlueprintPieceType.OutTransition,
		enable: {
			start: 0, // will be overwritten
			duration: 1000,
		},
		sourceLayerId: sourceLayerIds[0],
		outputLayerId: outputLayerIds[0],
		lifespan: PieceLifespan.WithinPart,
		invalid: false,
		content: {},
		timelineObjectsString: EmptyPieceTimelineObjectsBlob,
	}
	await context.mockCollections.Pieces.insertOne(piece002)

	await setupPart2(context, rundownId, showStyle, rundown, segment0, {}, { prerollDuration: 250 })

	return rundownId
}

export async function setupRundownWithOutTransitionAndPreroll2(
	context: MockJobContext,
	playlistId: RundownPlaylistId,
	rundownId: RundownId,
	showStyle: ReadonlyDeep<ProcessedShowStyleCompound>
): Promise<RundownId> {
	const outputLayerIds = Object.keys(showStyle.outputLayers)
	const sourceLayerIds = Object.keys(showStyle.sourceLayers)

	const { rundown, segment0, part00 } = await setupRundownBase(context, playlistId, rundownId, showStyle, {
		outTransition: { duration: 250 },
	})

	const piece002: Piece = {
		_id: protectString(rundownId + '_piece002'),
		externalId: 'MOCK_PIECE_002',
		startRundownId: rundown._id,
		startSegmentId: part00.segmentId,
		startPartId: part00._id,
		name: 'Piece 002',
		pieceType: IBlueprintPieceType.OutTransition,
		enable: {
			start: 0, // will be overwritten
			duration: 250,
		},
		sourceLayerId: sourceLayerIds[0],
		outputLayerId: outputLayerIds[0],
		lifespan: PieceLifespan.WithinPart,
		invalid: false,
		content: {},
		timelineObjectsString: EmptyPieceTimelineObjectsBlob,
	}
	await context.mockCollections.Pieces.insertOne(piece002)

	await setupPart2(context, rundownId, showStyle, rundown, segment0, {}, { prerollDuration: 1000 })

	return rundownId
}

export async function setupRundownWithOutTransitionAndInTransition(
	context: MockJobContext,
	playlistId: RundownPlaylistId,
	rundownId: RundownId,
	showStyle: ReadonlyDeep<ProcessedShowStyleCompound>
): Promise<RundownId> {
	const outputLayerIds = Object.keys(showStyle.outputLayers)
	const sourceLayerIds = Object.keys(showStyle.sourceLayers)

	const { rundown, segment0, part00 } = await setupRundownBase(context, playlistId, rundownId, showStyle, {
		outTransition: { duration: 600 },
	})

	const piece002: Piece = {
		_id: protectString(rundownId + '_piece002'),
		externalId: 'MOCK_PIECE_002',
		startRundownId: rundown._id,
		startSegmentId: part00.segmentId,
		startPartId: part00._id,
		name: 'Piece 002',
		pieceType: IBlueprintPieceType.OutTransition,
		enable: {
			start: 0, // will be overwritten
			duration: 600,
		},
		sourceLayerId: sourceLayerIds[2],
		outputLayerId: outputLayerIds[0],
		lifespan: PieceLifespan.WithinPart,
		invalid: false,
		content: {},
		timelineObjectsString: EmptyPieceTimelineObjectsBlob,
	}
	await context.mockCollections.Pieces.insertOne(piece002)

	const { part01 } = await setupPart2(context, rundownId, showStyle, rundown, segment0, {
		inTransition: {
			blockTakeDuration: 500,
			previousPartKeepaliveDuration: 250,
			partContentDelayDuration: 300,
		},
	})

	const piece011: Piece = {
		_id: protectString(rundownId + '_piece011'),
		externalId: 'MOCK_PIECE_011',
		startRundownId: rundown._id,
		startSegmentId: part01.segmentId,
		startPartId: part01._id,
		name: 'Piece 011',
		pieceType: IBlueprintPieceType.InTransition,
		enable: {
			start: 0,
			duration: 500,
		},
		sourceLayerId: sourceLayerIds[2],
		outputLayerId: outputLayerIds[0],
		lifespan: PieceLifespan.WithinPart,
		invalid: false,
		content: {},
		timelineObjectsString: EmptyPieceTimelineObjectsBlob,
	}
	await context.mockCollections.Pieces.insertOne(piece011)

	return rundownId
}

export async function setupRundownWithOutTransitionEnableHold(
	context: MockJobContext,
	playlistId: RundownPlaylistId,
	rundownId: RundownId,
	showStyle: ReadonlyDeep<ProcessedShowStyleCompound>
): Promise<RundownId> {
	const { rundown, segment0 } = await setupRundownBase(context, playlistId, rundownId, showStyle, {
		holdMode: PartHoldMode.FROM,
		outTransition: { duration: 500 },
	})

	await setupPart2(context, rundownId, showStyle, rundown, segment0, { holdMode: PartHoldMode.TO })

	return rundownId
}
