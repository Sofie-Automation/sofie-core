import { AdLibAction } from '@sofie-automation/corelib/dist/dataModel/AdlibAction'
import { AdLibPiece } from '@sofie-automation/corelib/dist/dataModel/AdLibPiece'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
import { NrcsIngestDataCacheObj } from '@sofie-automation/corelib/dist/dataModel/NrcsIngestDataCache'
import { SofieIngestDataCacheObj } from '@sofie-automation/corelib/dist/dataModel/SofieIngestDataCache'
import { Piece } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { PieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { RundownBaselineAdLibAction } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineAdLibAction'
import { RundownBaselineAdLibItem } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineAdLibPiece'
import { RundownBaselineObj } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineObj'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { PartInstance } from '@sofie-automation/meteor-lib/dist/collections/PartInstances'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { createAsyncOnlyReadOnlyMongoCollection } from './collection'
import { registerIndex } from './indices'

export const AdLibActions = createAsyncOnlyReadOnlyMongoCollection<AdLibAction>(CollectionName.AdLibActions)
registerIndex(AdLibActions, {
	rundownId: 1,
	partId: 1,
})

export const AdLibPieces = createAsyncOnlyReadOnlyMongoCollection<AdLibPiece>(CollectionName.AdLibPieces)
registerIndex(AdLibPieces, {
	rundownId: 1,
	partId: 1,
	_rank: 1,
})

/**
 * The NrcsIngestDataCache collection is used to store data that comes from an NRCS
 */
export const NrcsIngestDataCache = createAsyncOnlyReadOnlyMongoCollection<NrcsIngestDataCacheObj>(
	CollectionName.NrcsIngestDataCache
)
registerIndex(NrcsIngestDataCache, {
	rundownId: 1,
})

/**
 * The SofieIngestDataCache collection is used to store data that comes from an NRCS and has been modified by Sofie
 */
export const SofieIngestDataCache = createAsyncOnlyReadOnlyMongoCollection<SofieIngestDataCacheObj>(
	CollectionName.SofieIngestDataCache
)
registerIndex(SofieIngestDataCache, {
	rundownId: 1,
})

export const PartInstances = createAsyncOnlyReadOnlyMongoCollection<PartInstance>(CollectionName.PartInstances)
registerIndex(PartInstances, {
	rundownId: 1,
	playlistActivationId: 1,
	reset: 1,
})
registerIndex(PartInstances, {
	rundownId: 1,
	segmentId: 1,
	takeCount: 1,
	reset: 1,
})
registerIndex(PartInstances, {
	rundownId: 1,
	takeCount: 1,
	reset: 1,
})
registerIndex(PartInstances, {
	rundownId: 1,
	// @ts-expect-error deep property
	'part._id': 1,
	takeCount: 1,
	reset: 1,
})

export const Parts = createAsyncOnlyReadOnlyMongoCollection<DBPart>(CollectionName.Parts)
registerIndex(Parts, {
	rundownId: 1,
	segmentId: 1,
	_rank: 1,
})
registerIndex(Parts, {
	rundownId: 1,
	_rank: 1,
})

export const PieceInstances = createAsyncOnlyReadOnlyMongoCollection<PieceInstance>(CollectionName.PieceInstances)
registerIndex(PieceInstances, {
	rundownId: 1,
	partInstanceId: 1,
	reset: -1,
})
registerIndex(PieceInstances, {
	rundownId: 1,
	playlistActivationId: 1,
	partInstanceId: 1,
	reset: -1,
})

export const Pieces = createAsyncOnlyReadOnlyMongoCollection<Piece>(CollectionName.Pieces)
registerIndex(Pieces, {
	startRundownId: 1,
	startSegmentId: 1,
	startPartId: 1,
})
registerIndex(Pieces, {
	startRundownId: 1,
	startPartId: 1,
})

export const RundownBaselineAdLibActions = createAsyncOnlyReadOnlyMongoCollection<RundownBaselineAdLibAction>(
	CollectionName.RundownBaselineAdLibActions
)
registerIndex(RundownBaselineAdLibActions, {
	rundownId: 1,
})

export const RundownBaselineAdLibPieces = createAsyncOnlyReadOnlyMongoCollection<RundownBaselineAdLibItem>(
	CollectionName.RundownBaselineAdLibPieces
)
registerIndex(RundownBaselineAdLibPieces, {
	rundownId: 1,
})

export const RundownBaselineObjs = createAsyncOnlyReadOnlyMongoCollection<RundownBaselineObj>(
	CollectionName.RundownBaselineObjects
)
registerIndex(RundownBaselineObjs, {
	rundownId: 1,
})

export const Rundowns = createAsyncOnlyReadOnlyMongoCollection<DBRundown>(CollectionName.Rundowns)
registerIndex(Rundowns, {
	playlistId: 1,
})
registerIndex(Rundowns, {
	playlistExternalId: 1,
})

export const RundownPlaylists = createAsyncOnlyReadOnlyMongoCollection<DBRundownPlaylist>(
	CollectionName.RundownPlaylists
)
registerIndex(RundownPlaylists, {
	studioId: 1,
	activationId: 1,
})

export const Segments = createAsyncOnlyReadOnlyMongoCollection<DBSegment>(CollectionName.Segments)
registerIndex(Segments, {
	rundownId: 1,
	_rank: 1,
})
