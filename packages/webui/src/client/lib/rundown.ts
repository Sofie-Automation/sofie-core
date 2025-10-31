import _ from 'underscore'
import { PieceUi, PartUi } from '../ui/SegmentTimeline/SegmentTimelineContainer.js'
import { Timecode } from '@sofie-automation/corelib/dist/index'
import { Settings } from '../lib/Settings.js'
import {
	SourceLayerType,
	PieceLifespan,
	IBlueprintActionManifestDisplay,
	IBlueprintActionManifestDisplayContent,
	IOutputLayer,
	ISourceLayer,
} from '@sofie-automation/blueprints-integration'
import {
	SegmentExtended,
	PartExtended,
	getPieceInstancesForPartInstance,
	PieceExtended,
	IOutputLayerExtended,
	ISourceLayerExtended,
	PartInstanceLimited,
	isLoopRunning,
} from './RundownResolver.js'
import { PartInstance, wrapPartToTemporaryInstance } from '@sofie-automation/meteor-lib/dist/collections/PartInstances'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { literal, protectString, groupByToMap } from './tempLib.js'
import { getCurrentTime } from './systemTime.js'
import {
	createPartCurrentTimes,
	processAndPrunePieceInstanceTimings,
	resolvePrunedPieceInstance,
} from '@sofie-automation/corelib/dist/playout/processAndPrune'
import { PieceInstance, PieceInstancePiece } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { IAdLibListItem } from '../ui/Shelf/AdLibListItem.js'
import { BucketAdLibItem, BucketAdLibUi } from '../ui/Shelf/RundownViewBuckets.js'
import { FindOptions } from '../collections/lib.js'
import { getShowHiddenSourceLayers } from './localStorage.js'
import { Rundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { IStudioSettings } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { calculatePartInstanceExpectedDurationWithTransition } from '@sofie-automation/corelib/dist/playout/timings'
import { AdLibPieceUi } from './shelf.js'
import { UIShowStyleBase } from '@sofie-automation/meteor-lib/dist/api/showStyles'
import { PartId, PieceId, RundownId, SegmentId, ShowStyleBaseId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { PieceInstances, Segments } from '../collections/index.js'
import { PieceStatusCode } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { assertNever } from '@sofie-automation/shared-lib/dist/lib/lib'
import { UIStudio } from '@sofie-automation/meteor-lib/dist/api/studios'
import { MongoQuery } from '@sofie-automation/corelib/dist/mongo'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { RundownPlaylistClientUtil } from './rundownPlaylistUtil.js'

export namespace RundownUtils {
	export function padZeros(input: number, places?: number): string {
		places = places ?? 2
		return input.toString(10).padStart(places, '0')
	}

	export function getSegmentDuration(
		parts: Array<PartUi>,
		// pieces: Map<PartId, CalculateTimingsPiece[]>,
		display?: boolean
	): number {
		return parts.reduce((memo, part) => {
			return (
				memo +
				(part.instance.timings?.duration ||
					calculatePartInstanceExpectedDurationWithTransition(part.instance) ||
					part.renderedDuration ||
					(display ? Settings.defaultDisplayDuration : 0))
			)
		}, 0)
	}

	export function formatTimeToTimecode(
		studioSettings: Pick<IStudioSettings, 'frameRate'>,
		milliseconds: number,
		showPlus?: boolean,
		enDashAsMinus?: boolean,
		hideFrames?: boolean
	): string {
		let sign = ''
		if (milliseconds < 0) {
			milliseconds = milliseconds * -1
			sign = enDashAsMinus ? '\u2013' : '-'
		} else {
			if (showPlus) sign = '+'
		}
		const tc = Timecode.init({
			framerate: studioSettings.frameRate + '',
			timecode: (milliseconds * studioSettings.frameRate) / 1000,
			drop_frame: !Number.isInteger(studioSettings.frameRate),
		})
		const timeCodeString: string = tc.toString()
		return sign + (hideFrames ? timeCodeString.substr(0, timeCodeString.length - 3) : timeCodeString)
	}

	export function formatTimeToShortTime(milliseconds: number): string {
		return formatDiffToTimecode(Math.max(milliseconds, 0), false)
	}

	export function formatDiffToTimecode(
		milliseconds: number,
		showPlus?: boolean,
		showHours?: boolean,
		enDashAsMinus?: boolean,
		useSmartFloor?: boolean,
		useSmartHours?: boolean,
		minusPrefix?: string,
		floorTime?: boolean,
		hardFloor?: boolean
	): string {
		let isNegative = milliseconds < 0
		if (isNegative) {
			milliseconds = milliseconds * -1
		}

		let hours = 0

		let minutes = Math.floor(milliseconds / (60 * 1000))
		hours = Math.floor(minutes / 60)
		if (showHours || (useSmartHours && hours > 0)) {
			minutes = minutes % 60
		}
		let secondsRest
		if (!hardFloor) {
			if (floorTime) {
				secondsRest = useSmartFloor
					? milliseconds < 100
						? 0
						: Math.floor(Math.floor(milliseconds % (60 * 1000)) / 1000)
					: Math.floor(Math.floor(milliseconds % (60 * 1000)) / 1000)
			} else {
				secondsRest = useSmartFloor
					? milliseconds < 100
						? 0
						: Math.ceil(Math.floor(milliseconds % (60 * 1000)) / 1000)
					: Math.ceil(Math.floor(milliseconds % (60 * 1000)) / 1000)

				// cascade the overflowing second
				let overflow = secondsRest % 60
				if (overflow !== secondsRest) {
					secondsRest = overflow
					overflow = ++minutes % 60
					if (overflow !== minutes) {
						minutes = overflow
						hours++
					}
				}
			}
		} else {
			if (!isNegative) {
				secondsRest = useSmartFloor
					? milliseconds < 100
						? 0
						: Math.floor(Math.floor(milliseconds % (60 * 1000)) / 1000)
					: Math.floor(Math.floor(milliseconds % (60 * 1000)) / 1000)
			} else {
				secondsRest = useSmartFloor
					? milliseconds < 100
						? 0
						: Math.ceil(Math.floor(milliseconds % (60 * 1000)) / 1000)
					: Math.ceil(Math.floor(milliseconds % (60 * 1000)) / 1000)

				// cascade the overflowing second
				let overflow = secondsRest % 60
				if (overflow !== secondsRest) {
					secondsRest = overflow
					overflow = ++minutes % 60
					if (overflow !== minutes) {
						minutes = overflow
						hours++
					}
				}
			}

			// a hack for very close to 0 to be negative
			if (hours === 0 && minutes === 0 && secondsRest === 0) {
				isNegative = true
			}
		}

		return (
			(isNegative
				? minusPrefix !== undefined
					? minusPrefix
					: enDashAsMinus
						? '\u2013'
						: '-'
				: showPlus && milliseconds > 0
					? '+'
					: '') +
			(showHours || (useSmartHours && hours > 0) ? padZeros(hours) + ':' : '') +
			padZeros(minutes) +
			':' +
			padZeros(secondsRest)
		)
	}

	export function isInsideViewport(
		scrollLeft: number,
		scrollWidth: number,
		part: PartUi,
		partStartsAt: number | undefined,
		partDuration: number | undefined,
		piece?: PieceUi
	): boolean {
		if (
			scrollLeft + scrollWidth <
			(partStartsAt || part.startsAt || 0) + (piece !== undefined ? piece.renderedInPoint || 0 : 0)
		) {
			return false
		} else if (
			scrollLeft >
			(partStartsAt || part.startsAt || 0) +
				(piece !== undefined
					? (piece.renderedInPoint || 0) +
						(piece.renderedDuration ||
							(part.instance.timings?.duration !== undefined
								? part.instance.timings.duration + (part.instance.timings?.playOffset || 0)
								: (partDuration ||
										part.renderedDuration ||
										calculatePartInstanceExpectedDurationWithTransition(part.instance) ||
										0) - (piece.renderedInPoint || 0)))
					: part.instance.timings?.duration !== undefined
						? part.instance.timings.duration + (part.instance.timings?.playOffset || 0)
						: partDuration || part.renderedDuration || 0)
		) {
			return false
		}
		return true
	}

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
	 * This method is primarily used by the GUI to visualize segments, but other functions
	 * utilize it as well when information about timing & time placement is needed.
	 *
	 * @export
	 * @param {ShowStyleBase} showStyleBase
	 * @param {UIStudio} studio
	 * @param {DBRundownPlaylist} playlist
	 * @param {DBSegment} segment
	 * @param {Set<SegmentId>} segmentsToReceiveOnRundownEndFromSet
	 * @param {PartId[]} orderedAllPartIds
	 * @param {PartInstance | undefined } currentPartInstance
	 * @param {PartInstance | undefined } nextPartInstance
	 * @param {boolean} [pieceInstanceSimulation=false] Can be used client-side to simulate the contents of a
	 * 		PartInstance, whose contents are being streamed in. When ran in a reactive context, the computation will
	 * 		be eventually invalidated so that the actual data can be streamed in (to show that the part is actually empty)
	 * @param {boolean} [includeDisabledPieces=false] In some uses (like when previewing a Segment in the GUI) it's needed
	 * 		to consider disabled Piecess as where they are, instead of stripping them out. When enabled, the method will
	 * 		keep them in the result set.
	 * @return {*}  {({
	 */
	export function getResolvedSegment(
		showStyleBase: UIShowStyleBase,
		studio: UIStudio | undefined,
		playlist: DBRundownPlaylist,
		rundown: Pick<Rundown, '_id' | 'showStyleBaseId'>,
		segment: DBSegment,
		segmentsToReceiveOnRundownEndFromSet: Set<SegmentId>,
		rundownsToReceiveOnShowStyleEndFrom: RundownId[],
		rundownsToShowstyles: ReadonlyMap<RundownId, ShowStyleBaseId>,
		orderedAllPartIds: PartId[],
		currentPartInstance: PartInstance | undefined,
		nextPartInstance: PartInstance | undefined,
		pieceInstanceSimulation = false,
		includeDisabledPieces = false
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

		let autoNextPart = false

		const segmentExtended = literal<SegmentExtended>({
			...segment,
			/** Create maps for outputLayers and sourceLayers */
			outputLayers: {},
			sourceLayers: {},
		})

		// fetch all the parts for the segment
		let partsE: Array<PartExtended> = []

		const segmentInfo = getSegmentsWithPartInstances(
			playlist,
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

			const deduplicatedPartInstances = RundownUtils.deduplicatePartInstancesForQuickLoop(
				playlist,
				segmentInfo.partInstances,
				currentPartInstance
			)

			// fetch all the pieces for the parts
			const partIds = deduplicatedPartInstances.map((part) => part.part._id)

			let nextPartIsAfterCurrentPart = false
			if (nextPartInstance && currentPartInstance) {
				if (nextPartInstance.segmentId === currentPartInstance.segmentId) {
					nextPartIsAfterCurrentPart = currentPartInstance.part._rank < nextPartInstance.part._rank
				} else {
					const nextPartSegment = Segments.findOne(
						{
							_id: nextPartInstance.segmentId,
						},
						{ fields: { _rank: 1 } }
					)
					const currentPartSegment = Segments.findOne(
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

			const showHiddenSourceLayers = getShowHiddenSourceLayers()

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
					rundownsToShowstyles,
					orderedAllPartIds,
					nextPartIsAfterCurrentPart,
					currentPartInstance,
					currentPartInstance
						? (Segments.findOne(currentPartInstance.segmentId, {
								projection: {
									_id: 1,
									orphaned: 1,
								},
							}) as Pick<DBSegment, '_id' | 'orphaned'> | undefined)
						: undefined,
					currentPartInstance
						? PieceInstances.find(
								{
									partInstanceId: currentPartInstance._id,
								},
								pieceInstanceFieldOptions
							).fetch()
						: undefined,
					studio?.settings.allowTestingAdlibsToPersist ?? false,
					undefined,
					pieceInstanceFieldOptions,
					pieceInstanceSimulation
				)

				const partTimes = createPartCurrentTimes(
					getCurrentTime(),
					partE.instance.timings?.plannedStartedPlayback
				)
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
				partE.renderedDuration = partE.renderedDuration || Settings.defaultDisplayDuration

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
									;(previousItem.instance.piece as PieceInstancePiece).lifespan =
										PieceLifespan.WithinPart
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

	export function isPieceInstance(
		piece: BucketAdLibItem | IAdLibListItem | PieceUi | AdLibPieceUi
	): piece is PieceUi {
		if ('instance' in piece && piece['instance'] && (!('name' in piece) || piece['name'] === undefined)) {
			return true
		}
		return false
	}

	export function isAdLibPiece(
		piece: PieceUi | IAdLibListItem | BucketAdLibItem
	): piece is IAdLibListItem | BucketAdLibUi {
		if (('instance' in piece && piece['instance']) || !('name' in piece) || piece['name'] === undefined) {
			return false
		}
		return true
	}

	export function isAdLibPieceOrAdLibListItem(
		piece: IAdLibListItem | PieceUi | AdLibPieceUi | BucketAdLibItem
	): piece is IAdLibListItem | AdLibPieceUi | BucketAdLibItem {
		if (('instance' in piece && piece['instance']) || !('name' in piece) || piece['name'] === undefined) {
			return false
		}
		return true
	}

	export function isAdLibActionItem(piece: IAdLibListItem | AdLibPieceUi | BucketAdLibItem): boolean {
		if ('adlibAction' in piece && piece['adlibAction']) {
			return true
		}
		return false
	}

	export function isAdlibActionContent(
		display: IBlueprintActionManifestDisplay | IBlueprintActionManifestDisplayContent
	): display is IBlueprintActionManifestDisplayContent {
		if ((display as any).sourceLayerId !== undefined) {
			return true
		}
		return false
	}

	export function isBucketAdLibItem(
		piece: IAdLibListItem | PieceUi | AdLibPieceUi | BucketAdLibItem
	): piece is BucketAdLibItem {
		return 'bucketId' in piece && !!piece['bucketId']
	}

	export function deduplicatePartInstancesForQuickLoop<T extends Pick<PartInstance, '_id' | 'part'>>(
		playlist: DBRundownPlaylist,
		sortedPartInstances: T[],
		currentPartInstance: T | undefined
	): T[] {
		if (!isLoopRunning(playlist)) return sortedPartInstances
		return sortedPartInstances.filter((partInstance) => {
			return (
				partInstance.part._id !== currentPartInstance?.part._id || partInstance._id === currentPartInstance._id
			)
		})
	}

	/**
	 * Get all PartInstances (or temporary PartInstances) all segments in all rundowns in a playlist, using given queries
	 * to limit the data, in correct order.
	 *
	 * @export
	 * @param {DBRundownPlaylist} playlist
	 * @param {(MongoQuery<DBSegment>)} [segmentsQuery]
	 * @param {(MongoQuery<DBPart>)} [partsQuery]
	 * @param {MongoQuery<PartInstance>} [partInstancesQuery]
	 * @param {FindOptions<DBSegment>} [segmentsOptions]
	 * @param {FindOptions<DBPart>} [partsOptions]
	 * @param {FindOptions<PartInstance>} [partInstancesOptions]
	 * @return {*}  {Array<{ segment: Segment; partInstances: PartInstance[] }>}
	 */
	export function getSegmentsWithPartInstances(
		playlist: DBRundownPlaylist,
		segmentsQuery?: MongoQuery<DBSegment>,
		partsQuery?: MongoQuery<DBPart>,
		partInstancesQuery?: MongoQuery<PartInstance>,
		segmentsOptions?: FindOptions<DBSegment>,
		partsOptions?: FindOptions<DBPart>,
		partInstancesOptions?: FindOptions<PartInstance>
	): Array<{ segment: DBSegment; partInstances: PartInstance[] }> {
		const { segments, parts: rawParts } = RundownPlaylistClientUtil.getSegmentsAndPartsSync(
			playlist,
			segmentsQuery,
			partsQuery,
			segmentsOptions,
			partsOptions
		)
		const rawPartInstances = RundownPlaylistClientUtil.getActivePartInstances(
			playlist,
			partInstancesQuery,
			partInstancesOptions
		)
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
}
