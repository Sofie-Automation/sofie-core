import { AdLibAction } from './dataModel/AdlibAction.js'
import { AdLibPiece } from './dataModel/AdLibPiece.js'
import { ExpectedPackageDB } from './dataModel/ExpectedPackages.js'
import { ExpectedPlayoutItem } from './dataModel/ExpectedPlayoutItem.js'
import { RundownPlaylistId } from './dataModel/Ids.js'
import { NrcsIngestDataCacheObj } from './dataModel/NrcsIngestDataCache.js'
import { DBPart } from './dataModel/Part.js'
import { DBPartInstance } from './dataModel/PartInstance.js'
import { Piece } from './dataModel/Piece.js'
import { PieceInstance } from './dataModel/PieceInstance.js'
import { DBRundown } from './dataModel/Rundown.js'
import { RundownBaselineAdLibAction } from './dataModel/RundownBaselineAdLibAction.js'
import { RundownBaselineAdLibItem } from './dataModel/RundownBaselineAdLibPiece.js'
import { RundownBaselineObj } from './dataModel/RundownBaselineObj.js'
import { DBRundownPlaylist } from './dataModel/RundownPlaylist.js'
import { DBSegment } from './dataModel/Segment.js'
import { SofieIngestDataCacheObj } from './dataModel/SofieIngestDataCache.js'
import { TimelineComplete } from './dataModel/Timeline.js'

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
	expectedPackages: Array<ExpectedPackageDB>
	timeline?: TimelineComplete
}
