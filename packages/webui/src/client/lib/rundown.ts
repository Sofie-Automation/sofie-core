import { PartUi } from '../ui/SegmentTimeline/SegmentTimelineContainer.js'
import { Timecode } from '@sofie-automation/corelib/dist/index'
import { Settings } from '../lib/Settings.js'
import { TFunction } from 'react-i18next'
import {
	getResolvedSegment as getResolvedSegmentBase,
	getSegmentsWithPartInstances as getSegmentsWithPartInstancesBase,
	getPieceInstancesForPartInstance as getPieceInstancesForPartInstanceBase,
} from '@sofie-automation/corelib/dist/playout/stateCacheResolver'
import {
	SourceLayerType,
	IBlueprintActionManifestDisplay,
	IBlueprintActionManifestDisplayContent,
} from '@sofie-automation/blueprints-integration'
import { DBSegment, SegmentExtended } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { getCurrentTime } from './systemTime.js'
import { PieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { IAdLibListItem } from '../ui/Shelf/AdLibListItem.js'
import { BucketAdLibItem, BucketAdLibUi } from '../ui/Shelf/RundownViewBuckets.js'
import { FindOptions } from '../collections/lib.js'
import { getShowHiddenSourceLayers } from './localStorage.js'
import { Rundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { IStudioSettings, UIStudio } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { calculatePartInstanceExpectedDurationWithTransition } from '@sofie-automation/corelib/dist/playout/timings'
import { AdLibPieceUi } from './shelf.js'
import {
	PartId,
	PieceId,
	PieceInstanceId,
	RundownId,
	RundownPlaylistActivationId,
	SegmentId,
	ShowStyleBaseId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { PieceInstances, Pieces, Segments } from '../collections/index.js'
import { Piece, PieceUi } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { assertNever } from '@sofie-automation/shared-lib/dist/lib/lib'
import { FindOneOptions, MongoQuery } from '@sofie-automation/corelib/dist/mongo'
import { DBPart, PartExtended } from '@sofie-automation/corelib/dist/dataModel/Part'
import { RundownPlaylistClientUtil } from './rundownPlaylistUtil.js'
import { DBShowStyleBase, UIShowStyleBase } from '@sofie-automation/corelib/src/dataModel/ShowStyleBase.js'
import { PartInstance, PartInstanceLimited } from '@sofie-automation/corelib/src/dataModel/PartInstance.js'
import { invalidateAfter } from './invalidatingTime'

const segmentsFindOne = (selector: SegmentId | MongoQuery<DBSegment>, options: FindOneOptions<DBSegment>) =>
	Segments.findOne(selector, options)
const getSegmentsAndPartsSync = (
	playlist: Pick<DBRundownPlaylist, '_id' | 'rundownIdsInOrder'>,
	segmentsQuery?: MongoQuery<DBSegment>,
	partsQuery?: MongoQuery<DBPart>,
	segmentsOptions?: Omit<FindOptions<DBSegment>, 'projection'>,
	partsOptions?: Omit<FindOptions<DBPart>, 'projection'>
) =>
	RundownPlaylistClientUtil.getSegmentsAndPartsSync(
		playlist,
		segmentsQuery,
		partsQuery,
		segmentsOptions,
		partsOptions
	)
const getActivePartInstances = (
	playlist: Pick<DBRundownPlaylist, '_id'>,
	selector?: MongoQuery<PartInstance>,
	options?: FindOptions<PartInstance>
) => RundownPlaylistClientUtil.getActivePartInstances(playlist, selector, options)
const piecesFind = (selector?: MongoQuery<Piece> | PieceId, options?: FindOptions<Piece>) =>
	Pieces.find(selector, options).fetch()
const pieceInstancesFind = (
	selector?: PieceInstanceId | MongoQuery<PieceInstance>,
	options?: FindOptions<PieceInstance>
) => PieceInstances.find(selector, options).fetch()

/**
 * Returns a human-readable, translatable string for a given SourceLayerType.
 */
export function sourceLayerTypeString(t: TFunction<'translation', undefined>, type: SourceLayerType): string {
	switch (type) {
		case SourceLayerType.CAMERA:
			return t('Camera')
		case SourceLayerType.GRAPHICS:
			return t('Graphics')
		case SourceLayerType.LIVE_SPEAK:
			return t('Live Speak')
		case SourceLayerType.LOWER_THIRD:
			return t('Lower Third')
		case SourceLayerType.REMOTE_SPEAK:
			return t('Remote Speak')
		case SourceLayerType.REMOTE:
			return t('Remote Source')
		case SourceLayerType.SCRIPT:
			return t('Generic Script')
		case SourceLayerType.SPLITS:
			return t('Split Screen')
		case SourceLayerType.VT:
			return t('Clips')
		case SourceLayerType.UNKNOWN:
			return t('Unknown Layer')
		case SourceLayerType.AUDIO:
			return t('Audio Mixing')
		case SourceLayerType.LIGHTS:
			return t('Lighting')
		case SourceLayerType.TRANSITION:
			return t('Transition')
		case SourceLayerType.LOCAL:
			return t('Local')
		case SourceLayerType.STUDIO_SCREEN:
			return t('Studio Screen Graphics')
		default:
			assertNever(type)
			return SourceLayerType[type]
	}
}

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
		showStyleBase: DBShowStyleBase | UIShowStyleBase,
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
		return getResolvedSegmentBase(
			showStyleBase,
			studio,
			playlist,
			rundown,
			segment,
			segmentsToReceiveOnRundownEndFromSet,
			rundownsToReceiveOnShowStyleEndFrom,
			rundownsToShowstyles,
			orderedAllPartIds,
			currentPartInstance,
			nextPartInstance,
			segmentsFindOne,
			getSegmentsAndPartsSync,
			getActivePartInstances,
			piecesFind,
			pieceInstancesFind,
			getCurrentTime,
			pieceInstanceSimulation ? invalidateAfter : undefined,
			includeDisabledPieces,
			getShowHiddenSourceLayers(),
			Settings.defaultDisplayDuration
		)
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
		return getSegmentsWithPartInstancesBase(
			playlist,
			getSegmentsAndPartsSync,
			getActivePartInstances,
			segmentsQuery,
			partsQuery,
			partInstancesQuery,
			segmentsOptions,
			partsOptions,
			partInstancesOptions
		)
	}
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
	 * @param {FindOptions<PieceInstance>} [options]
	 * @param {boolean} [pieceInstanceSimulation] If there are no PieceInstances in the PartInstance, create temporary
	 * 		PieceInstances based on the Pieces collection and register a reactive dependency to recalculate the current
	 * 		computation after some time to return the actual PieceInstances for the PartInstance.
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
		/** Map of Pieces on Parts, passed through for performance */
		allPiecesCache?: Map<PartId | null, Piece[]>,
		options?: FindOptions<PieceInstance>,
		pieceInstanceSimulation?: boolean
	): PieceInstance[] {
		return getPieceInstancesForPartInstanceBase(
			playlistActivationId,
			rundown,
			segment,
			partInstance,
			partsToReceiveOnSegmentEndFromSet,
			segmentsToReceiveOnRundownEndFromSet,
			rundownsToReceiveOnShowStyleEndFrom,
			rundownsToShowstyles,
			orderedAllParts,
			nextPartIsAfterCurrentPart,
			currentPartInstance,
			currentSegment,
			currentPartInstancePieceInstances,
			allowTestingAdlibsToPersist,
			piecesFind,
			pieceInstancesFind,
			getCurrentTime,
			allPiecesCache,
			options,
			pieceInstanceSimulation ? invalidateAfter : undefined
		)
	}
}
