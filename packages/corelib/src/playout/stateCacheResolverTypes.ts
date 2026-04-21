import {
	PartId,
	PieceId,
	PieceInstanceId,
	RundownId,
	RundownPlaylistActivationId,
	SegmentId,
	ShowStyleBaseId,
} from '../dataModel/Ids.js'
import { DBPart, PartExtended } from '../dataModel/Part.js'
import { Piece } from '../dataModel/Piece.js'
import { PieceInstance } from '../dataModel/PieceInstance.js'
import { Rundown } from '../dataModel/Rundown.js'
import { DBRundownPlaylist } from '../dataModel/RundownPlaylist/RundownPlaylist.js'
import { DBSegment, SegmentExtended } from '../dataModel/Segment.js'
import { FindOneOptions, FindOptions, MongoQuery } from '../mongo.js'
import { PartInstance } from '../dataModel/PartInstance.js'
import { DBShowStyleBase, UIShowStyleBase } from '../dataModel/ShowStyleBase.js'
import { UIStudio } from '../dataModel/Studio.js'
import { TimeDuration } from '@sofie-automation/shared-lib/dist/lib/lib'

export type SegmentsFindOne = (
	selector: SegmentId | MongoQuery<DBSegment>,
	options: FindOneOptions<DBSegment>
) => DBSegment | undefined

export type PieceInstancesFind = (
	selector?: PieceInstanceId | MongoQuery<PieceInstance>,
	options?: FindOptions<PieceInstance>
) => PieceInstance[]

export type GetCurrentTime = () => TimeDuration

export type GetSegmentsAndPartsSync = (
	playlist: Pick<DBRundownPlaylist, '_id' | 'rundownIdsInOrder'>,
	segmentsQuery?: MongoQuery<DBSegment>,
	partsQuery?: MongoQuery<DBPart>,
	segmentsOptions?: Omit<FindOptions<DBSegment>, 'projection'>,
	partsOptions?: Omit<FindOptions<DBPart>, 'projection'>
) => {
	segments: DBSegment[]
	parts: DBPart[]
}

export type GetActivePartInstances = (
	playlist: Pick<DBRundownPlaylist, '_id'>,
	selector?: MongoQuery<PartInstance>,
	options?: FindOptions<PartInstance>
) => PartInstance[]

export type PiecesFind = (selector?: MongoQuery<Piece> | PieceId, options?: FindOptions<Piece>) => Piece[]

export interface StateCacheResolverDataAccess {
	segmentsFindOne: SegmentsFindOne
	getSegmentsAndPartsSync: GetSegmentsAndPartsSync
	getActivePartInstances: GetActivePartInstances
	piecesFind: PiecesFind
	pieceInstancesFind: PieceInstancesFind
}

export interface GetResolvedSegmentOptions {
	/** Current time resolver, mostly for testing. Defaults to `Date.now()`. */
	getCurrentTime?: GetCurrentTime
	/** Called when fallback simulation is used and should be invalidated later. */
	invalidateAfter?: (timeoutMs: number) => void
	/** Keep disabled pieces in output. */
	includeDisabledPieces?: boolean
	/** Mark hidden source layers as visible in the resolved output. */
	showHiddenSourceLayers?: boolean
	/** Fallback rendered duration for parts with no computed duration. */
	defaultDisplayDuration?: number
}

export interface GetResolvedSegmentParams {
	showStyleBase: DBShowStyleBase | UIShowStyleBase
	studio: UIStudio | undefined
	playlist: DBRundownPlaylist
	rundown: Pick<Rundown, '_id' | 'showStyleBaseId'>
	segment: DBSegment
	segmentsToReceiveOnRundownEndFromSet: Set<SegmentId>
	rundownsToReceiveOnShowStyleEndFrom: RundownId[]
	rundownsToShowStyles: ReadonlyMap<RundownId, ShowStyleBaseId>
	orderedAllPartIds: PartId[]
	currentPartInstance: PartInstance | undefined
	nextPartInstance: PartInstance | undefined
	accessors: StateCacheResolverDataAccess
	options?: GetResolvedSegmentOptions
}

