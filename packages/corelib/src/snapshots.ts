import { AdLibAction } from './dataModel/AdlibAction'
import { AdLibPiece } from './dataModel/AdLibPiece'
import { ExpectedMediaItem } from './dataModel/ExpectedMediaItem'
import { ExpectedPackageDB } from './dataModel/ExpectedPackages'
import { ExpectedPlayoutItem } from './dataModel/ExpectedPlayoutItem'
import { RundownPlaylistId } from './dataModel/Ids'
import { NrcsIngestDataCacheObj } from './dataModel/NrcsIngestDataCache'
import { DBPart } from './dataModel/Part'
import { DBPartInstance } from './dataModel/PartInstance'
import { Piece } from './dataModel/Piece'
import { PieceInstance } from './dataModel/PieceInstance'
import { DBRundown } from './dataModel/Rundown'
import { RundownBaselineAdLibAction } from './dataModel/RundownBaselineAdLibAction'
import { RundownBaselineAdLibItem } from './dataModel/RundownBaselineAdLibPiece'
import { RundownBaselineObj } from './dataModel/RundownBaselineObj'
import { DBRundownPlaylist } from './dataModel/RundownPlaylist'
import { DBSegment } from './dataModel/Segment'
import { SofieIngestDataCacheObj } from './dataModel/SofieIngestDataCache'
import { TimelineComplete } from './dataModel/Timeline'

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
	expectedMediaItems: Array<ExpectedMediaItem>
	expectedPlayoutItems: Array<ExpectedPlayoutItem>
	expectedPackages: Array<ExpectedPackageDB>
	timeline?: TimelineComplete
}
