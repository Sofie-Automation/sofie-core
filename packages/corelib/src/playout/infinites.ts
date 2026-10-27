import { Piece } from '../dataModel/Piece.js'
import { DBPart } from '../dataModel/Part.js'
import {
	PartId,
	PartInstanceId,
	PieceId,
	RundownId,
	RundownPlaylistActivationId,
	SegmentId,
	ShowStyleBaseId,
} from '../dataModel/Ids.js'
import { PieceInstance, PieceInstancePiece, rewrapPieceToInstance } from '../dataModel/PieceInstance.js'
import { DBPartInstance } from '../dataModel/PartInstance.js'
import { DBRundown } from '../dataModel/Rundown.js'
import { ReadonlyDeep } from 'type-fest'
import { clone, getRandomId } from '../lib.js'
import { protectString } from '../protectedString.js'
import _ from 'underscore'
import { MongoQuery } from '../mongo.js'
import { DBSegment, SegmentOrphanedReason } from '../dataModel/Segment.js'
import { PieceLifespan } from './pieceLifespan.js'

/*
 * Infinites
 *
 * An infinite is a Piece whose lifespan reaches beyond the Part it starts in. Which infinites continue into a Part is
 * found by replaying the pieces on each source layer, in playout order, up to that Part:
 *  - A piece starting on a layer stops every active infinite on it that stops in shadow (`inShadow: 'stop'`).
 *  - A piece that persists in shadow replaces an active one of the same scope, and covers broader ones until it ends.
 *  - What is still active at the end, and whose scope reaches the Part, is continued into it.
 *
 * The planned Pieces before the Part are replayed first. The PartInstance on air is replayed on top of that, as it
 * holds what really happened: the infinites that follow the playhead, adlibs, and anything that was stopped.
 */

/** Where a Part is in the Playlist, which decides what it can receive infinites from */
export interface PartPosition {
	/** The Parts before this one in the same Segment */
	partIdsBefore: ReadonlySet<PartId>
	/** The Segments before this one in the same Rundown */
	segmentIdsBefore: ReadonlySet<SegmentId>
	/** The Rundowns before this one in the Playlist, in order */
	rundownIdsBefore: readonly RundownId[]
	/** The ShowStyleBase of each Rundown in the Playlist */
	rundownShowStyles: ReadonlyMap<RundownId, ShowStyleBaseId>
	/** All the Parts in the Playlist, in order */
	orderedPartIds: readonly PartId[]
}

/** The PartInstance on air, when a Part is being prepared to follow it */
export interface PlayingPartInstance {
	partInstance: ReadonlyDeep<DBPartInstance>
	segment: ReadonlyDeep<Pick<DBSegment, '_id' | 'orphaned'>>
	pieceInstances: ReadonlyDeep<PieceInstance[]>
	/** Whether the Part being prepared comes after the playing one, so the playhead is moving forwards */
	isBeforeTarget: boolean
}

export interface PieceInstancesForPartParams {
	playlistActivationId: RundownPlaylistActivationId
	rundown: ReadonlyDeep<Pick<DBRundown, '_id' | 'showStyleBaseId'>>
	segment: ReadonlyDeep<Pick<DBSegment, '_id' | 'orphaned'>>
	part: ReadonlyDeep<DBPart>
	position: PartPosition
	/**
	 * The Pieces starting in the Part, and the Pieces before it which may continue into it, or stop one that would.
	 * See `buildPastInfinitePiecesForThisPartQuery` and `buildPastPiecesOnLayersForThisPartQuery`
	 */
	pieces: readonly ReadonlyDeep<Piece>[]
	playing: PlayingPartInstance | undefined
	/** Id of the PartInstance being created */
	newInstanceId: PartInstanceId
	/**
	 * Whether this predicts a PartInstance further ahead, rather than creating the next one.
	 * The playhead is then expected to travel through every planned Part between the playing one and this one, so
	 * their pieces can cover the infinites following it.
	 */
	isTemporary: boolean
	allowTestingAdlibsToPersist: boolean
}

