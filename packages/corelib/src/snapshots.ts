import type { AdLibAction } from './dataModel/AdlibAction.js'
import type { AdLibPiece } from './dataModel/AdLibPiece.js'
import type { ExpectedPackageDB } from './dataModel/ExpectedPackages.js'
import type { ExpectedPlayoutItem } from './dataModel/ExpectedPlayoutItem.js'
import type { RundownPlaylistId } from './dataModel/Ids.js'
import type { NrcsIngestDataCacheObj } from './dataModel/NrcsIngestDataCache.js'
import type { DBPart } from './dataModel/Part.js'
import type { DBPartInstance } from './dataModel/PartInstance.js'
import type { Piece } from './dataModel/Piece.js'
import type { PieceInstance } from './dataModel/PieceInstance.js'
import type { DBRundown } from './dataModel/Rundown.js'
import type { RundownBaselineAdLibAction } from './dataModel/RundownBaselineAdLibAction.js'
import type { RundownBaselineAdLibItem } from './dataModel/RundownBaselineAdLibPiece.js'
import type { RundownBaselineObj } from './dataModel/RundownBaselineObj.js'
import type { DBRundownPlaylist } from './dataModel/RundownPlaylist/RundownPlaylist.js'
import type { DBSegment } from './dataModel/Segment.js'
import type { SofieIngestDataCacheObj } from './dataModel/SofieIngestDataCache.js'
import type { TimelineComplete } from './dataModel/Timeline.js'

export interface CoreRundownPlaylistSnapshot {
	version: string
	playlistId: RundownPlaylistId
	playlist: DBRundownPlaylist
	rundowns: Array<DBRundown>
	ingestData: Array<NrcsIngestDataCacheObj>
	sofieIngestData: Array<SofieIngestDataCacheObj> | undefined // Added in 1.52
	baselineObjs: Array<RundownBaselineObj>
	baselineAdlibs: Array<RundownBaselineAdLibItem>
	segments: Array<DBSegment>
	parts: Array<DBPart>
	partInstances: Array<DBPartInstance>
	pieces: Array<Piece>
	pieceInstances: Array<PieceInstance>
	adLibPieces: Array<AdLibPiece>
	adLibActions: Array<AdLibAction>
	baselineAdLibActions: Array<RundownBaselineAdLibAction>
	expectedPlayoutItems: Array<ExpectedPlayoutItem>
	expectedPackages: Array<ExpectedPackageDB> // Note: when reading, this could be in the old format
	timeline?: TimelineComplete
}
