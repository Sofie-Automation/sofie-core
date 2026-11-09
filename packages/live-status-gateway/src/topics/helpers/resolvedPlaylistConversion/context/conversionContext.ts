import { unprotectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import { mongoWhereFilter } from '@sofie-automation/corelib/dist/mongo'
import { groupByToMap, groupByToMapFunc } from '@sofie-automation/corelib/dist/lib'
import type { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist/RundownPlaylist'
import type { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import type { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import type { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import type { PartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import type { Piece } from '@sofie-automation/corelib/dist/dataModel/Piece'
import type { PieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import type { StateCacheResolverDataAccess } from '@sofie-automation/corelib/dist/playout/stateCacheResolverTypes'
import { PartId, RundownId, SegmentId, ShowStyleBaseId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { PieceLifespan } from '@sofie-automation/blueprints-integration'
import { ShowStyleBaseExt } from '../../../../collections/showStyleBaseHandler.js'

type PlaylistState = Pick<
	DBRundownPlaylist,
	| '_id'
	| 'studioId'
	| 'created'
	| 'modified'
	| 'externalId'
	| 'activationId'
	| 'rehearsal'
	| 'name'
	| 'rundownIdsInOrder'
	| 'quickLoop'
	| 'defaultBrandingId'
	| 'currentPartInfo'
	| 'nextPartInfo'
	| 'previousPartsInfo'
	| 'publicData'
	| 'publicPlayoutPersistentState'
	| 'timing'
	| 'startedPlayback'
	| 'tTimers'
>

export type ToResolvedPlaylistStatusProps = {
	playlistState: PlaylistState | undefined
	rundownsState: DBRundown[]
	showStyleBaseExtState: ShowStyleBaseExt | undefined
	showStyleBaseExtsByIdState?: ReadonlyMap<ShowStyleBaseId, ShowStyleBaseExt>
	segmentsState: DBSegment[]
	partsState: DBPart[]
	partInstancesInPlaylistState: PartInstance[]
	piecesInPlaylistState: Piece[]
	pieceInstancesInPlaylistState: PieceInstance[]
}

export type ResolvedPlaylistConversionContext = Readonly<{
	playlist: PlaylistState
	rundownsById: Map<string, DBRundown>
	showStyleBaseExt: ShowStyleBaseExt

	rundownsToShowStyles: ReadonlyMap<RundownId, ShowStyleBaseId>
	rundownsToShowStyleBaseExt: ReadonlyMap<RundownId, ShowStyleBaseExt>
	orderedRundownIds: string[]

	segmentsByRundownId: Map<string, DBSegment[]>
	partsByRundownId: Map<string, DBPart[]>

	currentPartInstance: PartInstance | undefined
	nextPartInstance: PartInstance | undefined

	accessors: ReturnType<typeof createQueryAdapters>

	/** Values derived per Rundown, filled on first use as they are needed once for every Segment in the Rundown */
	perRundownCache: Map<string, PerRundownCache>
}>

interface PerRundownCache {
	orderedPartIds?: PartId[]
	segmentIds?: Set<SegmentId>
}

/**
 * Creates a normalized lookup context used by all resolved-playlist converters.
 * This keeps conversion functions deterministic and avoids repeated map/filter work.
 */
export function createResolvedPlaylistConversionContext(
	props: ToResolvedPlaylistStatusProps
): ResolvedPlaylistConversionContext {
	const playlist = props.playlistState
	const showStyleBaseExt = props.showStyleBaseExtState

	if (!playlist || !showStyleBaseExt) {
		throw new Error('Missing playlist or showStyleBaseExt')
	}

	const orderedRundownIds = (playlist.rundownIdsInOrder ?? []).map((r) => unprotectString(r))
	const rundownsById = new Map<string, DBRundown>((props.rundownsState ?? []).map((r) => [unprotectString(r._id), r]))
	const rundownsToShowStyles = new Map<RundownId, ShowStyleBaseId>()
	const rundownsToShowStyleBaseExt = new Map<RundownId, ShowStyleBaseExt>()
	for (const rundownId of playlist.rundownIdsInOrder ?? []) {
		const rundown = rundownsById.get(unprotectString(rundownId))
		if (!rundown) continue
		rundownsToShowStyles.set(rundownId, rundown.showStyleBaseId)
		const showStyle = props.showStyleBaseExtsByIdState?.get(rundown.showStyleBaseId)
		if (showStyle) rundownsToShowStyleBaseExt.set(rundownId, showStyle)
	}

	const segmentsByRundownId = groupByToMapFunc(props.segmentsState, (s) => unprotectString(s.rundownId))
	const partsByRundownId = groupByToMapFunc(props.partsState, (p) => unprotectString(p.rundownId))

	const currentPartInstance = findCurrentPartInstance(playlist, props.partInstancesInPlaylistState)
	const nextPartInstance = findNextPartInstance(playlist, props.partInstancesInPlaylistState)

	const accessors = createQueryAdapters({
		segmentsState: props.segmentsState,
		partsState: props.partsState,
		partInstancesInPlaylistState: props.partInstancesInPlaylistState,
		piecesInPlaylistState: props.piecesInPlaylistState,
		pieceInstancesInPlaylistState: props.pieceInstancesInPlaylistState,
	})

	return {
		playlist,
		rundownsById,
		showStyleBaseExt,
		rundownsToShowStyles,
		rundownsToShowStyleBaseExt,
		orderedRundownIds,
		segmentsByRundownId,
		partsByRundownId,
		currentPartInstance,
		nextPartInstance,
		accessors,
		perRundownCache: new Map(),
	}
}

function getPerRundownCache(ctx: ResolvedPlaylistConversionContext, rundownId: string): PerRundownCache {
	let cache = ctx.perRundownCache.get(rundownId)
	if (!cache) {
		cache = {}
		ctx.perRundownCache.set(rundownId, cache)
	}
	return cache
}

/** The ids of the parts in the rundown, in rundown order. Computed once per rundown. */
export function getOrderedPartIdsInRundown(ctx: ResolvedPlaylistConversionContext, rundownId: string): PartId[] {
	const cache = getPerRundownCache(ctx, String(rundownId))
	cache.orderedPartIds ??= getOrderedPartsInRundown(ctx, rundownId).map((p) => p._id)
	return cache.orderedPartIds
}

/** The ids of all the segments in the rundown. Computed once per rundown. */
export function getSegmentIdsInRundown(ctx: ResolvedPlaylistConversionContext, rundownId: string): Set<SegmentId> {
	const cache = getPerRundownCache(ctx, String(rundownId))
	cache.segmentIds ??= new Set((ctx.segmentsByRundownId.get(String(rundownId)) ?? []).map((s) => s._id))
	return cache.segmentIds
}

/** Returns segments in rundown order so API consumers get stable ranks. */
export function getOrderedSegmentsInRundown(ctx: ResolvedPlaylistConversionContext, rundownId: string): DBSegment[] {
	const list = ctx.segmentsByRundownId.get(String(rundownId)) ?? []
	return list.slice().sort((a, b) => a._rank - b._rank)
}

/** Returns parts in rundown order for state resolver and API output parity. */
export function getOrderedPartsInRundown(ctx: ResolvedPlaylistConversionContext, rundownId: string): DBPart[] {
	const normalizedRundownId = String(rundownId)

	const partsInRundown = ctx.partsByRundownId.get(normalizedRundownId) ?? []
	if (partsInRundown.length === 0) return []

	// Part._rank is only meaningful within a segment, so we must preserve segment order.
	const partsBySegmentId = new Map<string, DBPart[]>()
	for (const part of partsInRundown) {
		const segmentId = String(part.segmentId)
		const list = partsBySegmentId.get(segmentId) ?? []
		list.push(part)
		partsBySegmentId.set(segmentId, list)
	}

	const orderedSegments = getOrderedSegmentsInRundown(ctx, normalizedRundownId)
	const orderedParts: DBPart[] = []
	for (const segment of orderedSegments) {
		const segmentParts = partsBySegmentId.get(String(segment._id))
		if (!segmentParts?.length) continue
		segmentParts.sort((a, b) => a._rank - b._rank)
		orderedParts.push(...segmentParts)
	}

	return orderedParts
}

/** Finds the current part instance referenced by playlist state. */
export function findCurrentPartInstance(
	playlist: PlaylistState,
	partInstancesInPlaylistState: PartInstance[]
): PartInstance | undefined {
	return partInstancesInPlaylistState.find((pi) => pi._id === playlist.currentPartInfo?.partInstanceId)
}

/** Finds the next part instance referenced by playlist state. */
export function findNextPartInstance(
	playlist: PlaylistState,
	partInstancesInPlaylistState: PartInstance[]
): PartInstance | undefined {
	return partInstancesInPlaylistState.find((pi) => pi._id === playlist.nextPartInfo?.partInstanceId)
}

/**
 * The value `selector` requires `key` to equal, when it is `{ [key]: value }` or `{ [key]: { $eq: value } }`.
 * Returns `undefined` for anything else, such as `$in`, or no condition on `key`.
 */
function getRequiredEqualValue(selector: unknown, key: string): string | number | undefined {
	let value = (selector as Record<string, any>)[key]
	// `{ $eq: value }` means the same as `value`, as long as `$eq` is the only operator
	if (value && typeof value === 'object' && Object.keys(value).length === 1) value = value.$eq
	return typeof value === 'string' || typeof value === 'number' ? value : undefined
}

/**
 * Find the documents matching `selector`, only looking at the bucket of `index` when the selector requires `key` to
 * equal a single value, and at all of them otherwise.
 * `key` must be a field which is never an array: `{ key: 'x' }` also matches a document where `key` is an array
 * containing `'x'`, which a bucket keyed on the raw value would miss.
 */
function findByIndex<T extends Record<string, any>>(
	allItems: readonly T[],
	index: ReadonlyMap<unknown, T[]>,
	selector: unknown,
	key: string
): T[] {
	const value = getRequiredEqualValue(selector, key)
	const candidates = value === undefined ? allItems : (index.get(value) ?? [])
	return mongoWhereFilter(candidates as T[], selector as never)
}

/**
 * Whether the selector is the query for the infinites which may continue into a part, as built by
 * `buildPastInfinitePiecesForThisPartQuery`. That is run for every part, and can only match Pieces with a lifespan
 * other than `WithinPart`.
 * It has `lifespan: { $in: [...] }` at the top level when there is one fragment, or in every branch of a top-level
 * `$or` when there are several. If that shape changes this stops recognising it, which only loses the speedup.
 */
function isInfinitesQuery(selector: unknown): boolean {
	if (!selector || typeof selector !== 'object') return false
	const { lifespan, $or } = selector as Record<string, unknown>

	const excludesWithinPart = (lifespanSelector: unknown) => {
		const $in = (lifespanSelector as { $in?: unknown } | undefined)?.$in
		return Array.isArray($in) && !$in.includes(PieceLifespan.WithinPart)
	}

	if (lifespan !== undefined) return excludesWithinPart(lifespan)
	return (
		Array.isArray($or) &&
		$or.length > 0 &&
		$or.every((fragment) => excludesWithinPart((fragment as Record<string, unknown> | undefined)?.lifespan))
	)
}

/**
 * The resolver looks documents up once per Segment and once per Part, so scanning the whole playlist for each lookup
 * makes the build quadratic. Index the collections by the field each lookup uses, and only run the selector against
 * the documents in the matching bucket.
 * The full selector is always applied to the narrowed set, so a selector of any other shape still gives the right
 * answer, just without the speedup.
 */
function createQueryAdapters({
	segmentsState,
	partsState,
	partInstancesInPlaylistState,
	piecesInPlaylistState,
	pieceInstancesInPlaylistState,
}: {
	segmentsState: DBSegment[]
	partsState: DBPart[]
	partInstancesInPlaylistState: PartInstance[]
	piecesInPlaylistState: Piece[]
	pieceInstancesInPlaylistState: PieceInstance[]
}): StateCacheResolverDataAccess {
	const segmentsById = groupByToMap(segmentsState, '_id')
	const partsBySegmentId = groupByToMap(partsState, 'segmentId')

	const activePartInstances = partInstancesInPlaylistState.filter((pi) => pi.reset !== true)
	const activePartInstancesBySegmentId = groupByToMap(activePartInstances, 'segmentId')

	const piecesByStartPartId = groupByToMap(piecesInPlaylistState, 'startPartId')
	/** Pieces which may continue beyond the Part they start in. Usually a small fraction of all Pieces */
	const infinitePieces = piecesInPlaylistState.filter((p) => p.lifespan !== PieceLifespan.WithinPart)

	const pieceInstancesByPartInstanceId = groupByToMap(pieceInstancesInPlaylistState, 'partInstanceId')

	// Adapter surface expected by `getResolvedSegment`
	return {
		segmentsFindOne: (selector, _options): DBSegment | undefined => {
			if (!selector) return undefined
			if (typeof selector === 'string') return segmentsById.get(selector)?.[0]

			return findByIndex(segmentsState, segmentsById, selector, '_id')[0]
		},
		getSegmentsAndPartsSync: (playlistPick, segmentsQuery, partsQuery) => {
			const rundownIdSet = new Set(playlistPick.rundownIdsInOrder ?? [])

			const segments = segmentsQuery
				? findByIndex(segmentsState, segmentsById, segmentsQuery, '_id')
				: segmentsState
			const parts = partsQuery ? findByIndex(partsState, partsBySegmentId, partsQuery, 'segmentId') : partsState

			return {
				segments: segments.filter((s) => rundownIdSet.has(s.rundownId)),
				parts: parts.filter((p) => rundownIdSet.has(p.rundownId)),
			}
		},
		getActivePartInstances: (_playlistPick: Pick<DBRundownPlaylist, '_id'>, selector?: unknown) => {
			if (!selector) return activePartInstances.slice()
			// The reset check always wins over anything the selector says about `reset`
			const mergedSelector = { ...(selector as any), reset: { $ne: true } }
			return findByIndex(activePartInstances, activePartInstancesBySegmentId, mergedSelector, 'segmentId')
		},
		piecesFind: (selector) => {
			if (!selector) return piecesInPlaylistState
			if (typeof selector === 'string') return piecesInPlaylistState.filter((p) => p._id === selector)

			if (isInfinitesQuery(selector)) return mongoWhereFilter(infinitePieces, selector)
			return findByIndex(piecesInPlaylistState, piecesByStartPartId, selector, 'startPartId')
		},
		pieceInstancesFind: (selector) => {
			if (!selector) return pieceInstancesInPlaylistState
			if (typeof selector === 'string') return pieceInstancesInPlaylistState.filter((p) => p._id === selector)

			return findByIndex(
				pieceInstancesInPlaylistState,
				pieceInstancesByPartInstanceId,
				selector,
				'partInstanceId'
			)
		},
	}
}