export function buildPiecesStartingInThisPartQuery(part: ReadonlyDeep<DBPart>): MongoQuery<Piece> {
	return { startPartId: part._id }
}

/** Query the Pieces before a Part which could be continued into it */
export function buildPastInfinitePiecesForThisPartQuery(
	part: ReadonlyDeep<DBPart>,
	partIdsBefore: PartId[],
	segmentIdsBefore: SegmentId[],
	rundownIdsBefore: RundownId[]
): MongoQuery<Piece> | null {
	return wrapPastPiecesQuery(part, [
		partIdsBefore.length > 0
			? {
					// same segment, and previous part
					'lifespan.scope': { $in: ['segment', 'rundown', 'showstyle', 'playlist'] },
					startRundownId: part.rundownId,
					startSegmentId: part.segmentId,
					startPartId: { $in: partIdsBefore },
				}
			: undefined,
		segmentIdsBefore.length > 0
			? {
					// same rundown, and previous segment
					'lifespan.scope': { $in: ['rundown', 'showstyle', 'playlist'] },
					startRundownId: part.rundownId,
					startSegmentId: { $in: segmentIdsBefore },
				}
			: undefined,
		rundownIdsBefore.length > 0
			? {
					// previous rundown
					'lifespan.scope': { $in: ['showstyle', 'playlist'] },
					startRundownId: { $in: rundownIdsBefore },
				}
			: undefined,
	])
}

/** Query all the Pieces before a Part on some source layers, as any of them could stop an infinite on that layer */
export function buildPastPiecesOnLayersForThisPartQuery(
	part: ReadonlyDeep<DBPart>,
	partIdsBefore: PartId[],
	segmentIdsBefore: SegmentId[],
	rundownIdsBefore: RundownId[],
	sourceLayerIds: string[]
): MongoQuery<Piece> | null {
	if (sourceLayerIds.length === 0) return null

	const query = wrapPastPiecesQuery(part, [
		partIdsBefore.length > 0
			? {
					startRundownId: part.rundownId,
					startSegmentId: part.segmentId,
					startPartId: { $in: partIdsBefore },
				}
			: undefined,
		segmentIdsBefore.length > 0
			? {
					startRundownId: part.rundownId,
					startSegmentId: { $in: segmentIdsBefore },
				}
			: undefined,
		rundownIdsBefore.length > 0 ? { startRundownId: { $in: rundownIdsBefore } } : undefined,
	])
	return query && { ...query, sourceLayerId: { $in: sourceLayerIds } }
}

function wrapPastPiecesQuery(
	part: ReadonlyDeep<DBPart>,
	fragments: Array<MongoQuery<Piece> | undefined>
): MongoQuery<Piece> | null {
	const validFragments = _.compact(fragments)
	if (validFragments.length === 0) return null

	const baseQuery: MongoQuery<Piece> = {
		invalid: { $ne: true },
		startPartId: { $ne: part._id },
	}

	if (validFragments.length === 1) {
		return { ...baseQuery, ...validFragments[0] }
	} else {
		return { ...baseQuery, $or: validFragments }
	}
}

/**
 * Create the PieceInstances for a new PartInstance: the Pieces starting in the Part, and the infinites continuing into it
 */
export function getPieceInstancesForPart(params: PieceInstancesForPartParams): PieceInstance[] {
	const ownPieces = params.pieces.filter((p) => p.startPartId === params.part._id)

	return ownPieces.map((p) => wrapPlannedPiece(params, p)).concat(getContinuedInfinitesForPart(params))
}

/**
 * Create the PieceInstances for the infinites continuing into a new PartInstance
 */
export function getContinuedInfinitesForPart(params: PieceInstancesForPartParams): PieceInstance[] {
	const { planned, live } = resolveContinuedInfinites(params)

	const liveIds = new Set(live.map((p) => p.piece._id))
	const plannedByPriority = _.sortBy(
		planned.filter((p) => !liveIds.has(p._id)),
		(p) => PieceLifespan.from(p.lifespan).stackingPriority
	)

	return [
		...live.map((p) => wrapLivePieceInstance(params, p)),
		...plannedByPriority.map((p) => wrapPlannedPiece(params, p)),
	]
}

