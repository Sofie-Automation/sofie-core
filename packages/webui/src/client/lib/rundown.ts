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
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { getCurrentTime } from './systemTime.js'
import { PieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { IAdLibListItem } from '../ui/Shelf/AdLibListItem.js'
import { BucketAdLibItem, BucketAdLibUi } from '../ui/Shelf/RundownViewBuckets.js'
import { FindOptions } from '../collections/lib.js'
import { getShowHiddenSourceLayers } from './localStorage.js'
import { IStudioSettings } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { calculatePartInstanceExpectedDurationWithTransition } from '@sofie-automation/corelib/dist/playout/timings'
import { AdLibPieceUi } from './shelf.js'
import { PieceId, PieceInstanceId, SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { PieceInstances, Pieces, Segments } from '../collections/index.js'
import { Piece, PieceStatusCode, PieceUi } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { assertNever } from '@sofie-automation/shared-lib/dist/lib/lib'
import { FindOneOptions, MongoQuery } from '@sofie-automation/corelib/dist/mongo'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { RundownPlaylistClientUtil } from './rundownPlaylistUtil.js'
import { PartInstance } from '@sofie-automation/corelib/src/dataModel/PartInstance.js'
import { invalidateAfter } from './invalidatingTime'
import {
	PieceInstancesForPartInstanceContext,
	PieceInstancesForPartInstanceWrapperOptions,
	ResolvedSegmentContext,
	ResolvedSegmentResult,
	ResolvedSegmentWrapperOptions,
	SegmentsWithPartInstancesWrapperParams,
} from '@sofie-automation/corelib/src/playout/stateCacheResolverTypes.js'

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

const stateResolverAccessors = {
	segmentsFindOne,
	getSegmentsAndPartsSync,
	getActivePartInstances,
	piecesFind,
	pieceInstancesFind,
}

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

	/** UI wrapper around `corelib.getResolvedSegment` with client-side defaults. */
	export function getResolvedSegment(
		segmentContext: ResolvedSegmentContext,
		options?: ResolvedSegmentWrapperOptions
	): ResolvedSegmentResult {
		return getResolvedSegmentBase({
			...segmentContext,
			accessors: stateResolverAccessors,
			options: {
				getCurrentTime,
				invalidateAfter: options?.pieceInstanceSimulation ? invalidateAfter : undefined,
				includeDisabledPieces: options?.includeDisabledPieces ?? false,
				showHiddenSourceLayers: getShowHiddenSourceLayers(),
				defaultDisplayDuration: Settings.defaultDisplayDuration,
			},
		})
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

	/** UI wrapper around `corelib.getSegmentsWithPartInstances`. */
	export function getSegmentsWithPartInstances(
		playlist: DBRundownPlaylist,
		params?: SegmentsWithPartInstancesWrapperParams
	): Array<{ segment: DBSegment; partInstances: PartInstance[] }> {
		return getSegmentsWithPartInstancesBase({
			playlist,
			accessors: {
				getSegmentsAndPartsSync,
				getActivePartInstances,
			},
			queries: params?.queries,
			options: params?.options,
		})
	}
	/** UI wrapper around `corelib.getPieceInstancesForPartInstance`. */
	export function getPieceInstancesForPartInstance(
		pieceInstanceContext: PieceInstancesForPartInstanceContext,
		options?: PieceInstancesForPartInstanceWrapperOptions
	): PieceInstance[] {
		return getPieceInstancesForPartInstanceBase({
			...pieceInstanceContext,
			accessors: {
				piecesFind,
				pieceInstancesFind,
			},
			options: {
				getCurrentTime,
				allPiecesCache: options?.allPiecesCache,
				pieceInstanceOptions: options?.pieceInstanceOptions,
				invalidateAfter: options?.pieceInstanceSimulation ? invalidateAfter : undefined,
			},
		})
	}
}
