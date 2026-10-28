import _ from 'underscore'

import {
	IBlueprintActionManifestDisplay,
	IBlueprintActionManifestDisplayContent,
	IOutputLayer,
	ISourceLayer,
} from '@sofie-automation/blueprints-integration'
import { PartId, PieceId, RundownPlaylistActivationId } from '../dataModel/Ids.js'
import { DBPart, PartExtended } from '../dataModel/Part.js'
import { Piece, PieceExtended } from '../dataModel/Piece.js'
import { PieceInstance, PieceInstancePiece } from '../dataModel/PieceInstance.js'
import { DBRundownPlaylist, QuickLoopMarkerType } from '../dataModel/RundownPlaylist/RundownPlaylist.js'
import { DBSegment, SegmentExtended, SegmentOrphanedReason } from '../dataModel/Segment.js'
import { literal, groupByToMap, Complete } from '../lib.js'
import { FindOptions, MongoQuery, mongoWhereFilter } from '../mongo.js'
import { protectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import {
	createPartCurrentTimes,
	processAndPrunePieceInstanceTimings,
	resolvePrunedPieceInstance,
} from './processAndPrune.js'
import { calculatePartInstanceExpectedDurationWithTransition } from './timings.js'
import { PieceLifespan } from './pieceLifespan.js'
import {
	buildPastInfinitePiecesForThisPartQuery,
	buildPastPiecesOnLayersForThisPartQuery,
	buildPiecesStartingInThisPartQuery,
	getPieceInstancesForPart,
	PartPosition,
	PieceInstancesForPartParams,
} from './infinites.js'
import {
	DBShowStyleBase,
	IOutputLayerExtended,
	ISourceLayerExtended,
	UIShowStyleBase,
} from '../dataModel/ShowStyleBase.js'
import { applyAndValidateOverrides } from '../settings/objectWithOverrides.js'
import { PartInstance, PartInstanceLimited } from '../dataModel/PartInstance.js'
import { ReadonlyDeep } from 'type-fest'
import {
	GetPieceInstancesForPartInstanceParams,
	GetResolvedSegmentParams,
	GetSegmentsWithPartInstancesParams,
	PiecesFind,
	ResolvedSegmentResult,
} from './stateCacheResolverTypes.js'

/** Resolve segment parts/pieces into timeline-friendly UI data. */
export function getResolvedSegment({
	showStyleBase: showStyleBaseProp,
	studio,
	playlist,
	rundown,
	segment,
	segmentsToReceiveOnRundownEndFromSet,
	rundownsToReceiveOnShowStyleEndFrom,
	rundownsToShowStyles,
	orderedAllPartIds,
	currentPartInstance,
	nextPartInstance,
	accessors,
	options,
}: GetResolvedSegmentParams): ResolvedSegmentResult {
	const getCurrentTime = options?.getCurrentTime ?? (() => Date.now())
	const includeDisabledPieces = options?.includeDisabledPieces ?? false
	const showHiddenSourceLayers = options?.showHiddenSourceLayers ?? false
	const defaultDisplayDuration = options?.defaultDisplayDuration ?? 0
	const invalidateAfter = options?.invalidateAfter
	const { segmentsFindOne, getSegmentsAndPartsSync, getActivePartInstances, piecesFind, pieceInstancesFind } =
		accessors

	let isLiveSegment = false
	let isNextSegment = false
	let currentLivePart: PartExtended | undefined = undefined
	let currentNextPart: PartExtended | undefined = undefined
	let hasAlreadyPlayed = false
	let hasRemoteItems = false
	let hasGuestItems = false
	const showStyleBase = isUIShowStyleBase(showStyleBaseProp)
		? showStyleBaseProp
		: convertToUIShowStyleBase(showStyleBaseProp)

	let autoNextPart = false

	const segmentExtended = literal<SegmentExtended>({
		...segment,
		/** Create maps for outputLayers and sourceLayers */
		outputLayers: {},
		sourceLayers: {},
	})

	// fetch all the parts for the segment
	let partsE: Array<PartExtended> = []

	// We can just get this as a property.
	const segmentInfo = getSegmentsWithPartInstances({
		playlist,
		accessors: {
			getSegmentsAndPartsSync,
			getActivePartInstances,
		},
		queries: {
			segments: {
				_id: segment._id,
			},
			parts: {
				segmentId: segment._id,
			},
			partInstances: {
				segmentId: segment._id,
			},
		},
		options: {
			partInstances: {
				fields: {
					isTaken: 0,
					previousPartEndState: 0,
				},
			},
		},
	})[0] as { segment: DBSegment; partInstances: PartInstanceLimited[] } | undefined

	if (segmentInfo && segmentInfo.partInstances.length > 0) {
		// create local deep copies of the studio outputLayers and sourceLayers so that we can store
		// pieces present on those layers inside and also figure out which layers are used when inside the rundown
		const outputLayers: Record<string, IOutputLayerExtended> = {}
		for (const [id, layer] of Object.entries<IOutputLayer | undefined>(showStyleBase.outputLayers)) {
			if (layer) {
				outputLayers[id] = {
					...layer,
					sourceLayers: [],
					used: false,
				}
			}
		}
		const sourceLayers: Record<string, ISourceLayerExtended> = {}
		for (const [id, layer] of Object.entries<ISourceLayer | undefined>(showStyleBase.sourceLayers)) {
			if (layer) {
				sourceLayers[id] = {
					...layer,
					followingItems: [],
					pieces: [],
				}
			}
		}

		// create a lookup map to match original pieces to their resolved counterparts
		const piecesLookup = new Map<PieceId, PieceExtended>()
		// a buffer to store durations for the displayDuration groups
		const displayDurationGroups = new Map<string, number>()

		let startsAt = 0
		let previousPart: PartExtended | undefined

		// this can also just pe passed into this function
		const deduplicatedPartInstances = deduplicatePartInstancesForQuickLoop(
			playlist,
			segmentInfo.partInstances,
			currentPartInstance
		)

		// fetch all the pieces for the parts
		const partIds = deduplicatedPartInstances.map((part) => part.part._id)

		// this seems to be also something that can be resolved outside
		let nextPartIsAfterCurrentPart = false
		if (nextPartInstance && currentPartInstance) {
			if (nextPartInstance.segmentId === currentPartInstance.segmentId) {
				nextPartIsAfterCurrentPart = currentPartInstance.part._rank < nextPartInstance.part._rank
			} else {
				const nextPartSegment = segmentsFindOne(
					{
						_id: nextPartInstance.segmentId,
					},
					{ fields: { _rank: 1 } }
				)
				const currentPartSegment = segmentsFindOne(
					{
						_id: currentPartInstance.segmentId,
					},
					{ fields: { _rank: 1 } }
				)
				if (nextPartSegment && currentPartSegment) {
					nextPartIsAfterCurrentPart = currentPartSegment._rank < nextPartSegment._rank
				}
			}
		}

		partsE = deduplicatedPartInstances.map((partInstance, itIndex) => {
			const partExpectedDuration = calculatePartInstanceExpectedDurationWithTransition(partInstance)

			// extend objects to match the Extended interface
			const partE = literal<PartExtended>({
				partId: partInstance.part._id,
				instance: partInstance,
				pieces: [],
				renderedDuration: partExpectedDuration ?? 0,
				startsAt: 0,
				willProbablyAutoNext: !!(
					previousPart &&
					previousPart.instance.part.autoNext &&
					previousPart.instance.part.expectedDuration
				),
			})

			// set the flags for isLiveSegment, isNextSegment, autoNextPart, hasAlreadyPlayed
			if (currentPartInstance && currentPartInstance._id === partE.instance._id) {
				isLiveSegment = true
				currentLivePart = partE
			}
			if (nextPartInstance && nextPartInstance._id === partE.instance._id) {
				isNextSegment = true
				currentNextPart = partE
			}
			autoNextPart = !!(
				currentLivePart &&
				currentLivePart.instance.part.autoNext &&
				currentLivePart.instance.part.expectedDuration
			)
			if (partE.instance.timings?.plannedStartedPlayback !== undefined) {
				hasAlreadyPlayed = true
			}

			// here we get into trouble, we really need to move the findOptions type into core as well. We iterating here so we cannot pass them in from where we call getResolvedSegment.
			const pieceInstanceFieldOptions: FindOptions<PieceInstance> = {
				fields: {
					reportedStartedPlayback: 0,
					reportedStoppedPlayback: 0,
				},
			}

			const rawPieceInstances = getPieceInstancesForPartInstance({
				playlistActivationId: playlist.activationId,
				rundown,
				segment,
				partInstance,
				partsToReceiveOnSegmentEndFromSet: new Set(partIds.slice(0, itIndex)),
				segmentsToReceiveOnRundownEndFromSet,
				rundownsToReceiveOnShowStyleEndFrom,
				rundownsToShowStyles,
				orderedAllParts: orderedAllPartIds,
				nextPartIsAfterCurrentPart,
				currentPartInstance,
				currentSegment: currentPartInstance
					? (segmentsFindOne(currentPartInstance.segmentId, {
							projection: {
								_id: 1,
								orphaned: 1,
							},
						}) as Pick<DBSegment, '_id' | 'orphaned'> | undefined)
					: undefined,
				currentPartInstancePieceInstances: currentPartInstance
					? pieceInstancesFind(
							{
								partInstanceId: currentPartInstance._id,
							},
							pieceInstanceFieldOptions
						)
					: undefined,
				allowTestingAdlibsToPersist: studio?.settings.allowTestingAdlibsToPersist ?? false,
				accessors: {
					piecesFind,
					pieceInstancesFind,
				},
				options: {
					getCurrentTime,
					pieceInstanceOptions: pieceInstanceFieldOptions,
					invalidateAfter,
				},
			})

			const partTimes = createPartCurrentTimes(getCurrentTime(), partE.instance.timings?.plannedStartedPlayback)
			const preprocessedPieces = processAndPrunePieceInstanceTimings(
				showStyleBase.sourceLayers,
				rawPieceInstances,
				partTimes,
				includeDisabledPieces
			)

			// insert items into the timeline for resolution
			partE.pieces = preprocessedPieces.map((piece) => {
				const resolvedPiece = resolvePrunedPieceInstance(partTimes, piece)
				const resPiece: PieceExtended = {
					instance: piece,
					renderedDuration: resolvedPiece.resolvedDuration ?? null,
					renderedInPoint: resolvedPiece.resolvedStart,
				}

				// find the target output layer
				const outputLayer = outputLayers[piece.piece.outputLayerId] as IOutputLayerExtended | undefined
				resPiece.outputLayer = outputLayer

				if (!piece.piece.virtual && outputLayer) {
					// mark the output layer as used within this segment
					if (
						sourceLayers[piece.piece.sourceLayerId] &&
						(showHiddenSourceLayers || !sourceLayers[piece.piece.sourceLayerId].isHidden)
					) {
						outputLayer.used = true
					}
					// attach the sourceLayer to the output, if it hasn't been already
					// find matching layer in the output
					let sourceLayer = outputLayer.sourceLayers.find((el) => {
						return el._id === piece.piece.sourceLayerId
					})
					// if the source has not yet been used on this output
					if (!sourceLayer) {
						sourceLayer = sourceLayers[piece.piece.sourceLayerId]
						if (sourceLayer) {
							sourceLayer = { ...sourceLayer }
							const partSourceLayer = sourceLayer
							partSourceLayer.pieces = []
							outputLayer.sourceLayers.push(partSourceLayer)
						}
					}

					if (sourceLayer) {
						resPiece.sourceLayer = sourceLayer
						// attach the piece to the sourceLayer in this segment
						resPiece.sourceLayer.pieces.push(resPiece)

						// mark the special Remote and Guest flags, these are dependant on the sourceLayer configuration
						// check if the segment should be in a special state for segments with remote input
						if (resPiece.sourceLayer.isRemoteInput) {
							hasRemoteItems = true
						}
						if (resPiece.sourceLayer.isGuestInput) {
							hasGuestItems = true
						}
					}
				}

				// add the piece to the map to make future searches quicker
				piecesLookup.set(piece.piece._id, resPiece)

				return resPiece
			})

			// displayDuration groups are sets of Parts that share their expectedDurations.
			// If a member of the group has a displayDuration > 0, this displayDuration is used as the renderedDuration of a part.
			// This value is then deducted from the expectedDuration and the result leftover duration is added to the group pool.
			// If a member has a displayDuration == 0, it will use up whatever is available in the pool.
			// displayDurationGroups is specifically designed for a situation where the Rundown has a lead-in piece to camera
			// and then has a B-Roll to be played out over a VO from the host.
			if (
				partE.instance.part.displayDurationGroup &&
				// either this is not the first element of the displayDurationGroup
				(displayDurationGroups.get(partE.instance.part.displayDurationGroup) !== undefined ||
					// or there is a following member of this displayDurationGroup
					(segmentInfo.partInstances[itIndex + 1] &&
						segmentInfo.partInstances[itIndex + 1].part.displayDurationGroup ===
							partE.instance.part.displayDurationGroup))
			) {
				displayDurationGroups.set(
					partE.instance.part.displayDurationGroup,
					(displayDurationGroups.get(partE.instance.part.displayDurationGroup) || 0) +
						(partExpectedDuration || 0)
				)
				partE.renderedDuration =
					partE.instance.timings?.duration ||
					Math.min(partE.instance.part.displayDuration || 0, partExpectedDuration || 0) ||
					displayDurationGroups.get(partE.instance.part.displayDurationGroup) ||
					0
				displayDurationGroups.set(
					partE.instance.part.displayDurationGroup,
					Math.max(
						0,
						(displayDurationGroups.get(partE.instance.part.displayDurationGroup) || 0) -
							(partE.instance.timings?.duration || partE.renderedDuration)
					)
				)
			}

			// use the expectedDuration and fallback to the default display duration for the part
			partE.renderedDuration = partE.renderedDuration || defaultDisplayDuration

			// push the startsAt value, to figure out when each of the parts starts, relative to the beginning of the segment
			partE.startsAt = startsAt
			startsAt = partE.startsAt + (partE.renderedDuration || 0)

			previousPart = partE
			return partE
		})

		// let lastPartPiecesBySourceLayer: Record<string, PieceExtended> = {}

		partsE.forEach((part) => {
			// const thisLastPartPiecesBySourceLayer: Record<string, PieceExtended> = {}
			if (part.pieces) {
				const itemsByLayer = Object.entries<PieceExtended[]>(
					_.groupBy(part.pieces, (item) => {
						return item.outputLayer && item.sourceLayer && item.outputLayer.isFlattened
							? item.instance.piece.outputLayerId + '_' + item.sourceLayer.exclusiveGroup
							: item.instance.piece.outputLayerId + '_' + item.instance.piece.sourceLayerId
					})
				)
				for (const [, layerItems] of itemsByLayer) {
					for (const item of layerItems) {
						// Infinite pieces that do not start in this Part don't show their labels, at the request of
						// Jesper Stærkær -- Jan Starzak, 2021/10/14
						if (item.instance.piece.startPartId !== part.instance.part._id) {
							item.hasOriginInPreceedingPart = true
						}
					}

					for (const resumedItem of resolveVisiblePiecesOnLayer(layerItems)) {
						part.pieces.push(resumedItem)
						resumedItem.sourceLayer?.pieces?.push(resumedItem)
					}
				}
			}

			// lastPartPiecesBySourceLayer = thisLastPartPiecesBySourceLayer
		})

		segmentExtended.outputLayers = outputLayers
		segmentExtended.sourceLayers = sourceLayers

		if (isNextSegment && !isLiveSegment && !autoNextPart && currentPartInstance) {
			if (currentPartInstance.part.expectedDuration && currentPartInstance.part.autoNext) {
				autoNextPart = true
			}
		}
	}
	return {
		segmentExtended,
		parts: partsE,
		isLiveSegment,
		currentLivePart,
		currentNextPart,
		isNextSegment,
		hasAlreadyPlayed,
		hasGuestItems,
		hasRemoteItems,
		autoNextPart,
	}

	// get the part immediately after the last segment
}

/**
 * Crop the pieces on a layer to what playout shows. As the timeline resolves it, at any time the piece with the highest
 * priority is visible, or the latest started one when they are equal. A piece covered for a while comes back once the
 * pieces covering it end, as an extra item.
 * @returns The extra items of the pieces coming back
 */
function resolveVisiblePiecesOnLayer(items: PieceExtended[]): PieceExtended[] {
	const timedItems = items.filter(
		(item): item is PieceExtended & { renderedInPoint: number } =>
			typeof item.renderedInPoint === 'number' && item.renderedDuration !== undefined
	)
	const getEnd = (item: PieceExtended & { renderedInPoint: number }) =>
		item.renderedDuration === null ? Infinity : item.renderedInPoint + item.renderedDuration

	// Step through every point where the visible piece may change
	const points = _.uniq(timedItems.flatMap((item) => [item.renderedInPoint, getEnd(item)]))
		.filter((point) => Number.isFinite(point))
		.sort((a, b) => a - b)
	const visibleSpans = new Map<PieceExtended, Array<{ start: number; end: number }>>()
	points.forEach((start, index) => {
		const end = points[index + 1] ?? Infinity
		const visible = timedItems
			.filter((item) => item.renderedInPoint <= start && getEnd(item) > start)
			.reduce<
				(PieceExtended & { renderedInPoint: number }) | undefined
			>((best, item) => (!best || item.instance.priority > best.instance.priority || (item.instance.priority === best.instance.priority && item.renderedInPoint >= best.renderedInPoint) ? item : best), undefined)
		if (!visible) return

		const spans = visibleSpans.get(visible) ?? []
		const lastSpan = spans[spans.length - 1]
		if (lastSpan && lastSpan.end === start) lastSpan.end = end
		else spans.push({ start, end })
		visibleSpans.set(visible, spans)
	})

	const renderedItems: PieceExtended[] = []
	const resumedItems: PieceExtended[] = []
	for (const item of timedItems) {
		const end = getEnd(item)
		const spans = visibleSpans.get(item) ?? []
		const lastSpan = spans[spans.length - 1]
		const lifespan = PieceLifespan.from(item.instance.piece.lifespan)

		// An infinite which doesn't persist in shadow and stops being visible within this Part was ended here
		if (item.instance.infinite && !lifespan.persistsInShadow && (!lastSpan || lastSpan.end !== Infinity)) {
			;(item.instance.piece as PieceInstancePiece).lifespan = {
				scope: 'part',
				presence: 'forward-scope',
				inShadow: 'stop',
			}
			delete (item.instance as PieceInstance).infinite
		}

		const [firstSpan, ...laterSpans] = spans
		if (!firstSpan) {
			item.renderedDuration = 0
			item.cropped = true
			continue
		}

		const toDuration = (span: { start: number; end: number }) =>
			span.end === Infinity ? null : span.end - span.start
		item.renderedInPoint = firstSpan.start
		item.renderedDuration = toDuration(firstSpan)
		if (firstSpan.end < end) item.cropped = true
		renderedItems.push(item)

		for (const span of laterSpans) {
			const resumedItem: PieceExtended = {
				...item,
				instance: {
					...item.instance,
					_id: protectString(`${item.instance._id}_resumed_${span.start}`),
				},
				renderedInPoint: span.start,
				renderedDuration: toDuration(span),
				cropped: span.end < end,
				maxLabelWidth: undefined,
				hasOriginInPreceedingPart: true,
			}
			renderedItems.push(resumedItem)
			resumedItems.push(resumedItem)
		}
	}

	// Limit the labels so that they don't go under the next item
	const byStart = _.sortBy(renderedItems, (item) => item.renderedInPoint ?? 0)
	byStart.forEach((item, index) => {
		const next = byStart
			.slice(index + 1)
			.find((other) => (other.renderedInPoint ?? 0) > (item.renderedInPoint ?? 0))
		if (next) item.maxLabelWidth = (next.renderedInPoint ?? 0) - (item.renderedInPoint ?? 0)
	})

	return resumedItems
}

export function isAdlibActionContent(
	display: IBlueprintActionManifestDisplay | IBlueprintActionManifestDisplayContent
): display is IBlueprintActionManifestDisplayContent {
	if ((display as any).sourceLayerId !== undefined) {
		return true
	}
	return false
}

export function deduplicatePartInstancesForQuickLoop<T extends Pick<PartInstance, '_id' | 'part'>>(
	playlist: DBRundownPlaylist,
	sortedPartInstances: T[],
	currentPartInstance: T | undefined
): T[] {
	if (!isLoopRunning(playlist)) return sortedPartInstances
	return sortedPartInstances.filter((partInstance) => {
		return partInstance.part._id !== currentPartInstance?.part._id || partInstance._id === currentPartInstance._id
	})
}

/** Get playlist segments with either active or temporary PartInstances, in playout order. */
export function getSegmentsWithPartInstances({
	playlist,
	accessors,
	queries,
	options,
}: GetSegmentsWithPartInstancesParams): Array<{ segment: DBSegment; partInstances: PartInstance[] }> {
	const { getSegmentsAndPartsSync, getActivePartInstances } = accessors
	const { segments, parts: rawParts } = getSegmentsAndPartsSync(
		playlist,
		queries?.segments,
		queries?.parts,
		options?.segments,
		options?.parts
	)
	const rawPartInstances = getActivePartInstances(playlist, queries?.partInstances, options?.partInstances)
	const playlistActivationId = playlist.activationId ?? protectString('')

	const partsBySegment = groupByToMap(rawParts, 'segmentId')
	const partInstancesBySegment = groupByToMap(rawPartInstances, 'segmentId')

	return segments.map((segment) => {
		const segmentParts = partsBySegment.get(segment._id) ?? []
		const segmentPartInstances = partInstancesBySegment.get(segment._id) ?? []

		if (segmentPartInstances.length === 0) {
			return {
				segment,
				partInstances: segmentParts.map((p) => wrapPartToTemporaryInstance(playlistActivationId, p)),
			}
		} else if (segmentParts.length === 0) {
			return {
				segment,
				partInstances: segmentPartInstances.sort(
					(a, b) => a.part._rank - b.part._rank || a.takeCount - b.takeCount
				),
			}
		} else {
			const partIds: Set<PartId> = new Set()
			for (const partInstance of segmentPartInstances) {
				partIds.add(partInstance.part._id)
			}
			for (const part of segmentParts) {
				if (partIds.has(part._id)) continue
				segmentPartInstances.push(wrapPartToTemporaryInstance(playlistActivationId, part))
			}
			const allPartInstances = segmentPartInstances.sort(
				(a, b) => a.part._rank - b.part._rank || a.takeCount - b.takeCount
			)

			return {
				segment,
				partInstances: allPartInstances,
			}
		}
	})
}

function fetchPiecesThatMayBeActiveForPart(
	part: DBPart,
	position: PartPosition,
	piecesFind: PiecesFind,
	/** Map of Pieces on Parts, passed through for performance */
	allPiecesCache?: Map<PartId | null, Piece[]>
): Piece[] {
	const allPieces = allPiecesCache ? Array.from(allPiecesCache.values()).flat() : undefined
	const findPieces = (selector: MongoQuery<Piece>): Piece[] =>
		// Fast-path: if we already have the pieces, we can use them directly:
		allPieces ? mongoWhereFilter(allPieces, selector) : piecesFind(selector)

	const piecesStartingInPart = allPiecesCache?.get(part._id) ?? findPieces(buildPiecesStartingInThisPartQuery(part))

	const partIdsBefore = Array.from(position.partIdsBefore)
	const segmentIdsBefore = Array.from(position.segmentIdsBefore)
	const rundownIdsBefore = [...position.rundownIdsBefore]

	const infinitePieceQuery = buildPastInfinitePiecesForThisPartQuery(
		part,
		partIdsBefore,
		segmentIdsBefore,
		rundownIdsBefore
	)
	const infinitePieces = infinitePieceQuery ? findPieces(infinitePieceQuery) : []

	// Any piece on the same layer as one of those infinites may stop it
	const layerPieceQuery = buildPastPiecesOnLayersForThisPartQuery(
		part,
		partIdsBefore,
		segmentIdsBefore,
		rundownIdsBefore,
		_.uniq(infinitePieces.map((p) => p.sourceLayerId))
	)
	const layerPieces = layerPieceQuery ? findPieces(layerPieceQuery) : []

	return piecesStartingInPart.concat(layerPieces.length > 0 ? layerPieces : infinitePieces)
}

const SIMULATION_INVALIDATION = 3000

/** Resolve PieceInstances for a PartInstance, with simulation fallback during sync gaps. */
export function getPieceInstancesForPartInstance({
	playlistActivationId,
	rundown,
	segment,
	partInstance,
	partsToReceiveOnSegmentEndFromSet,
	segmentsToReceiveOnRundownEndFromSet,
	rundownsToReceiveOnShowStyleEndFrom,
	rundownsToShowStyles,
	orderedAllParts,
	nextPartIsAfterCurrentPart,
	currentPartInstance,
	currentSegment,
	currentPartInstancePieceInstances,
	allowTestingAdlibsToPersist,
	accessors,
	options: resolverOptions,
}: GetPieceInstancesForPartInstanceParams): PieceInstance[] {
	const { piecesFind, pieceInstancesFind } = accessors
	const getCurrentTime = resolverOptions?.getCurrentTime ?? (() => Date.now())
	const allPiecesCache = resolverOptions?.allPiecesCache
	const options = resolverOptions?.pieceInstanceOptions
	const invalidateAfter = resolverOptions?.invalidateAfter
	if (segment.orphaned === SegmentOrphanedReason.ADLIB_TESTING) {
		// When in the AdlibTesting segment, don't allow searching other segments/rundowns for infinites to continue
		segmentsToReceiveOnRundownEndFromSet = new Set()
		rundownsToReceiveOnShowStyleEndFrom = []
	}

	const getPieceInstancesForPartParams = (isTemporary: boolean): PieceInstancesForPartParams => {
		const position: PartPosition = {
			partIdsBefore: partsToReceiveOnSegmentEndFromSet,
			segmentIdsBefore: segmentsToReceiveOnRundownEndFromSet,
			rundownIdsBefore: rundownsToReceiveOnShowStyleEndFrom,
			rundownShowStyles: rundownsToShowStyles,
			orderedPartIds: orderedAllParts,
		}

		return {
			playlistActivationId: playlistActivationId || protectString(''),
			rundown,
			segment,
			part: partInstance.part,
			position,
			pieces: fetchPiecesThatMayBeActiveForPart(partInstance.part, position, piecesFind, allPiecesCache),
			playing:
				currentPartInstance && currentSegment
					? {
							partInstance: currentPartInstance,
							segment: currentSegment,
							pieceInstances: currentPartInstancePieceInstances ?? [],
							isBeforeTarget: nextPartIsAfterCurrentPart,
						}
					: undefined,
			newInstanceId: partInstance._id,
			isTemporary,
			allowTestingAdlibsToPersist,
		}
	}

	if (partInstance.isTemporary) {
		return getPieceInstancesForPart(getPieceInstancesForPartParams(true))
	} else {
		const results =
			// Check if the PartInstance we're currently looking for PieceInstances for is already the current one.
			// If that's the case, we can sace ourselves a scan across the PieceInstances collection
			partInstance._id === currentPartInstance?._id && currentPartInstancePieceInstances
				? currentPartInstancePieceInstances
				: pieceInstancesFind({ partInstanceId: partInstance._id }, options)
		// check if we can return the results immediately
		if (results.length > 0 || !invalidateAfter) return results

		// if a simulation has been requested and less than SIMULATION_INVALIDATION time has passed
		// since the PartInstance has been nexted or taken, simulate the PieceInstances using the Piece collection.
		const now = getCurrentTime()
		if (
			results.length === 0 &&
			(!partInstance.timings ||
				(partInstance.timings.setAsNext || 0) > now - SIMULATION_INVALIDATION ||
				(partInstance.timings.take || 0) > now - SIMULATION_INVALIDATION)
		) {
			// make sure to invalidate the current computation after SIMULATION_INVALIDATION has passed
			invalidateAfter(SIMULATION_INVALIDATION)

			return getPieceInstancesForPart(getPieceInstancesForPartParams(true))
		} else {
			// otherwise, return results as they are
			return results
		}
	}
}

export function isLoopDefined(playlist: DBRundownPlaylist | undefined): boolean {
	return playlist?.quickLoop?.start != null && playlist?.quickLoop?.end != null
}

export function isAnyLoopMarkerDefined(playlist: DBRundownPlaylist | undefined): boolean {
	return playlist?.quickLoop?.start != null || playlist?.quickLoop?.end != null
}

export function isLoopRunning(playlist: DBRundownPlaylist | undefined): boolean {
	return !!playlist?.quickLoop?.running
}

export function isLoopLocked(playlist: DBRundownPlaylist | undefined): boolean {
	return !!playlist?.quickLoop?.locked
}

export function isEntirePlaylistLooping(playlist: DBRundownPlaylist | undefined): boolean {
	return (
		playlist?.quickLoop?.start?.type === QuickLoopMarkerType.PLAYLIST &&
		playlist?.quickLoop?.end?.type === QuickLoopMarkerType.PLAYLIST
	)
}

export function isQuickLoopStart(partId: PartId, playlist: DBRundownPlaylist | undefined): boolean {
	return playlist?.quickLoop?.start?.type === QuickLoopMarkerType.PART && playlist.quickLoop.start.id === partId
}

export function isQuickLoopEnd(partId: PartId, playlist: DBRundownPlaylist | undefined): boolean {
	return playlist?.quickLoop?.end?.type === QuickLoopMarkerType.PART && playlist.quickLoop.end.id === partId
}

export function isEndOfLoopingShow(
	playlist: DBRundownPlaylist | undefined,
	isLastSegment: boolean,
	isPartLastInSegment: boolean,
	part: DBPart
): boolean {
	return (
		isPartLastInSegment &&
		isLoopDefined(playlist) &&
		((isLastSegment && playlist?.quickLoop?.end?.type === QuickLoopMarkerType.PLAYLIST) ||
			(playlist?.quickLoop?.end?.type === QuickLoopMarkerType.SEGMENT &&
				playlist?.quickLoop.end.id === part.segmentId) ||
			(playlist?.quickLoop?.end?.type === QuickLoopMarkerType.PART && playlist?.quickLoop.end.id === part._id))
	)
}

export function wrapPartToTemporaryInstance(
	playlistActivationId: RundownPlaylistActivationId,
	part: ReadonlyDeep<DBPart>
): PartInstance {
	return {
		isTemporary: true,
		_id: protectString(`${part._id}_tmp_instance`),
		rundownId: part.rundownId,
		segmentId: part.segmentId,
		playlistActivationId,
		segmentPlayoutId: protectString(''), // Only needed when stored in the db, and filled in nearer the time
		takeCount: -1,
		rehearsal: false,
		part: part as DBPart,
	}
}

export function convertToUIShowStyleBase(showStyleBase: DBShowStyleBase): UIShowStyleBase {
	return literal<Complete<UIShowStyleBase>>({
		_id: showStyleBase._id,
		name: showStyleBase.name,
		hotkeyLegend: showStyleBase.hotkeyLegend,
		sourceLayers: applyAndValidateOverrides(showStyleBase.sourceLayersWithOverrides).obj,
		outputLayers: applyAndValidateOverrides(showStyleBase.outputLayersWithOverrides).obj,
		abChannelDisplay: showStyleBase.abChannelDisplay,
	})
}

export function isUIShowStyleBase(value: DBShowStyleBase | UIShowStyleBase): value is UIShowStyleBase {
	if (!value || typeof value !== 'object') return false

	const v = value as Partial<UIShowStyleBase>

	return (
		typeof v.sourceLayers === 'object' &&
		v.sourceLayers !== null &&
		typeof v.outputLayers === 'object' &&
		v.outputLayers !== null
	)
}