interface ActiveInfinites {
	/** Planned Pieces still active on a layer */
	planned: ReadonlyDeep<Piece>[]
	/** PieceInstances from the playing PartInstance still active on a layer */
	live: ReadonlyDeep<PieceInstance>[]
}

function resolveContinuedInfinites(params: PieceInstancesForPartParams): {
	planned: ReadonlyDeep<Piece>[]
	live: ReadonlyDeep<PieceInstance>[]
} {
	const layers = new Map<string, ActiveInfinites>()
	const getLayer = (sourceLayerId: string): ActiveInfinites => {
		let layer = layers.get(sourceLayerId)
		if (!layer) {
			layer = { planned: [], live: [] }
			layers.set(sourceLayerId, layer)
		}
		return layer
	}

	const replayPlayingPartInstance = (playing: PlayingPartInstance, isOnPath: boolean) => {
		for (const instance of getPieceInstancesInOrder(playing.pieceInstances)) {
			const layer = getLayer(instance.piece.sourceLayerId)
			const lifespan = PieceLifespan.from(instance.piece.lifespan)
			const isStopped = !!instance.plannedStoppedPlayback || !!instance.userDuration
			const isOpenEnded = !instance.userDuration && typeof instance.piece.enable.duration !== 'number'
			const isAdlib = instance.dynamicallyInserted !== undefined
			const isUnplanned = isAdlib || instance.dynamicallyConvertedToInfinite !== undefined
			// Infinites following the playhead always continue from here. Adlibbed ones only when moving forwards,
			// the planned ones continue from the plan instead
			const continuesFromHere =
				!isStopped &&
				lifespan.isInfinite &&
				(lifespan.tracksPlayhead || (playing.isBeforeTarget && isUnplanned))

			if (instance.infinite?.fromPreviousPart) {
				// A continuation doesn't start anything new on the layer, but it may have been stopped
				if (isStopped) {
					layer.planned = layer.planned.filter((p) => p._id !== instance.piece._id)
					layer.live = layer.live.filter((p) => p.piece._id !== instance.piece._id)
				} else if (continuesFromHere) {
					layer.live.push(instance)
				}
				continue
			}

			layer.live = stopShadowedInfinites(layer.live, (p) => p.piece.lifespan, lifespan, isOpenEnded)

			// The planned Pieces of the playing Part are replayed with the plan, but an adlib changes the plan
			if (isOnPath && isAdlib) {
				layer.planned = stopShadowedInfinites(layer.planned, (p) => p.lifespan, lifespan, isOpenEnded)
			}

			if (continuesFromHere) layer.live.push(instance)
		}
	}

	const playing = params.playing && !crossesAdlibTestingBoundary(params, params.playing) ? params.playing : undefined
	// The playing PartInstance is replayed where it is in the playlist, or after everything if it is elsewhere
	const playingPartIndex = playing ? getPlayingPartIndex(params, playing) : undefined
	let hasReplayedPlaying = false

	// Replay the planned Pieces before the Part
	for (const { piece, partIndex } of getPlannedPiecesBeforePartInOrder(params)) {
		if (playing && !hasReplayedPlaying && playingPartIndex !== undefined && partIndex > playingPartIndex) {
			replayPlayingPartInstance(playing, true)
			hasReplayedPlaying = true
		}

		const layer = getLayer(piece.sourceLayerId)
		const lifespan = PieceLifespan.from(piece.lifespan)

		// When predicting, the playhead will travel through the planned Parts after the playing one. Otherwise the Parts
		// between it and this one are skipped
		const playheadTravelsThrough = params.isTemporary && hasReplayedPlaying

		const isOpenEnded = typeof piece.enable.duration !== 'number'
		layer.planned = stopShadowedInfinites(layer.planned, (p) => p.lifespan, lifespan, isOpenEnded)
		if (hasReplayedPlaying && playheadTravelsThrough) {
			layer.live = stopShadowedInfinites(layer.live, (p) => p.piece.lifespan, lifespan, isOpenEnded)
		}

		// Only forward scoped infinites continue from the plan. One following the playhead becomes an infinite once the
		// playhead has passed it, and then continues from the playing PartInstance.
		// One with a duration ends there, except the legacy presets, which used to continue regardless
		const continues = isOpenEnded || lifespan.isEndedByNewerOfSameScope
		if (lifespan.isInfinite && lifespan.isStatic && continues) layer.planned.push(piece)
	}

	if (playing && !hasReplayedPlaying) {
		replayPlayingPartInstance(playing, playingPartIndex !== undefined)
	}

	const allLayers = Array.from(layers.values())
	return {
		planned: allLayers.flatMap((l) => l.planned).filter((p) => isPlannedPieceInScope(params, p)),
		live: playing
			? allLayers
					.flatMap((l) => l.live)
					.filter((p) => isPlayingPieceInScope(params, playing, PieceLifespan.from(p.piece.lifespan)))
			: [],
	}
}

