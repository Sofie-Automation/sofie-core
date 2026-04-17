import { unprotectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import { mongoWhereFilter } from '@sofie-automation/corelib/dist/mongo'
import type { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist/RundownPlaylist'
import type { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import type { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import type { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import type { PartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import type { Piece } from '@sofie-automation/corelib/dist/dataModel/Piece'
import type { PieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import type { StateCacheResolverDataAccess } from '@sofie-automation/corelib/dist/playout/stateCacheResolverTypes'
import { RundownId, ShowStyleBaseId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ShowStyleBaseExt } from '../../../../collections/showStyleBaseHandler.js'

export type ToResolvedPlaylistStatusProps = {
	playlistState: DBRundownPlaylist | undefined
	rundownsState: DBRundown[]
	showStyleBaseExtState: ShowStyleBaseExt | undefined
	segmentsState: DBSegment[]
	partsState: DBPart[]
	partInstancesInPlaylistState: PartInstance[]
	piecesInPlaylistState: Piece[]
	pieceInstancesInPlaylistState: PieceInstance[]
}

export type ResolvedPlaylistConversionContext = Readonly<{
	playlist: DBRundownPlaylist
	rundownsById: Map<string, DBRundown>
	showStyleBaseExt: ShowStyleBaseExt

	rundownsToShowStyles: ReadonlyMap<RundownId, ShowStyleBaseId>
	orderedRundownIds: string[]

	segmentsByRundownId: Map<string, DBSegment[]>
	partsByRundownId: Map<string, DBPart[]>

	currentPartInstance: PartInstance | undefined
	nextPartInstance: PartInstance | undefined

	accessors: ReturnType<typeof createQueryAdapters>
}>

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
	for (const rundownId of playlist.rundownIdsInOrder ?? []) {
		const rundown = rundownsById.get(unprotectString(rundownId))
		if (!rundown) continue
		rundownsToShowStyles.set(rundownId, rundown.showStyleBaseId)
	}

	const segmentsByRundownId = groupByRundownId(props.segmentsState)
	const partsByRundownId = groupByRundownId(props.partsState)

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
		orderedRundownIds,
		segmentsByRundownId,
		partsByRundownId,
		currentPartInstance,
		nextPartInstance,
		accessors,
	}
}

function groupByRundownId<T extends { rundownId: unknown }>(items: T[]): Map<string, T[]> {
	const map = new Map<string, T[]>()
	for (const item of items ?? []) {
		const rundownId = String(item.rundownId)
		const list = map.get(rundownId) ?? ([] as T[])
		list.push(item)
		map.set(rundownId, list)
	}
	return map
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
	playlist: DBRundownPlaylist,
	partInstancesInPlaylistState: PartInstance[]
): PartInstance | undefined {
	return partInstancesInPlaylistState.find((pi) => pi._id === playlist.currentPartInfo?.partInstanceId)
}

/** Finds the next part instance referenced by playlist state. */
export function findNextPartInstance(
	playlist: DBRundownPlaylist,
	partInstancesInPlaylistState: PartInstance[]
): PartInstance | undefined {
	return partInstancesInPlaylistState.find((pi) => pi._id === playlist.nextPartInfo?.partInstanceId)
}

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
	// Adapter surface expected by `getResolvedSegment`
	return {
		segmentsFindOne: (selector, _options): DBSegment | undefined => {
			const segmentId: DBSegment['_id'] | undefined =
				typeof selector === 'object' && selector !== null && '_id' in selector
					? (selector._id as DBSegment['_id'] | undefined)
					: (selector as DBSegment['_id'])
			if (!segmentId) return undefined
			const normalizedSelectorId = unprotectString(segmentId)
			return segmentsState.find((s) => unprotectString(s._id) === normalizedSelectorId)
		},
		getSegmentsAndPartsSync: (playlistPick, segmentsQuery, partsQuery) => {
			const rundownIds = new Set(playlistPick.rundownIdsInOrder ?? [])
			const segmentsInRundowns = segmentsState.filter((s) => rundownIds.has(s.rundownId))
			const partsInRundowns = partsState.filter((p) => rundownIds.has(p.rundownId))
			return {
				segments: segmentsQuery
					? mongoWhereFilter(segmentsInRundowns, segmentsQuery as never)
					: segmentsInRundowns,
				parts: partsQuery ? mongoWhereFilter(partsInRundowns, partsQuery as never) : partsInRundowns,
			}
		},
		getActivePartInstances: (_playlistPick: Pick<DBRundownPlaylist, '_id'>, selector?: unknown) => {
			const mergedSelector = selector ? { ...(selector as any), reset: { $ne: true } } : { reset: { $ne: true } }
			return mongoWhereFilter(partInstancesInPlaylistState, mergedSelector as never)
		},
		piecesFind: (selector) => {
			if (!selector) return piecesInPlaylistState
			if (typeof selector === 'string') return piecesInPlaylistState.filter((p) => p._id === selector)
			return mongoWhereFilter(piecesInPlaylistState, selector as never)
		},
		pieceInstancesFind: (selector) => {
			if (!selector) return pieceInstancesInPlaylistState
			if (typeof selector === 'string') return pieceInstancesInPlaylistState.filter((pi) => pi._id === selector)
			return mongoWhereFilter(pieceInstancesInPlaylistState, selector as never)
		},
	}
}