export interface ResolvedSegmentResult {
	/** A Segment with additional resolved layer metadata. */
	segmentExtended: SegmentExtended
	/** Parts in this segment, with resolved pieces and timings. */
	parts: PartExtended[]
	/** True when one of the segment parts is currently live. */
	isLiveSegment: boolean
	/** True when one of the segment parts is currently next. */
	isNextSegment: boolean
	/** The live part when this segment is currently live. */
	currentLivePart: PartExtended | undefined
	/** The next part when this segment contains the next part. */
	currentNextPart: PartExtended | undefined
	/** True when segment contains pieces on remote source layers. */
	hasRemoteItems: boolean
	/** True when segment contains pieces on guest source layers. */
	hasGuestItems: boolean
	/** True when any part in this segment has started playback. */
	hasAlreadyPlayed: boolean
	/** True when the active live part is set to auto-next. */
	autoNextPart: boolean
}

export interface GetSegmentsWithPartInstancesParams {
	playlist: DBRundownPlaylist
	accessors: Pick<StateCacheResolverDataAccess, 'getSegmentsAndPartsSync' | 'getActivePartInstances'>
	queries?: {
		segments?: MongoQuery<DBSegment>
		parts?: MongoQuery<DBPart>
		partInstances?: MongoQuery<PartInstance>
	}
	options?: {
		segments?: FindOptions<DBSegment>
		parts?: FindOptions<DBPart>
		partInstances?: FindOptions<PartInstance>
	}
}

export interface GetPieceInstancesForPartInstanceOptions {
	/** Current time resolver, mostly for testing. Defaults to `Date.now()`. */
	getCurrentTime?: GetCurrentTime
	/** Cache of pieces by startPartId for fast repeated lookups. */
	allPiecesCache?: Map<PartId | null, Piece[]>
	/** Find options used when reading stored PieceInstances. */
	pieceInstanceOptions?: FindOptions<PieceInstance>
	/** Called when fallback simulation is used and should be invalidated later. */
	invalidateAfter?: (timeoutMs: number) => void
}

export interface GetPieceInstancesForPartInstanceParams {
	playlistActivationId: RundownPlaylistActivationId | undefined
	rundown: Pick<Rundown, '_id' | 'showStyleBaseId'>
	segment: Pick<DBSegment, '_id' | 'orphaned'>
	partInstance: Pick<PartInstance, '_id' | 'part' | 'isTemporary' | 'timings'>
	partsToReceiveOnSegmentEndFromSet: Set<PartId>
	segmentsToReceiveOnRundownEndFromSet: Set<SegmentId>
	rundownsToReceiveOnShowStyleEndFrom: RundownId[]
	rundownsToShowStyles: ReadonlyMap<RundownId, ShowStyleBaseId>
	orderedAllParts: PartId[]
	nextPartIsAfterCurrentPart: boolean
	currentPartInstance: PartInstance | undefined
	currentSegment: Pick<DBSegment, '_id' | 'orphaned'> | undefined
	currentPartInstancePieceInstances: PieceInstance[] | undefined
	allowTestingAdlibsToPersist: boolean
	accessors: Pick<StateCacheResolverDataAccess, 'piecesFind' | 'pieceInstancesFind'>
	options?: GetPieceInstancesForPartInstanceOptions
}

/** UI wrapper friendly context for `getResolvedSegment` (without injected accessors/options). */
export type ResolvedSegmentContext = Omit<GetResolvedSegmentParams, 'accessors' | 'options'>
/** UI wrapper friendly options for `getResolvedSegment`. */
export type ResolvedSegmentWrapperOptions = Pick<GetResolvedSegmentOptions, 'includeDisabledPieces'> & {
	pieceInstanceSimulation?: boolean
}

/** UI wrapper friendly params for `getSegmentsWithPartInstances` (playlist is passed separately). */
export type SegmentsWithPartInstancesWrapperParams = Omit<GetSegmentsWithPartInstancesParams, 'playlist' | 'accessors'>

/** UI wrapper friendly context for `getPieceInstancesForPartInstance` (without injected accessors/options). */
export type PieceInstancesForPartInstanceContext = Omit<GetPieceInstancesForPartInstanceParams, 'accessors' | 'options'>
/** UI wrapper friendly options for `getPieceInstancesForPartInstance`. */
export type PieceInstancesForPartInstanceWrapperOptions = Omit<
	GetPieceInstancesForPartInstanceOptions,
	'getCurrentTime' | 'invalidateAfter'
> & {
	pieceInstanceSimulation?: boolean
}