/**
 * A new piece on a layer stops the infinites that stop in shadow. When it persists in shadow, it also ends the ones of
 * its own scope if it has no end, or if they are `legacy-persist`. Otherwise they resume once the new piece ends.
 */
function stopShadowedInfinites<T>(
	active: T[],
	getLifespan: (entry: T) => ReadonlyDeep<Piece['lifespan']>,
	newLifespan: PieceLifespan,
	newIsOpenEnded: boolean
): T[] {
	return active.filter((entry) => {
		const lifespan = PieceLifespan.from(getLifespan(entry))
		if (!lifespan.persistsInShadow) return false

		const isSameScope = newLifespan.persistsInShadow && newLifespan.scope === lifespan.scope
		return !isSameScope || (!newIsOpenEnded && !lifespan.isEndedByNewerOfSameScope)
	})
}

function getPartIndices(params: PieceInstancesForPartParams): Map<PartId, number> {
	const partIndices = new Map<PartId, number>()
	params.position.orderedPartIds.forEach((id, index) => partIndices.set(id, index))
	return partIndices
}

/** Where the playing PartInstance is in the planned Parts before the Part, if it is one of them */
function getPlayingPartIndex(params: PieceInstancesForPartParams, playing: PlayingPartInstance): number | undefined {
	const { position } = params
	const { partInstance } = playing

	const isBeforePart =
		position.partIdsBefore.has(partInstance.part._id) ||
		position.segmentIdsBefore.has(partInstance.segmentId) ||
		position.rundownIdsBefore.includes(partInstance.rundownId)
	if (!isBeforePart) return undefined

	return getPartIndices(params).get(partInstance.part._id)
}

function getPlannedPiecesBeforePartInOrder(
	params: PieceInstancesForPartParams
): Array<{ piece: ReadonlyDeep<Piece>; partIndex: number }> {
	const { part, position } = params
	const partIndices = getPartIndices(params)

	const piecesBefore = params.pieces.filter(
		(p) =>
			!p.invalid &&
			!!p.startPartId &&
			p.startPartId !== part._id &&
			(position.partIdsBefore.has(p.startPartId) ||
				(!!p.startSegmentId && position.segmentIdsBefore.has(p.startSegmentId)) ||
				position.rundownIdsBefore.includes(p.startRundownId))
	)

	return piecesBefore
		.map((piece) => ({ piece, partIndex: (piece.startPartId && partIndices.get(piece.startPartId)) ?? -1 }))
		.sort((a, b) => a.partIndex - b.partIndex || compareStarts(a.piece.enable.start, b.piece.enable.start))
}

function getPieceInstancesInOrder(pieceInstances: ReadonlyDeep<PieceInstance[]>): ReadonlyDeep<PieceInstance>[] {
	return [...pieceInstances].sort(
		(a, b) =>
			compareStarts(a.piece.enable.start, b.piece.enable.start) ||
			// Continuations were on the layer before anything starting at the same time
			(b.infinite?.fromPreviousPart ? 1 : 0) - (a.infinite?.fromPreviousPart ? 1 : 0) ||
			// Adlibs starting 'now' are ordered by when they were inserted
			(a.dynamicallyInserted ?? 0) - (b.dynamicallyInserted ?? 0)
	)
}

