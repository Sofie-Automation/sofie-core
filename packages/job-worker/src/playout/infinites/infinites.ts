import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { Piece } from '@sofie-automation/corelib/dist/dataModel/Piece'
import {
	PartId,
	PartInstanceId,
	PieceId,
	RundownId,
	RundownPlaylistActivationId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { JobContext } from '../../jobs/index.js'
import { ReadonlyDeep } from 'type-fest'
import { SegmentOrphanedReason } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { candidatePartIsAfterPreviewPartInstance } from './canContinue.js'
import { PlayoutModel } from '../model/PlayoutModel.js'
import { PlayoutPartInstanceModel } from '../model/PlayoutPartInstanceModel.js'
import { InfiniteLivePiece, InfinitePartInstance, InfinitePiece, InfinitePlaylist } from './interfaces.js'
import { PieceLifespan } from '@sofie-automation/corelib/dist/playout/pieceLifespan'
import {
	omitPiecePropertiesForInstance,
	PieceInstance,
	PieceInstancePiece,
	rewrapPieceToInstance,
} from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { SourceLayers } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { protectString, unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { getRandomId } from '@sofie-automation/corelib/dist/lib'
import { PartCurrentTimes, PieceInstanceWithTimings } from '@sofie-automation/corelib/dist/playout/processAndPrune'

export type PieceLookupDoc = ReadonlyDeep<Piece> | ReadonlyDeep<PieceInstancePiece>

export function resolveInfinites(
	context: JobContext,
	playoutModel: PlayoutModel,
	playlist: InfinitePlaylist,
	destinationPart: ReadonlyDeep<DBPart>,
	plannedPieces: ReadonlyDeep<Piece>[]
): InfiniteLivePiece[] {
	const treeInfinites = findForwardScopeInfinitesInPart(playlist, destinationPart)
	const consideredInfinites = unionTreeAndCurrent(context, playoutModel, playlist, destinationPart, treeInfinites)

	const destShowstyleId = playlist.rundowns.find((r) => r.id === destinationPart.rundownId)?.showstyleGroup
		.showstyleId
	const correctlyScopedInfinites = consideredInfinites.filter((infinite) =>
		isInfiniteInPartScope(infinite, destinationPart, destShowstyleId, playlist)
	)

	const destLocals = collectDestLocalPieces(destinationPart, plannedPieces, playoutModel)
	const mixed = mixDestLocals(correctlyScopedInfinites, destLocals)
	const destRelative = projectStartsToDest(mixed, destinationPart)

	return normalizeEndTimes(destRelative, buildPieceLookups(plannedPieces, playoutModel))
}

function collectDestLocalPieces(
	destinationPart: ReadonlyDeep<DBPart>,
	plannedPieces: ReadonlyDeep<Piece>[],
	playoutModel: PlayoutModel
): InfiniteLivePiece[] {
	const byId = new Map<InfinitePiece['id'], InfiniteLivePiece>()

	for (const piece of plannedPieces) {
		if (piece.startPartId !== destinationPart._id) continue
		byId.set(piece._id, {
			id: piece._id,
			enable: piece.enable,
			lifespan: new PieceLifespan(piece.lifespan),
		})
	}

	const next = playoutModel.nextPartInstance
	if (next && next.partInstance.part._id === destinationPart._id) {
		for (const wrapper of next.pieceInstances) {
			const instance = wrapper.pieceInstance
			const startsHere = !instance.piece.startPartId || instance.piece.startPartId === destinationPart._id
			if (!startsHere) continue
			if (instance.infinite?.fromPreviousPart || instance.infinite?.fromPreviousPlayhead) continue

			byId.set(instance.piece._id, {
				id: instance.piece._id,
				enable: instance.piece.enable,
				lifespan: new PieceLifespan(instance.piece.lifespan),
				dynamicallyInserted: instance.dynamicallyInserted !== undefined,
				dynamicallyConvertedToInfinite: instance.dynamicallyConvertedToInfinite !== undefined,
			})
		}
	}

	return [...byId.values()]
}

function mixDestLocals(scoped: InfiniteLivePiece[], destLocals: InfiniteLivePiece[]): InfiniteLivePiece[] {
	const byId = new Map<InfinitePiece['id'], InfiniteLivePiece>()
	for (const piece of scoped) {
		byId.set(piece.id, piece)
	}
	for (const piece of destLocals) {
		byId.set(piece.id, piece)
	}
	return [...byId.values()]
}

export function buildPieceLookups(
	plannedPieces: readonly ReadonlyDeep<Piece>[],
	playoutModel: PlayoutModel
): Map<PieceId, PieceLookupDoc> {
	const pieceById = new Map<PieceId, PieceLookupDoc>()

	for (const piece of plannedPieces) {
		pieceById.set(piece._id, piece)
	}

	for (const partInstance of playoutModel.loadedPartInstances) {
		for (const pieceInstance of partInstance.pieceInstances) {
			pieceById.set(pieceInstance.pieceInstance.piece._id, pieceInstance.pieceInstance.piece)
		}
	}

	return pieceById
}

function projectStartsToDest(pieces: InfiniteLivePiece[], destinationPart: ReadonlyDeep<DBPart>): InfiniteLivePiece[] {
	return pieces.map((piece) => {
		if (piece.enable.isAbsolute) return { ...piece }
		const startedOnDest = piece.part?.id === destinationPart._id
		if (startedOnDest || !piece.part) return { ...piece }
		return {
			...piece,
			enable: {
				...piece.enable,
				start: 0,
			},
		}
	})
}

function findForwardScopeInfinitesInPart(
	playlist: InfinitePlaylist,
	destinationPart: ReadonlyDeep<DBPart>
): InfiniteLivePiece[] {
	const rundown = playlist.rundowns.find((r) => r.id === destinationPart.rundownId)
	const segment = rundown?.segment(destinationPart.segmentId)
	const showstyleGroup = rundown?.showstyleGroup

	return [
		...playlist.scopedPieces,
		...(showstyleGroup?.scopedPieces ?? []),
		...(rundown?.scopedPieces ?? []),
		...(segment?.scopedPieces ?? []),
	]
}

function unionTreeAndCurrent(
	context: JobContext,
	playoutModel: PlayoutModel,
	playlist: InfinitePlaylist,
	destinationPart: ReadonlyDeep<DBPart>,
	tree: InfiniteLivePiece[]
): InfiniteLivePiece[] {
	const byId = new Map<InfinitePiece['id'], InfiniteLivePiece>()
	for (const piece of tree) {
		byId.set(piece.id, piece)
	}

	const current = playlist.live.current
	if (!current) return [...byId.values()]

	for (const piece of current.pieces) {
		if (byId.has(piece.id)) byId.set(piece.id, piece)
	}

	const canContinueFromCurrent =
		!crossesAdlibTestingBoundary(context, playoutModel, current, destinationPart) &&
		candidatePartIsAfterPreviewPartInstance(
			context,
			playoutModel.getAllOrderedSegments(),
			playoutModel.currentPartInstance?.partInstance,
			destinationPart
		)

	if (canContinueFromCurrent) {
		for (const piece of current.pieces) {
			if (isPlayheadOrAdlibOnEnd(piece) && !byId.has(piece.id)) byId.set(piece.id, piece)
		}
	}

	return [...byId.values()]
}

function isPlayheadOrAdlibOnEnd(piece: InfiniteLivePiece): boolean {
	if (piece.lifespan.tracksPlayhead) return true
	return (
		(piece.dynamicallyInserted === true || piece.dynamicallyConvertedToInfinite === true) &&
		piece.lifespan.isStatic &&
		piece.lifespan.persistsInShadow
	)
}

function isInfiniteInPartScope(
	infinite: InfiniteLivePiece,
	destinationPart: ReadonlyDeep<DBPart>,
	destShowstyleId: InfinitePlaylist['showstyleGroups'][number]['showstyleId'] | undefined,
	playlist: InfinitePlaylist
): boolean {
	const scope = infinite.lifespan.scope
	if (scope === 'playlist') return true

	const liveCurrent = playlist.live.current
	const startPart = infinite.part
	const startSegmentId = startPart?.segment.id ?? liveCurrent?.segmentId
	const startRundownId = startPart?.segment.rundown.id ?? liveCurrent?.rundownId
	const startShowstyleId =
		startPart?.segment.rundown.showstyleGroup.showstyleId ??
		(liveCurrent
			? playlist.rundowns.find((r) => r.id === liveCurrent.rundownId)?.showstyleGroup.showstyleId
			: undefined)

	switch (scope) {
		case 'part':
			return startPart?.id === destinationPart._id || liveCurrent?.partId === destinationPart._id
		case 'segment':
			return startSegmentId === destinationPart.segmentId
		case 'rundown':
			return startRundownId === destinationPart.rundownId
		case 'showstyle':
			return startShowstyleId !== undefined && startShowstyleId === destShowstyleId
		default:
			return false
	}
}

function crossesAdlibTestingBoundary(
	context: JobContext,
	playoutModel: PlayoutModel,
	current: InfinitePartInstance,
	destinationPart: ReadonlyDeep<DBPart>
): boolean {
	if (context.studio.settings.allowTestingAdlibsToPersist) return false

	const playingSegment = playoutModel.getRundown(current.rundownId)?.getSegment(current.segmentId)?.segment
	const intoSegment = playoutModel
		.getRundown(destinationPart.rundownId)
		?.getSegment(destinationPart.segmentId)?.segment

	if (!playingSegment || !intoSegment) return false
	if (playingSegment._id === intoSegment._id) return false

	return (
		playingSegment.orphaned === SegmentOrphanedReason.ADLIB_TESTING ||
		intoSegment.orphaned === SegmentOrphanedReason.ADLIB_TESTING
	)
}

function normalizeEndTimes(
	continued: InfiniteLivePiece[],
	piecesById: Map<PieceId, PieceLookupDoc>
): InfiniteLivePiece[] {
	const clonedInfinites = continued.map((piece) => ({ ...piece }))

	const byLayer = new Map<string, InfiniteLivePiece[]>()
	for (const infinite of clonedInfinites) {
		const lookup = piecesById.get(infinite.id)
		if (!lookup) continue

		const layerPieces = byLayer.get(lookup.sourceLayerId) ?? []
		layerPieces.push(infinite)
		byLayer.set(lookup.sourceLayerId, layerPieces)
	}

	for (const layerPieces of byLayer.values()) {
		layerPieces.sort((a, b) => startInPart(a) - startInPart(b))

		for (let i = 1; i < layerPieces.length; i++) {
			const laterStart = startInPart(layerPieces[i])
			for (let j = 0; j < i; j++) {
				const earlier = layerPieces[j]
				if (earlier.lifespan.inShadow !== 'stop') continue
				earlier.resolvedEndCap =
					earlier.resolvedEndCap === undefined ? laterStart : Math.min(earlier.resolvedEndCap, laterStart)
			}
		}
	}

	return clonedInfinites
}

function startInPart(piece: InfiniteLivePiece): number {
	return piece.enable.start === 'now' ? 0 : piece.enable.start
}

export function wrapForSave(args: {
	resolved: InfiniteLivePiece[]
	pieceById: Map<PieceId, PieceLookupDoc>
	playlistActivationId: RundownPlaylistActivationId
	destPartInstanceId: PartInstanceId
	destRundownId: RundownId
	destPartId: PartId
	playingPartInstance: PlayoutPartInstanceModel | null
}): PieceInstance[] {
	const {
		resolved,
		pieceById,
		playlistActivationId,
		destPartInstanceId,
		destRundownId,
		destPartId,
		playingPartInstance,
	} = args

	const playingByPieceId = new Map<PieceId, ReadonlyDeep<PieceInstance>>()
	for (const wrapper of playingPartInstance?.pieceInstances ?? []) {
		playingByPieceId.set(wrapper.pieceInstance.piece._id, wrapper.pieceInstance)
	}

	const out: PieceInstance[] = []
	for (const piece of resolved) {
		const doc = pieceById.get(piece.id)
		if (!doc) continue

		const instance = rewrapPieceToInstance(
			omitPiecePropertiesForInstance(doc as Piece | PieceInstancePiece),
			playlistActivationId,
			destRundownId,
			destPartInstanceId,
			false
		)

		const destLocal = !piece.part || piece.part.id === destPartId || doc.startPartId === destPartId
		const existing = playingByPieceId.get(piece.id)

		if (existing?.dynamicallyInserted !== undefined) instance.dynamicallyInserted = existing.dynamicallyInserted
		if (existing?.dynamicallyConvertedToInfinite !== undefined) {
			instance.dynamicallyConvertedToInfinite = existing.dynamicallyConvertedToInfinite
		}
		if (existing?.adLibSourceId) instance.adLibSourceId = existing.adLibSourceId

		if (piece.lifespan.scope !== 'part') {
			const continued = !destLocal
			instance.infinite = {
				infiniteInstanceId: existing?.infinite?.infiniteInstanceId ?? getRandomId(),
				infiniteInstanceIndex: (existing?.infinite?.infiniteInstanceIndex ?? -1) + 1,
				infinitePieceId: instance.piece._id,
				fromPreviousPart: continued,
				fromPreviousPlayhead: continued && isPlayheadOrAdlibOnEnd(piece),
			}

			if (existing && (continued || existing.dynamicallyInserted !== undefined)) {
				instance._id = protectString(`${unprotectString(instance._id)}_continue`)
				instance.reportedStartedPlayback = existing.reportedStartedPlayback
				instance.plannedStartedPlayback = existing.plannedStartedPlayback
			}

			if (continued) {
				instance.piece = {
					...instance.piece,
					enable: {
						...instance.piece.enable,
						start: 0,
					},
				}
			}
		}

		if (piece.resolvedEndCap !== undefined) {
			const start = instance.piece.enable.start === 'now' ? 0 : instance.piece.enable.start
			instance.piece = {
				...instance.piece,
				enable: {
					...instance.piece.enable,
					duration: piece.resolvedEndCap - start,
				},
			}
		}

		out.push(instance)
	}

	return out
}

export function flattenInstancesForTimeline(
	sourceLayers: SourceLayers,
	pieces: ReadonlyDeep<PieceInstance>[],
	partTimes: PartCurrentTimes
): PieceInstanceWithTimings[] {
	const byLayer = new Map<string, ReadonlyDeep<PieceInstance>[]>()
	for (const piece of pieces) {
		if (piece.disabled) continue
		const key = sourceLayers[piece.piece.sourceLayerId]?.exclusiveGroup || piece.piece.sourceLayerId
		const layerPieces = byLayer.get(key) ?? []
		layerPieces.push(piece)
		byLayer.set(key, layerPieces)
	}

	const out: PieceInstanceWithTimings[] = []
	for (const layerPieces of byLayer.values()) {
		layerPieces.sort((a, b) => instanceStartInPart(a, partTimes) - instanceStartInPart(b, partTimes))
		out.push(...flattenInstanceLayer(layerPieces, partTimes))
	}
	return out
}

function flattenInstanceLayer(
	layerPieces: ReadonlyDeep<PieceInstance>[],
	partTimes: PartCurrentTimes
): PieceInstanceWithTimings[] {
	const out: PieceInstanceWithTimings[] = []

	for (let i = 0; i < layerPieces.length; i++) {
		const piece = layerPieces[i]
		const start = instanceStartInPart(piece, partTimes)
		const end = instanceEndInPart(piece, partTimes)
		if (end <= start) continue

		const lifespan = new PieceLifespan(piece.piece.lifespan)
		let gaps: Array<{ start: number; end: number }>
		if (lifespan.persistsInShadow) {
			gaps = [{ start, end }]
			for (let j = i + 1; j < layerPieces.length; j++) {
				const laterStart = instanceStartInPart(layerPieces[j], partTimes)
				if (laterStart <= start) continue
				gaps = subtractGap(gaps, laterStart, instanceEndInPart(layerPieces[j], partTimes))
			}
		} else {
			let stopEnd = end
			for (let j = i + 1; j < layerPieces.length; j++) {
				const laterStart = instanceStartInPart(layerPieces[j], partTimes)
				if (laterStart <= start) continue
				stopEnd = Math.min(stopEnd, laterStart)
				break
			}
			gaps = [{ start, end: stopEnd }]
		}

		if (piece.piece.virtual) continue

		const priority = lifespan.stackingPriority
		gaps.forEach((gap, sliceIndex) => {
			if (gap.end <= gap.start) return
			out.push(wrapTimingsSlice(piece, gap, sliceIndex, priority, partTimes))
		})
	}

	return out
}

function instanceStartInPart(piece: ReadonlyDeep<PieceInstance>, partTimes: PartCurrentTimes): number {
	if (piece.piece.enable.isAbsolute) {
		if (piece.piece.enable.start === 'now') return partTimes.nowInPart
		return piece.piece.enable.start - partTimes.currentTime + partTimes.nowInPart
	}
	return piece.piece.enable.start === 'now' ? partTimes.nowInPart : piece.piece.enable.start
}

function instanceEndInPart(piece: ReadonlyDeep<PieceInstance>, partTimes: PartCurrentTimes): number {
	if (piece.userDuration) return piece.userDuration.endRelativeToPart
	const start = instanceStartInPart(piece, partTimes)
	if (typeof piece.piece.enable.duration === 'number') return start + piece.piece.enable.duration
	return Number.POSITIVE_INFINITY
}

function wrapTimingsSlice(
	piece: ReadonlyDeep<PieceInstance>,
	gap: { start: number; end: number },
	sliceIndex: number,
	priority: number,
	partTimes: PartCurrentTimes
): PieceInstanceWithTimings {
	const resolvedEndCap = Number.isFinite(gap.end) ? gap.end : undefined
	const keepIdentity = sliceIndex === 0
	const startIsNow = piece.piece.enable.start === 'now' && gap.start === partTimes.nowInPart

	return {
		...piece,
		_id: keepIdentity ? piece._id : protectString(`${unprotectString(piece._id)}_slice${sliceIndex}`),
		infinite: keepIdentity ? piece.infinite : undefined,
		priority,
		resolvedEndCap,
		piece: {
			...piece.piece,
			enable: {
				...piece.piece.enable,
				start: startIsNow ? 'now' : gap.start,
			},
		},
	}
}

function subtractGap(
	gaps: Array<{ start: number; end: number }>,
	cutStart: number,
	cutEnd: number
): Array<{ start: number; end: number }> {
	const next: Array<{ start: number; end: number }> = []
	for (const gap of gaps) {
		if (cutEnd <= gap.start || cutStart >= gap.end) {
			next.push(gap)
			continue
		}
		if (cutStart > gap.start) next.push({ start: gap.start, end: Math.min(cutStart, gap.end) })
		if (cutEnd < gap.end) next.push({ start: Math.max(cutEnd, gap.start), end: gap.end })
	}
	return next.filter((gap) => gap.end > gap.start)
}
