import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { Piece } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { ReactiveCacheCollection } from '../../lib/ReactiveCacheCollection'
import { DBShowStyleBase, SourceLayers } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { MongoFieldSpecifierOnesStrict } from '@sofie-automation/corelib/dist/mongo'
import { DBRundown, Rundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { AdLibPiece } from '@sofie-automation/corelib/dist/dataModel/AdLibPiece'
import { RundownBaselineAdLibItem } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineAdLibPiece'
import { AdLibAction } from '@sofie-automation/corelib/dist/dataModel/AdlibAction'
import { RundownBaselineAdLibAction } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineAdLibAction'
import { BlueprintId, ShowStyleBaseId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { PieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { Blueprint } from '@sofie-automation/corelib/dist/dataModel/Blueprint'

export interface SourceLayersDoc {
	_id: ShowStyleBaseId
	blueprintId: BlueprintId
	sourceLayers: SourceLayers
}

export type SegmentFields = '_id' | '_rank' | 'name'
export const segmentFieldSpecifier = literal<MongoFieldSpecifierOnesStrict<Pick<DBSegment, SegmentFields>>>({
	_id: 1,
	_rank: 1,
	name: 1,
})

export type PartFields = '_id' | '_rank' | 'segmentId' | 'rundownId'
export const partFieldSpecifier = literal<MongoFieldSpecifierOnesStrict<Pick<DBPart, PartFields>>>({
	_id: 1,
	_rank: 1,
	segmentId: 1,
	rundownId: 1,
})

export type PieceFields =
	| '_id'
	| 'startPartId'
	| 'startRundownId'
	| 'name'
	| 'sourceLayerId'
	| 'content'
	| 'expectedPackages'
export const pieceFieldSpecifier = literal<MongoFieldSpecifierOnesStrict<Pick<Piece, PieceFields>>>({
	_id: 1,
	startPartId: 1,
	startRundownId: 1,
	name: 1,
	sourceLayerId: 1,
	content: 1,
	expectedPackages: 1,
})

export type PartInstanceFields = '_id' | 'segmentId' | 'rundownId' | 'part'
export const partInstanceFieldSpecifier = literal<
	MongoFieldSpecifierOnesStrict<Pick<DBPartInstance, PartInstanceFields>>
>({
	_id: 1,
	segmentId: 1,
	rundownId: 1,
	part: 1, // This could be stricter, but this is unlikely to be changed once the PartInstance is created
})

export type PieceInstanceFields = '_id' | 'rundownId' | 'partInstanceId' | 'piece' | 'infinite'
export const pieceInstanceFieldSpecifier = literal<
	MongoFieldSpecifierOnesStrict<Pick<PieceInstance, PieceInstanceFields>>
>({
	_id: 1,
	rundownId: 1,
	partInstanceId: 1,
	piece: 1, // This could be stricter, but this is unlikely to be changed once the PieceInstance is created
	infinite: 1, // This could be stricter, but this is temporary and should never change once set
})

export type AdLibPieceFields =
	| '_id'
	| 'partId'
	| 'rundownId'
	| 'name'
	| 'sourceLayerId'
	| 'content'
	| 'expectedPackages'
export const adLibPieceFieldSpecifier = literal<MongoFieldSpecifierOnesStrict<Pick<AdLibPiece, AdLibPieceFields>>>({
	_id: 1,
	partId: 1,
	rundownId: 1,
	name: 1,
	sourceLayerId: 1,
	content: 1,
	expectedPackages: 1,
})

export type AdLibActionFields = '_id' | 'partId' | 'rundownId' | 'display' | 'expectedPackages'
export const adLibActionFieldSpecifier = literal<MongoFieldSpecifierOnesStrict<Pick<AdLibAction, AdLibActionFields>>>({
	_id: 1,
	partId: 1,
	rundownId: 1,
	display: 1, // TODO - more specific?
	expectedPackages: 1,
})

export type RundownFields = '_id' | 'showStyleBaseId'
export const rundownFieldSpecifier = literal<MongoFieldSpecifierOnesStrict<Pick<DBRundown, RundownFields>>>({
	_id: 1,
	showStyleBaseId: 1,
})

export type ShowStyleBaseFields = '_id' | 'blueprintId' | 'sourceLayersWithOverrides'
export const showStyleBaseFieldSpecifier = literal<
	MongoFieldSpecifierOnesStrict<Pick<DBShowStyleBase, ShowStyleBaseFields>>
>({
	_id: 1,
	blueprintId: 1,
	sourceLayersWithOverrides: 1,
})

export type BlueprintFields = '_id' | 'packageStatusMessages'
export const blueprintFieldSpecifier = literal<MongoFieldSpecifierOnesStrict<Pick<Blueprint, BlueprintFields>>>({
	_id: 1,
	packageStatusMessages: 1,
})

export interface ContentCache {
	Rundowns: ReactiveCacheCollection<Pick<Rundown, RundownFields>>
	Segments: ReactiveCacheCollection<Pick<DBSegment, SegmentFields>>
	Parts: ReactiveCacheCollection<Pick<DBPart, PartFields>>
	Pieces: ReactiveCacheCollection<Pick<Piece, PieceFields>>
	PartInstances: ReactiveCacheCollection<Pick<DBPartInstance, PartInstanceFields>>
	PieceInstances: ReactiveCacheCollection<Pick<PieceInstance, PieceInstanceFields>>
	AdLibPieces: ReactiveCacheCollection<Pick<AdLibPiece, AdLibPieceFields>>
	AdLibActions: ReactiveCacheCollection<Pick<AdLibAction, AdLibActionFields>>
	BaselineAdLibPieces: ReactiveCacheCollection<Pick<RundownBaselineAdLibItem, AdLibPieceFields>>
	BaselineAdLibActions: ReactiveCacheCollection<Pick<RundownBaselineAdLibAction, AdLibActionFields>>
	ShowStyleSourceLayers: ReactiveCacheCollection<SourceLayersDoc>
	Blueprints: ReactiveCacheCollection<Pick<Blueprint, BlueprintFields>>
}

export function createReactiveContentCache(): ContentCache {
	const cache: ContentCache = {
		Rundowns: new ReactiveCacheCollection<Pick<Rundown, RundownFields>>('rundowns'),
		Segments: new ReactiveCacheCollection<Pick<DBSegment, SegmentFields>>('segments'),
		Parts: new ReactiveCacheCollection<Pick<DBPart, PartFields>>('parts'),
		Pieces: new ReactiveCacheCollection<Pick<Piece, PieceFields>>('pieces'),
		PartInstances: new ReactiveCacheCollection<Pick<DBPartInstance, PartInstanceFields>>('partInstances'),
		PieceInstances: new ReactiveCacheCollection<Pick<PieceInstance, PieceInstanceFields>>('pieceInstances'),
		AdLibPieces: new ReactiveCacheCollection<Pick<AdLibPiece, AdLibPieceFields>>('adlibPieces'),
		AdLibActions: new ReactiveCacheCollection<Pick<AdLibAction, AdLibActionFields>>('adlibActions'),
		BaselineAdLibPieces: new ReactiveCacheCollection<Pick<AdLibPiece, AdLibPieceFields>>('baselineAdlibPieces'),
		BaselineAdLibActions: new ReactiveCacheCollection<Pick<RundownBaselineAdLibAction, AdLibActionFields>>(
			'baselineAdlibActions'
		),
		ShowStyleSourceLayers: new ReactiveCacheCollection<SourceLayersDoc>('sourceLayers'),
		Blueprints: new ReactiveCacheCollection<Pick<Blueprint, BlueprintFields>>('blueprints'),
	}

	return cache
}