/** Order piece starts, with 'now' being after any planned time */
function compareStarts(a: number | 'now', b: number | 'now'): number {
	if (a === 'now') return b === 'now' ? 0 : 1
	if (b === 'now') return -1
	return a - b
}

function isPlannedPieceInScope(params: PieceInstancesForPartParams, piece: ReadonlyDeep<Piece>): boolean {
	switch (PieceLifespan.from(piece.lifespan).scope) {
		case 'part':
			return false
		case 'segment':
			return piece.startSegmentId === params.part.segmentId
		case 'rundown':
			return piece.startRundownId === params.part.rundownId
		case 'showstyle':
			return isShowStyleContinuous(params, piece.startRundownId)
		case 'playlist':
			return true
	}
}

/** An infinite on air has been continued up to the playing Part, so only the step from there to the target matters */
function isPlayingPieceInScope(
	params: PieceInstancesForPartParams,
	playing: PlayingPartInstance,
	lifespan: PieceLifespan
): boolean {
	switch (lifespan.scope) {
		case 'part':
			return false
		case 'segment':
			return playing.partInstance.segmentId === params.part.segmentId
		case 'rundown':
			return playing.partInstance.rundownId === params.part.rundownId
		case 'showstyle':
			return isShowStyleContinuous(params, playing.partInstance.rundownId)
		case 'playlist':
			return true
	}
}

/** Whether the ShowStyle stays the same from a Rundown up to the target Part */
function isShowStyleContinuous(params: PieceInstancesForPartParams, fromRundownId: RundownId): boolean {
	const { rundown, position } = params
	if (fromRundownId === rundown._id) return true

	const fromIndex = position.rundownIdsBefore.indexOf(fromRundownId)
	if (fromIndex === -1) return false

	return position.rundownIdsBefore
		.slice(fromIndex)
		.every((id) => position.rundownShowStyles.get(id) === rundown.showStyleBaseId)
}

/** Infinites don't cross the boundary of the AdlibTesting segment, unless the studio allows it */
function crossesAdlibTestingBoundary(params: PieceInstancesForPartParams, playing: PlayingPartInstance): boolean {
	return (
		!params.allowTestingAdlibsToPersist &&
		params.segment._id !== playing.segment._id &&
		(params.segment.orphaned === SegmentOrphanedReason.ADLIB_TESTING ||
			playing.segment.orphaned === SegmentOrphanedReason.ADLIB_TESTING)
	)
}

function wrapPlannedPiece(params: PieceInstancesForPartParams, piece: ReadonlyDeep<Piece>): PieceInstance {
	const { part, playing } = params

	const instance = rewrapPieceToInstance(
		clone<PieceInstancePiece>(piece as ReadonlyDeep<PieceInstancePiece>),
		params.playlistActivationId,
		part.rundownId,
		params.newInstanceId,
		params.isTemporary
	)

	if (PieceLifespan.from(instance.piece.lifespan).isInfinite) {
		const existingInstance = playing?.isBeforeTarget ? findPlayingInstanceOfPiece(playing, piece._id) : undefined
		instance.infinite = {
			infiniteInstanceId: existingInstance?.infinite?.infiniteInstanceId ?? getRandomId(),
			infiniteInstanceIndex: (existingInstance?.infinite?.infiniteInstanceIndex ?? -1) + 1,
			infinitePieceId: instance.piece._id,
			fromPreviousPart: instance.piece.startPartId !== part._id,
		}

		if (existingInstance && (instance.infinite.fromPreviousPart || instance.dynamicallyInserted)) {
			// If it doesnt start in this part, then mark it as a continuation
			markPieceInstanceAsContinuation(existingInstance, instance)
		}

		if (instance.infinite.fromPreviousPart) {
			// If this is not the start point, it should start at 0
			// Note: this should not be setting fromPreviousPlayhead, as it is not from the playhead
			instance.piece = { ...instance.piece, enable: { start: 0 } }
		}
	}

	return instance
}

