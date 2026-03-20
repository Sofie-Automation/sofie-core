import _ from 'underscore'

import {
	SourceLayerType,
	PieceLifespan,
	IBlueprintActionManifestDisplay,
	IBlueprintActionManifestDisplayContent,
	IOutputLayer,
	ISourceLayer,
} from '@sofie-automation/blueprints-integration'
import {
	SegmentId,
	RundownId,
	ShowStyleBaseId,
	PartId,
	PieceId,
	RundownPlaylistActivationId,
	PieceInstanceId,
} from '../dataModel/Ids.js'
import { DBPart, PartExtended } from '../dataModel/Part.js'
import { Piece, PieceExtended, PieceStatusCode } from '../dataModel/Piece.js'
import { PieceInstance, PieceInstancePiece } from '../dataModel/PieceInstance.js'
import { Rundown } from '../dataModel/Rundown.js'
import { DBRundownPlaylist, QuickLoopMarkerType } from '../dataModel/RundownPlaylist.js'
import { DBSegment, SegmentExtended, SegmentOrphanedReason } from '../dataModel/Segment.js'
import { assertNever, literal, groupByToMap, Complete } from '../lib.js'
import { FindOneOptions, FindOptions, MongoQuery, mongoWhereFilter } from '../mongo.js'
import { protectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import {
	createPartCurrentTimes,
	processAndPrunePieceInstanceTimings,
	resolvePrunedPieceInstance,
} from './processAndPrune.js'
import { calculatePartInstanceExpectedDurationWithTransition } from './timings.js'
import {
	buildPastInfinitePiecesForThisPartQuery,
	buildPiecesStartingInThisPartQuery,
	getPieceInstancesForPart,
} from './infinites.js'
import {
	DBShowStyleBase,
	IOutputLayerExtended,
	ISourceLayerExtended,
	UIShowStyleBase,
} from '../dataModel/ShowStyleBase.js'
import { applyAndValidateOverrides } from '../settings/objectWithOverrides.js'
import { PartInstance, PartInstanceLimited } from '../dataModel/PartInstance.js'
import { UIStudio } from '../dataModel/Studio.js'
import { ReadonlyDeep } from 'type-fest'
import { TimeDuration } from '@sofie-automation/shared-lib/dist/lib/lib'

type SegmentsFindOne = (
	selector: SegmentId | MongoQuery<DBSegment>,
	options: FindOneOptions<DBSegment>
) => DBSegment | undefined
type PieceInstancesFind = (
	selector?: PieceInstanceId | MongoQuery<PieceInstance>,
	options?: FindOptions<PieceInstance>
) => PieceInstance[]
type GetCurrentTime = () => TimeDuration
type GetSegmentsAndPartsSync = (
	playlist: Pick<DBRundownPlaylist, '_id' | 'rundownIdsInOrder'>,
	segmentsQuery?: MongoQuery<DBSegment>,
	partsQuery?: MongoQuery<DBPart>,
	segmentsOptions?: Omit<FindOptions<DBSegment>, 'projection'>,
	partsOptions?: Omit<FindOptions<DBPart>, 'projection'>
) => {
	segments: DBSegment[]
	parts: DBPart[]
}
type GetActivePartInstances = (
	playlist: Pick<DBRundownPlaylist, '_id'>,
	selector?: MongoQuery<PartInstance>,
	options?: FindOptions<PartInstance>
) => PartInstance[]
type PiecesFind = (selector?: MongoQuery<Piece> | PieceId, options?: FindOptions<Piece>) => Piece[]

export function getSourceLayerClassName(sourceLayerType: SourceLayerType): string {
	// CAMERA_MOVEMENT -> "camera-movement"
	return ((SourceLayerType[sourceLayerType] || 'unknown-sourceLayer-' + sourceLayerType) + '')
		.toLowerCase()
		.replace(/_/g, '-')
}

export function getPieceStatusClassName(status: PieceStatusCode | undefined): string | undefined {
	switch (status) {
		case PieceStatusCode.OK:
		case PieceStatusCode.SOURCE_HAS_ISSUES:
		case PieceStatusCode.SOURCE_NOT_SET:
			return
		case PieceStatusCode.SOURCE_BROKEN:
			return 'source-broken'
		case PieceStatusCode.SOURCE_MISSING:
			return 'source-missing'
		case PieceStatusCode.SOURCE_UNKNOWN_STATE:
			return 'source-unknown-state'
		case PieceStatusCode.SOURCE_NOT_READY:
			return 'source-not-ready'
		case undefined:
		case PieceStatusCode.UNKNOWN:
			return 'unknown-state'
		default:
			assertNever(status)
			return 'source-unknown-state'
	}
}

/**
 * This function allows to see what the output of the playback will look like.
 * It simulates the operations done by the playout operations in core and playout-gateway
 * and produces a list of Pieces across Parts timed relatively.
 *
 * This method is primarily used by the GUI and the LSG to visualize/resolve segments, but other functions
 * utilize it as well when information about timing & time placement is needed.
 *
 * @export
 * @param {DBShowStyleBase | UIShowStyleBase} showStyleBase
 * @param {UIStudio | undefined} studio
 * @param {DBRundownPlaylist} playlist
 * @param {Pick<Rundown, '_id' | 'showStyleBaseId'>} rundown
 * @param {DBSegment} segment
 * @param {Set<SegmentId>} segmentsToReceiveOnRundownEndFromSet
 * @param {RundownId[]} rundownsToReceiveOnShowStyleEndFrom
 * @param {ReadonlyMap<RundownId, ShowStyleBaseId>} rundownsToShowStyles
 * @param {PartId[]} orderedAllPartIds
 * @param {PartInstance | undefined} nextPartInstance
 * @param {SegmentsFindOne} segmentsFindOne
 * @param {GetSegmentsAndPartsSync} getSegmentsAndPartsSync
 * @param {GetActivePartInstances} getActivePartInstances
 * @param {PiecesFind} piecesFind
 * @param {PieceInstancesFind} pieceInstancesFind
 * @param {GetCurrentTime} getCurrentTime
 * @param {((timeoutMs: number) => void) | undefined} [invalidateAfter] Optional callback triggered if the function returns simulated PieceInstances (fallback).
 * 		If provided, it will be executed with a timeout (ms) indicating when the simulation should be considered stale and the data should be re-evaluated.
 * 		Used to handle the data-sync gap during "Take" or "Next" operations.
 * @param {boolean} [includeDisabledPieces=false] In some uses (like when previewing a Segment in the GUI) it's needed
 * 		to consider disabled Piecess as where they are, instead of stripping them out. When enabled, the method will
 * 		keep them in the result set.
 * @param {boolean} [showHiddenSourceLayers=false]
 * @param {number} [defaultDisplayDuration=0]
 * @return {*}  {({
 */
export function getResolvedSegment(
	showStyleBaseProp: DBShowStyleBase | UIShowStyleBase,
	studio: UIStudio | undefined,
	playlist: DBRundownPlaylist,
	rundown: Pick<Rundown, '_id' | 'showStyleBaseId'>,
	segment: DBSegment,
	segmentsToReceiveOnRundownEndFromSet: Set<SegmentId>,
	rundownsToReceiveOnShowStyleEndFrom: RundownId[],
	rundownsToShowStyles: ReadonlyMap<RundownId, ShowStyleBaseId>,
	orderedAllPartIds: PartId[],
	currentPartInstance: PartInstance | undefined,
	nextPartInstance: PartInstance | undefined,
	segmentsFindOne: SegmentsFindOne,
	getSegmentsAndPartsSync: GetSegmentsAndPartsSync,
	getActivePartInstances: GetActivePartInstances,
	piecesFind: PiecesFind,
	pieceInstancesFind: PieceInstancesFind,
	getCurrentTime: GetCurrentTime = () => Date.now(),
	invalidateAfter: ((timeoutMs: number) => void) | undefined,
	includeDisabledPieces: boolean = false,
	showHiddenSourceLayers: boolean = false,
	defaultDisplayDuration: number = 0 // I think 0 here is reasonable, and should be overridden by an actual value when used in a UI.
): {
	/** A Segment with some additional information */
	segmentExtended: SegmentExtended
	/** Parts in the segment, with additional information on the Part and the Pieces */
	parts: Array<PartExtended>
	/** A flag if the segment is currently on air (one of it's Parts is on air) */
	isLiveSegment: boolean
	/** A flag if the segment is currently next (one of it's Parts is on air) */
	isNextSegment: boolean
	/** The part that is currently on air, if the Segment is on air */
	currentLivePart: PartExtended | undefined
	/** The part that is currently set as next, if the Segment is next */
	currentNextPart: PartExtended | undefined
	/** A flag if any of the Parts have a Piece on a Layer with the 'Remote' flag on */
	hasRemoteItems: boolean
	/** A flag if any of the Parts have a Piece on a Layer with the 'Guest' flag on */
	hasGuestItems: boolean
	/** A flag if any of the Parts have already played */
	hasAlreadyPlayed: boolean
	/** A flag if the current on air part (doesn't have to be of this segment) will autonext */
	autoNextPart: boolean
} {
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
	const segmentInfo = getSegmentsWithPartInstances(
		playlist,
		getSegmentsAndPartsSync,
		getActivePartInstances,
		{
			_id: segment._id,
		},
		{
			segmentId: segment._id,
		},
		{
			segmentId: segment._id,
		},
		undefined,
		undefined,
		{
			fields: {
				isTaken: 0,
				previousPartEndState: 0,
			},
		}
	)[0] as { segment: DBSegment; partInstances: PartInstanceLimited[] } | undefined

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

			const rawPieceInstances = getPieceInstancesForPartInstance(
				playlist.activationId,
				rundown,
				segment,
				partInstance,
				new Set(partIds.slice(0, itIndex)),
				segmentsToReceiveOnRundownEndFromSet,
				rundownsToReceiveOnShowStyleEndFrom,
				rundownsToShowStyles,
				orderedAllPartIds,
				nextPartIsAfterCurrentPart,
				currentPartInstance,
				currentPartInstance
					? (segmentsFindOne(currentPartInstance.segmentId, {
							projection: {
								_id: 1,
								orphaned: 1,
							},
						}) as Pick<DBSegment, '_id' | 'orphaned'> | undefined)
					: undefined,
				currentPartInstance
					? pieceInstancesFind(
							{
								partInstanceId: currentPartInstance._id,
							},
							pieceInstanceFieldOptions
						)
					: undefined,
				studio?.settings.allowTestingAdlibsToPersist ?? false,
				piecesFind,
				pieceInstancesFind,
				getCurrentTime,
				undefined,
				pieceInstanceFieldOptions,
				invalidateAfter
			)

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
				// check if the Pieces should be cropped (as should be the case if an item on a layer is placed after
				// an infinite Piece) and limit the width of the labels so that they dont go under or over the next Piece.
				for (let i = 0; i < itemsByLayer.length; i++) {
					// const layerId = itemsByLayer[i][0]
					const layerItems = itemsByLayer[i][1]
					// sort on rendered in-point and then on priority
					const sortedItems = layerItems.sort(
						(a, b) =>
							(a.renderedInPoint || 0) - (b.renderedInPoint || 0) ||
							a.instance.priority - b.instance.priority ||
							(a.sourceLayer?._rank || 0) - (b.sourceLayer?._rank || 0)
					)
					for (let i = 0; i < sortedItems.length; i++) {
						const currentItem = sortedItems[i]
						const previousItem = sortedItems[i - 1] as PieceExtended | undefined

						// This block, along with a some of the adjacent code has been removed at the request of
						// Jesper Stærkær making all infinite pieces that do not start in a given Part lose their
						// labels. I'm keeping it here, in case someone realizes this was a horrible mistake,
						// and we can skip all of the head-scratching. -- Jan Starzak, 2021/10/14
						//
						// const possibleBuddyPiece = lastPartPiecesBySourceLayer[layerId]
						// if (
						// 	possibleBuddyPiece &&
						// 	possibleBuddyPiece.instance.piece.lifespan !== PieceLifespan.WithinPart &&
						// 	currentItem.instance.infinite &&
						// 	possibleBuddyPiece.instance.infinite &&
						// 	(possibleBuddyPiece.instance.infinite.infiniteInstanceId ===
						// 		currentItem.instance.infinite.infiniteInstanceId ||
						// 		possibleBuddyPiece.instance.infinite.infinitePieceId ===
						// 			currentItem.instance.infinite.infinitePieceId)
						// ) {
						// 	currentItem.hasOriginInPreceedingPart = true
						// }
						if (currentItem.instance.piece.startPartId !== part.instance.part._id) {
							currentItem.hasOriginInPreceedingPart = true
						}

						if (
							previousItem !== undefined && // on i === 0, previousItem will be undefined
							previousItem.renderedInPoint !== null &&
							currentItem.renderedInPoint !== null &&
							previousItem.renderedInPoint !== undefined &&
							currentItem.renderedInPoint !== undefined &&
							previousItem.renderedDuration !== undefined &&
							currentItem.renderedDuration !== undefined
						) {
							// if previousItem is infinite, currentItem caps it within the current part
							if (previousItem.instance.infinite) {
								;(previousItem.instance.piece as PieceInstancePiece).lifespan = PieceLifespan.WithinPart
								delete (previousItem.instance as PieceInstance).infinite
							}

							if (
								// previousItem spans beyond the currentItem renderedInPoint
								(previousItem.renderedDuration !== null &&
									previousItem.renderedInPoint + previousItem.renderedDuration >
										currentItem.renderedInPoint) ||
								// previousItem is infinite
								previousItem.renderedDuration === null
							) {
								previousItem.renderedDuration =
									currentItem.renderedInPoint - previousItem.renderedInPoint
								previousItem.cropped = true
							}

							previousItem.maxLabelWidth = currentItem.renderedInPoint - previousItem.renderedInPoint
						}

						if (currentItem.renderedDuration === null && i === sortedItems.length - 1) {
							// only if this is the very last piece on this layer
							// thisLastPartPiecesBySourceLayer[layerId] = currentItem
						}
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

/**
 * Get all PartInstances (or temporary PartInstances) all segments in all rundowns in a playlist, using given queries
 * to limit the data, in correct order.
 *
 * @export
 * @param {DBRundownPlaylist} playlist
 * @param {(MongoQuery<DBSegment>)} [segmentsQuery]
 * @param {GetSegmentsAndPartsSync} [getSegmentsAndPartsSync]
 * @param {GetActivePartInstances} [getActivePartInstances]
 * @param {(MongoQuery<DBPart>)} [partsQuery]
 * @param {MongoQuery<PartInstance>} [partInstancesQuery]
 * @param {FindOptions<DBSegment>} [segmentsOptions]
 * @param {FindOptions<DBPart>} [partsOptions]
 * @param {FindOptions<PartInstance>} [partInstancesOptions]
 * @return {*}  {Array<{ segment: Segment; partInstances: PartInstance[] }>}
 */
export function getSegmentsWithPartInstances(
	playlist: DBRundownPlaylist,
	getSegmentsAndPartsSync: GetSegmentsAndPartsSync,
	getActivePartInstances: GetActivePartInstances,
	segmentsQuery?: MongoQuery<DBSegment>,
	partsQuery?: MongoQuery<DBPart>,
	partInstancesQuery?: MongoQuery<PartInstance>,
	segmentsOptions?: FindOptions<DBSegment>,
	partsOptions?: FindOptions<DBPart>,
	partInstancesOptions?: FindOptions<PartInstance>
): Array<{ segment: DBSegment; partInstances: PartInstance[] }> {
	const { segments, parts: rawParts } = getSegmentsAndPartsSync(
		playlist,
		segmentsQuery,
		partsQuery,
		segmentsOptions,
		partsOptions
	)
	const rawPartInstances = getActivePartInstances(playlist, partInstancesQuery, partInstancesOptions)
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
	partsToReceiveOnSegmentEndFromSet: Set<PartId>,
	segmentsToReceiveOnRundownEndFromSet: Set<SegmentId>,
	rundownsToReceiveOnShowStyleEndFrom: RundownId[],
	piecesFind: PiecesFind,
	/** Map of Pieces on Parts, passed through for performance */
	allPiecesCache?: Map<PartId | null, Piece[]>
): Piece[] {
	let piecesStartingInPart: Piece[]
	const allPieces = allPiecesCache?.get(part._id)
	const selector = buildPiecesStartingInThisPartQuery(part)
	if (allPieces) {
		// Fast-path: if we already have the pieces, we can use them directly:
		piecesStartingInPart = mongoWhereFilter(allPieces, selector)
	} else {
		piecesStartingInPart = piecesFind(selector)
	}

	const partsToReceiveOnSegmentEndFrom = Array.from(partsToReceiveOnSegmentEndFromSet.values())
	const segmentsToReceiveOnRundownEndFrom = Array.from(segmentsToReceiveOnRundownEndFromSet.values())

	const infinitePieceQuery = buildPastInfinitePiecesForThisPartQuery(
		part,
		partsToReceiveOnSegmentEndFrom,
		segmentsToReceiveOnRundownEndFrom,
		rundownsToReceiveOnShowStyleEndFrom
	)
	let infinitePieces: Piece[]
	if (allPieces) {
		// Fast-path: if we already have the pieces, we can use them directly:
		infinitePieces = infinitePieceQuery ? mongoWhereFilter(allPieces, infinitePieceQuery) : []
	} else {
		infinitePieces = infinitePieceQuery ? piecesFind(infinitePieceQuery) : []
	}

	return piecesStartingInPart.concat(infinitePieces) // replace spread with concat, as 3x is faster (https://stackoverflow.com/questions/48865710/spread-operator-vs-array-concat)
}

const SIMULATION_INVALIDATION = 3000

/**
 * Get the PieceInstances for a given PartInstance. Will create temporary PieceInstances, based on the Pieces collection
 * if the partInstance is temporary.
 *
 * @export
 * @param {PartInstanceLimited} partInstance
 * @param {Set<PartId>} partsToReceiveOnSegmentEndFromSet
 * @param {Set<SegmentId>} segmentsToReceiveOnRundownEndFromSet
 * @param {PartId[]} orderedAllParts
 * @param {boolean} nextPartIsAfterCurrentPart
 * @param {(PartInstance | undefined)} currentPartInstance
 * @param {(PieceInstance[] | undefined)} currentPartInstancePieceInstances
 * @param {boolean} allowTestingAdlibsToPersist Studio config parameter to allow infinite adlibs from adlib testing to persist in the rundown
 * @param {PiecesFind} [piecesFind]
 * @param {PieceInstancesFind} [pieceInstancesFind]
 * @param {GetCurrentTime} [getCurrentTime]
 * @param {Map<PartId | null, Piece[]>} [allPiecesCache]
 * @param {FindOptions<PieceInstance>} [options]
 * @param {((timeoutMs: number) => void)} [invalidateAfter] Optional callback triggered if the function returns simulated PieceInstances (fallback).
 * 		If provided, it will be executed with a timeout (ms) indicating when the simulation should be considered stale and the data should be re-evaluated.
 * 		Used to handle the data-sync gap during "Take" or "Next" operations.
 * @return {*}
 */
export function getPieceInstancesForPartInstance(
	playlistActivationId: RundownPlaylistActivationId | undefined,
	rundown: Pick<Rundown, '_id' | 'showStyleBaseId'>,
	segment: Pick<DBSegment, '_id' | 'orphaned'>,
	partInstance: PartInstanceLimited,
	partsToReceiveOnSegmentEndFromSet: Set<PartId>,
	segmentsToReceiveOnRundownEndFromSet: Set<SegmentId>,
	rundownsToReceiveOnShowStyleEndFrom: RundownId[],
	rundownsToShowstyles: ReadonlyMap<RundownId, ShowStyleBaseId>,
	orderedAllParts: PartId[],
	nextPartIsAfterCurrentPart: boolean,
	currentPartInstance: PartInstance | undefined,
	currentSegment: Pick<DBSegment, '_id' | 'orphaned'> | undefined,
	currentPartInstancePieceInstances: PieceInstance[] | undefined,
	allowTestingAdlibsToPersist: boolean,
	piecesFind: PiecesFind,
	pieceInstancesFind: PieceInstancesFind,
	getCurrentTime: GetCurrentTime = () => Date.now(),
	allPiecesCache?: Map<PartId | null, Piece[]>,
	options?: FindOptions<PieceInstance>,
	invalidateAfter?: (timeoutMs: number) => void
): PieceInstance[] {
	if (segment.orphaned === SegmentOrphanedReason.ADLIB_TESTING) {
		// When in the AdlibTesting segment, don't allow searching other segments/rundowns for infinites to continue
		segmentsToReceiveOnRundownEndFromSet = new Set()
		rundownsToReceiveOnShowStyleEndFrom = []
	}

	if (partInstance.isTemporary) {
		return getPieceInstancesForPart(
			playlistActivationId || protectString(''),
			currentPartInstance,
			currentSegment,
			currentPartInstancePieceInstances,
			rundown,
			segment,
			partInstance.part,
			partsToReceiveOnSegmentEndFromSet,
			segmentsToReceiveOnRundownEndFromSet,
			rundownsToReceiveOnShowStyleEndFrom,
			rundownsToShowstyles,
			fetchPiecesThatMayBeActiveForPart(
				partInstance.part,
				partsToReceiveOnSegmentEndFromSet,
				segmentsToReceiveOnRundownEndFromSet,
				rundownsToReceiveOnShowStyleEndFrom,
				piecesFind,
				allPiecesCache
			),
			orderedAllParts,
			partInstance._id,
			nextPartIsAfterCurrentPart,
			partInstance.isTemporary,
			allowTestingAdlibsToPersist
		)
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

			return getPieceInstancesForPart(
				playlistActivationId || protectString(''),
				currentPartInstance,
				currentSegment,
				currentPartInstancePieceInstances,
				rundown,
				segment,
				partInstance.part,
				partsToReceiveOnSegmentEndFromSet,
				segmentsToReceiveOnRundownEndFromSet,
				rundownsToReceiveOnShowStyleEndFrom,
				rundownsToShowstyles,
				fetchPiecesThatMayBeActiveForPart(
					partInstance.part,
					partsToReceiveOnSegmentEndFromSet,
					segmentsToReceiveOnRundownEndFromSet,
					rundownsToReceiveOnShowStyleEndFrom,
					piecesFind,
					allPiecesCache
				),
				orderedAllParts,
				partInstance._id,
				nextPartIsAfterCurrentPart,
				true,
				allowTestingAdlibsToPersist
			)
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

export function isUIShowStyleBase(value: unknown): value is UIShowStyleBase {
	if (!value || typeof value !== 'object') return false

	const v = value as Partial<UIShowStyleBase>

	return (
		typeof v.sourceLayers === 'object' &&
		v.sourceLayers !== null &&
		typeof v.outputLayers === 'object' &&
		v.outputLayers !== null
	)
}