function wrapLivePieceInstance(
	params: PieceInstancesForPartParams,
	previousInstance: ReadonlyDeep<PieceInstance>
): PieceInstance {
	const instance = rewrapPieceToInstance(
		previousInstance.piece as PieceInstancePiece,
		params.playlistActivationId,
		params.part.rundownId,
		params.newInstanceId,
		params.isTemporary
	)
	markPieceInstanceAsContinuation(previousInstance, instance)

	if (!instance.piece.enable.isAbsolute) {
		// This was copied from before, so we know we can force the time to 0
		instance.piece = { ...instance.piece, enable: { start: 0 } }
	}

	instance.infinite = {
		infiniteInstanceId: previousInstance.infinite?.infiniteInstanceId ?? getRandomId(),
		infiniteInstanceIndex: (previousInstance.infinite?.infiniteInstanceIndex ?? -1) + 1,
		infinitePieceId: previousInstance.infinite?.infinitePieceId ?? instance.piece._id,
		fromPreviousPart: true,
		fromPreviousPlayhead: true,
	}

	return instance
}

function findPlayingInstanceOfPiece(
	playing: PlayingPartInstance,
	pieceId: PieceId
): ReadonlyDeep<PieceInstance> | undefined {
	return playing.pieceInstances.find((p) => p.infinite?.infinitePieceId === pieceId)
}

function markPieceInstanceAsContinuation(previousInstance: ReadonlyDeep<PieceInstance>, instance: PieceInstance) {
	instance._id = protectString(`${instance._id}_continue`)
	instance.dynamicallyInserted = previousInstance.dynamicallyInserted
	instance.dynamicallyConvertedToInfinite = previousInstance.dynamicallyConvertedToInfinite
	instance.adLibSourceId = previousInstance.adLibSourceId
	instance.reportedStartedPlayback = previousInstance.reportedStartedPlayback
	instance.plannedStartedPlayback = previousInstance.plannedStartedPlayback
}

export function isCandidateMoreImportant(
	best: ReadonlyDeep<PieceInstance>,
	candidate: ReadonlyDeep<PieceInstance>
): boolean | undefined {
	// If one is absolute timed, prefer that
	if (best.piece.enable.isAbsolute && !candidate.piece.enable.isAbsolute) {
		// Prefer the absolute best
		return false
	}
	if (!best.piece.enable.isAbsolute && candidate.piece.enable.isAbsolute) {
		// Prefer the absolute candidate
		return true
	}

	// Prioritise the one from this part over previous part
	if (best.infinite?.fromPreviousPart && !candidate.infinite?.fromPreviousPart) {
		// Prefer the candidate as it is not from previous
		return true
	}
	if (!best.infinite?.fromPreviousPart && candidate.infinite?.fromPreviousPart) {
		// Prefer the best as it is not from previous
		return false
	}

	// If we have adlibs, prefer the newest
	if (best.dynamicallyInserted && candidate.dynamicallyInserted) {
		// prefer the one which starts later
		return best.dynamicallyInserted < candidate.dynamicallyInserted
	} else if (best.dynamicallyInserted) {
		// Prefer the adlib
		return false
	} else if (candidate.dynamicallyInserted) {
		// Prefer the adlib
		return true
	} else {
		// Neither are adlibs, try other things
	}

	// If one is virtual, prefer that
	if (best.piece.virtual && !candidate.piece.virtual) {
		// Prefer the virtual best
		return false
	}
	if (!best.piece.virtual && candidate.piece.virtual) {
		// Prefer the virtual candidate
		return true
	}

	return undefined
}

export function isCandidateBetterToBeContinued(
	best: ReadonlyDeep<PieceInstance>,
	candidate: ReadonlyDeep<PieceInstance>
): boolean {
	// Fallback to id, as we dont have any other criteria and this will be stable.
	// Note: we shouldnt even get here, as it shouldnt be possible for multiple to start at the same time, but it is possible
	return isCandidateMoreImportant(best, candidate) ?? best.piece._id < candidate.piece._id
}
