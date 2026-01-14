import {
	Accessor,
	ExpectedPackage,
	ExpectedPackageStatusAPI,
	GraphicsContent,
	ISourceLayer,
	ITranslatableMessage,
	LiveSpeakContent,
	PackageInfo,
	SourceLayerType,
	VTContent,
} from '@sofie-automation/blueprints-integration'
import { getExpectedPackageIdForPieceInstance } from '@sofie-automation/corelib/dist/dataModel/ExpectedPackages'
import {
	BucketId,
	ExpectedPackageId,
	PeripheralDeviceId,
	PieceInstanceId,
	RundownId,
	StudioId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import {
	getPackageContainerPackageId,
	PackageContainerPackageStatusDB,
} from '@sofie-automation/corelib/dist/dataModel/PackageContainerPackageStatus'
import { PieceGeneric, PieceStatusCode } from '@sofie-automation/corelib/dist/dataModel/Piece'
import {
	DBStudio,
	IStudioSettings,
	MappingExt,
	MappingsExt,
	ResultingMappingRoutes,
	StudioPackageContainer,
	StudioRouteSet,
} from '@sofie-automation/corelib/dist/dataModel/Studio'
import { literal, Complete, assertNever, omit, getHash } from '@sofie-automation/corelib/dist/lib'
import { ReadonlyDeep } from 'type-fest'
import _ from 'underscore'
import {
	getExpectedPackageFileName,
	getSideEffect,
} from '@sofie-automation/meteor-lib/dist/collections/ExpectedPackages'
import { getActiveRoutes, getRoutedMappings } from '@sofie-automation/meteor-lib/dist/collections/Studios'
import { ensureHasTrailingSlash } from '@sofie-automation/corelib/dist/lib'
import { protectString, unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { MediaObjects, PackageContainerPackageStatuses, PackageInfos } from '../../collections'
import {
	mediaObjectFieldSpecifier,
	MediaObjectLight,
	packageContainerPackageStatusesFieldSpecifier,
	PackageContainerPackageStatusLight,
	packageInfoFieldSpecifier,
	PackageInfoLight,
	PieceDependencies,
} from './common'
import { PieceContentStatusObj } from '@sofie-automation/corelib/dist/dataModel/PieceContentStatus'
import { PieceContentStatusMessageFactory, PieceContentStatusMessageRequiredArgs } from './messageFactory'
import { PackageStatusMessage } from '@sofie-automation/shared-lib/dist/packageStatusMessages'
import { BucketAdLib } from '@sofie-automation/corelib/dist/dataModel/BucketAdLibPiece'

const DEFAULT_MESSAGE_FACTORY = new PieceContentStatusMessageFactory(undefined)

interface ScanInfoForPackages {
	[packageId: string]: ScanInfoForPackage
}
interface ScanInfoForPackage {
	/** Display name of the package  */
	packageName: string
	containerLabel: string

	scan?: PackageInfo.FFProbeScan['payload']
	deepScan?: PackageInfo.FFProbeDeepScan['payload']
	timebase?: number // derived from scan
}

/**
 * Take properties from the mediainfo / medistream and transform into a
 * formatted string
 */
export function buildFormatString(
	scan_field_order: PackageInfo.FieldOrder | undefined,
	stream: PieceContentStreamInfo
): string {
	let field_order: PackageInfo.FieldOrder
	if (stream.field_order === PackageInfo.FieldOrder.BFF || stream.field_order === PackageInfo.FieldOrder.TFF) {
		// If the stream says it is interlaced, trust that
		field_order = stream.field_order
	} else if (scan_field_order && scan_field_order !== PackageInfo.FieldOrder.Unknown) {
		// Then try the scan if it gave a value
		field_order = scan_field_order
	} else {
		// Fallback to whatever the stream has
		field_order = stream.field_order || PackageInfo.FieldOrder.Unknown
	}

	let format = `${stream.width || 0}x${stream.height || 0}`
	switch (field_order) {
		case PackageInfo.FieldOrder.Progressive:
			format += 'p'
			break
		case PackageInfo.FieldOrder.Unknown:
			format += '?'
			break
		default:
			format += 'i'
			break
	}
	if (stream.r_frame_rate) {
		// More accurate method, for package-manager
		const formattedFramerate = /^(\d+)\/(\d+)$/.exec(stream.r_frame_rate) as RegExpExecArray
		let fps = Number(formattedFramerate[1]) / Number(formattedFramerate[2])
		fps = Math.floor(fps * 100 * 100) / 100
		format += fps
	} else if (stream.codec_time_base) {
		// Less accurate method, for media-manager
		const formattedTimebase = /^(\d+)\/(\d+)$/.exec(stream.codec_time_base) as RegExpExecArray
		let fps = Number(formattedTimebase[2]) / Number(formattedTimebase[1])
		fps = Math.floor(fps * 100 * 100) / 100
		format += fps
	}
	switch (field_order) {
		case PackageInfo.FieldOrder.BFF:
			format += 'bff'
			break
		case PackageInfo.FieldOrder.TFF:
			format += 'tff'
			break
		default:
			break
	}

	return format
}

/**
 * Checks if a source format is an accepted format by doing:
 * For every accepted format, check every parameter (w, h, p/i, fps) against the
 * parameter in the source format. If any of them are not the same: fail for that
 * accepted resolution and move to the next accepted resolution.
 */
export function acceptFormat(format: string, formats: Array<Array<string>>): boolean {
	const match = /((\d+)x(\d+))?((i|p|\?)(\d+))?((tff)|(bff))?/.exec(format)
	if (!match) return false // ingested format string is invalid

	const mediaFormat = match.filter((_o, i) => new Set([2, 3, 5, 6, 7]).has(i))
	for (const candidateFormat of formats) {
		let failed = false
		for (let i = 0; i < candidateFormat.length; i++) {
			if (candidateFormat[i] && candidateFormat[i] !== mediaFormat[i]) {
				failed = true
				break
			}
		}
		if (!failed) return true
	}
	return false
}

/**
 * Convert config field "1920x1080i5000, 1280x720, i5000, i5000tff" into:
 * [
 * 	[1920, 1080, i, 5000, undefined],
 * 	[1280, 720, undefined, undefined, undefined],
 * 	[undefined, undefined, i, 5000, undefined],
 * 	[undefined, undefined, i, 5000, tff]
 * ]
 */
export function getAcceptedFormats(
	settings: Pick<IStudioSettings, 'supportedMediaFormats' | 'frameRate'> | undefined
): Array<Array<string>> {
	const formatsConfigField = settings ? settings.supportedMediaFormats : ''
	const formatsString: string =
		(formatsConfigField && formatsConfigField !== '' ? formatsConfigField : '1920x1080i5000') + ''
	return _.compact(
		formatsString.split(',').map((res) => {
			const match = /((\d+)x(\d+))?((i|p|\?)(\d+))?((tff)|(bff))?/.exec(res.trim())
			if (match) {
				return match.filter((_o, i) => new Set([2, 3, 5, 6, 7]).has(i))
			} else {
				// specified format string was invalid
				return false
			}
		})
	)
}

export function getMediaObjectMediaId(
	piece: Pick<PieceGeneric, 'content'>,
	sourceLayer: ISourceLayer
): string | undefined {
	switch (sourceLayer.type) {
		case SourceLayerType.VT:
			return (piece.content as VTContent)?.fileName?.toUpperCase()
		case SourceLayerType.LIVE_SPEAK:
			return (piece.content as LiveSpeakContent)?.fileName?.toUpperCase()
		case SourceLayerType.TRANSITION:
			return (piece.content as VTContent)?.fileName?.toUpperCase()
		case SourceLayerType.GRAPHICS:
			return (piece.content as GraphicsContent)?.fileName?.toUpperCase()
	}
	return undefined
}

export type PieceContentStatusPiece = Pick<
	PieceGeneric | BucketAdLib,
	'_id' | 'content' | 'expectedPackages' | 'name'
> & {
	pieceInstanceId?: PieceInstanceId
	/**
	 * If this is an infinite continuation, check the previous PieceInstance to fill the gap when package-manager has not processed an adlibbed part
	 */
	previousPieceInstanceId?: PieceInstanceId
}
export interface PieceContentStatusStudio
	extends Pick<DBStudio, '_id' | 'previewContainerIds' | 'thumbnailContainerIds'> {
	/** Mappings between the physical devices / outputs and logical ones */
	mappings: MappingsExt
	/** Route sets with overrides */
	routeSets: Record<string, StudioRouteSet>
	/** Contains settings for which Package Containers are present in the studio.
	 * (These are used by the Package Manager and the Expected Packages)
	 */
	packageContainers: Record<string, StudioPackageContainer>

	settings: IStudioSettings
}

export async function checkPieceContentStatusAndDependencies(
	studio: PieceContentStatusStudio,
	packageOwnerId: RundownId | BucketId | StudioId,
	messageFactory: PieceContentStatusMessageFactory | undefined,
	piece: PieceContentStatusPiece,
	sourceLayer: ISourceLayer
): Promise<[status: PieceContentStatusObj, pieceDependencies: PieceDependencies]> {
	const pieceDependencies: PieceDependencies = {
		mediaObjects: [],
		packageInfos: [],
		packageContainerPackageStatuses: [],
	}

	if (studio.settings.mockPieceContentStatus) {
		return [
			{
				status: PieceStatusCode.OK,
				messages: [],
				progress: undefined,

				freezes: [],
				blacks: [],
				scenes: [],

				thumbnailUrl: '/dev/fakeThumbnail.png',
				previewUrl: '/dev/fakePreview.mp4',

				packageName: null,
				contentDuration: 30 * 1000,
			},
			pieceDependencies,
		]
	}

	const ignoreMediaStatus = piece.content && piece.content.ignoreMediaObjectStatus
	if (!ignoreMediaStatus) {
		if (piece.expectedPackages) {
			const getPackageInfos = async (packageId: ExpectedPackageId) => {
				pieceDependencies.packageInfos.push(packageId)
				return PackageInfos.findFetchAsync(
					{
						studioId: studio._id,
						packageId: packageId,
						type: {
							$in: [PackageInfo.Type.SCAN, PackageInfo.Type.DEEPSCAN],
						},
					},
					{
						projection: packageInfoFieldSpecifier,
					}
				) as Promise<PackageInfoLight[]>
			}

			const getPackageContainerPackageStatus = async (
				packageContainerId: string,
				expectedPackageId: ExpectedPackageId
			) => {
				const id = getPackageContainerPackageId(studio._id, packageContainerId, expectedPackageId)
				pieceDependencies.packageContainerPackageStatuses.push(id)
				return PackageContainerPackageStatuses.findOneAsync(
					{
						_id: id,
						studioId: studio._id,
					},
					{ projection: packageContainerPackageStatusesFieldSpecifier }
				) as Promise<PackageContainerPackageStatusLight | undefined>
			}

			// Using Expected Packages:
			const status = await checkPieceContentExpectedPackageStatus(
				piece,
				sourceLayer,
				studio,
				packageOwnerId,
				getPackageInfos,
				getPackageContainerPackageStatus,
				messageFactory || DEFAULT_MESSAGE_FACTORY
			)
			return [status, pieceDependencies]
		} else {
			// Fallback to MediaObject statuses:
			const getMediaObject = async (mediaId: string) => {
				pieceDependencies.mediaObjects.push(mediaId)
				return MediaObjects.findOneAsync(
					{
						studioId: studio._id,
						mediaId,
					},
					{ projection: mediaObjectFieldSpecifier }
				) as Promise<MediaObjectLight | undefined>
			}

			const status = await checkPieceContentMediaObjectStatus(
				piece,
				sourceLayer,
				studio,
				getMediaObject,
				messageFactory || DEFAULT_MESSAGE_FACTORY
			)
			return [status, pieceDependencies]
		}
	}

	return [
		{
			status: PieceStatusCode.UNKNOWN,
			messages: [],
			progress: undefined,

			freezes: [],
			blacks: [],
			scenes: [],

			thumbnailUrl: undefined,
			previewUrl: undefined,

			packageName: null,
			contentDuration: undefined,
		},
		pieceDependencies,
	]
}

interface MediaObjectMessage {
	status: PieceStatusCode
	message: ITranslatableMessage | null
}

async function checkPieceContentMediaObjectStatus(
	piece: PieceContentStatusPiece,
	sourceLayer: ISourceLayer,
	studio: PieceContentStatusStudio,
	getMediaObject: (mediaId: string) => Promise<MediaObjectLight | undefined>,
	messageFactory: PieceContentStatusMessageFactory
): Promise<PieceContentStatusObj> {
	let metadata: MediaObjectLight | null = null
	const settings: IStudioSettings | undefined = studio?.settings
	let pieceStatus: PieceStatusCode = PieceStatusCode.UNKNOWN

	const ignoreMediaAudioStatus = piece.content && piece.content.ignoreAudioFormat

	let freezes: Array<PackageInfo.Anomaly> = []
	let blacks: Array<PackageInfo.Anomaly> = []
	let scenes: Array<number> = []

	const messages: Array<MediaObjectMessage> = []
	let contentSeemsOK = false
	const fileName = getMediaObjectMediaId(piece, sourceLayer)
	switch (sourceLayer.type) {
		case SourceLayerType.VT:
		case SourceLayerType.LIVE_SPEAK:
		case SourceLayerType.TRANSITION:
			// If the fileName is not set...
			if (!fileName) {
				messages.push({
					status: PieceStatusCode.SOURCE_NOT_SET,
					message: messageFactory.getTranslation(PackageStatusMessage.MISSING_FILE_PATH, {
						sourceLayer: sourceLayer.name,
						pieceName: piece.name,
						fileName: '',
						containerLabels: '',
					}),
				})
			} else {
				const messageRequiredArgs: PieceContentStatusMessageRequiredArgs = {
					sourceLayer: sourceLayer.name,
					pieceName: piece.name,
					fileName: fileName,
					containerLabels: '',
				}
				const mediaObject = await getMediaObject(fileName)
				// If media object not found, then...
				if (!mediaObject) {
					messages.push({
						status: PieceStatusCode.SOURCE_MISSING,
						message: messageFactory.getTranslation(
							PackageStatusMessage.FILE_NOT_YET_READY_ON_PLAYOUT_SYSTEM,
							{
								...messageRequiredArgs,
							}
						),
					})
					// All VT content should have at least two streams
				} else {
					contentSeemsOK = true

					// Do a format check:
					if (mediaObject.mediainfo) {
						if (mediaObject.mediainfo.streams) {
							const pushMessages = (newMessages: Array<ContentMessageLight>) => {
								for (const message of newMessages) {
									messages.push({
										status: message.status,
										message: messageFactory.getTranslation(message.message, {
											...messageRequiredArgs,
											...message.extraArgs,
										}),
									})
								}
							}

							const mediainfo = mediaObject.mediainfo
							const { timebase, messages: formatMessages } = checkStreamFormatsAndCounts(
								mediaObject.mediainfo.streams.map((stream) =>
									// Translate to a package-manager type, for code reuse
									literal<Complete<PieceContentStreamInfo>>({
										width: stream.width,
										height: stream.height,
										time_base: stream.time_base,
										codec_type: stream.codec.type,
										codec_time_base: stream.codec.time_base,
										channels: stream.channels,
										r_frame_rate: undefined,
										field_order: undefined,
									})
								),
								(stream) => buildFormatString(mediainfo.field_order, stream),
								settings,
								sourceLayer,
								ignoreMediaAudioStatus
							)
							pushMessages(formatMessages)

							if (timebase) {
								mediaObject.mediainfo.timebase = timebase

								// check for black/freeze frames
								const sourceDuration = piece.content.sourceDuration

								if (mediaObject.mediainfo.blacks?.length) {
									if (!piece.content.ignoreBlackFrames) {
										const blackMessages = addFrameWarning(
											timebase,
											sourceDuration,
											mediaObject.mediainfo.format?.duration,
											mediaObject.mediainfo.blacks,
											BlackFrameWarnings
										)
										pushMessages(blackMessages)
									}

									blacks = mediaObject.mediainfo.blacks.map((i): PackageInfo.Anomaly => {
										return { start: i.start * 1000, end: i.end * 1000, duration: i.duration * 1000 }
									})
								}
								if (mediaObject.mediainfo.freezes?.length) {
									if (!piece.content.ignoreFreezeFrame) {
										const freezeMessages = addFrameWarning(
											timebase,
											sourceDuration,
											mediaObject.mediainfo.format?.duration,
											mediaObject.mediainfo.freezes,
											FreezeFrameWarnings
										)
										pushMessages(freezeMessages)
									}

									freezes = mediaObject.mediainfo.freezes.map((i): PackageInfo.Anomaly => {
										return { start: i.start * 1000, end: i.end * 1000, duration: i.duration * 1000 }
									})
								}

								if (mediaObject.mediainfo.scenes) {
									scenes = _.compact(mediaObject.mediainfo.scenes.map((i) => i * 1000)) // convert into milliseconds
								}
							}
						}
					} else {
						messages.push({
							status: PieceStatusCode.SOURCE_MISSING,
							message: messageFactory.getTranslation(PackageStatusMessage.FILE_IS_BEING_INGESTED, {
								...messageRequiredArgs,
							}),
						})
					}

					metadata = mediaObject
				}
			}

			break
		case SourceLayerType.GRAPHICS:
			if (fileName) {
				const mediaObject = await getMediaObject(fileName)
				if (!mediaObject) {
					messages.push({
						status: PieceStatusCode.SOURCE_MISSING,
						message: messageFactory.getTranslation(PackageStatusMessage.FILE_IS_MISSING, {
							sourceLayer: sourceLayer.name,
							pieceName: piece.name,
							fileName: fileName,
							containerLabels: '',
						}),
					})
				} else {
					contentSeemsOK = true
					metadata = mediaObject
				}
			}
			break
		// Note: If adding another type here, make sure it is also handled in:
		// getMediaObjectMediaId()
		// * withMediaObjectStatus.tsx (updateMediaObjectSubscription)
	}

	if (messages.length) {
		pieceStatus = messages.reduce((prev, msg) => Math.max(prev, msg.status), PieceStatusCode.UNKNOWN)
	} else {
		if (contentSeemsOK) {
			pieceStatus = PieceStatusCode.OK
		}
	}

	let contentDuration: number | null | undefined = undefined
	if (metadata?.mediainfo?.streams?.length) {
		const maximumStreamDuration = metadata.mediainfo.streams.reduce(
			(prev, current) =>
				current.duration !== undefined ? Math.max(prev, Number.parseFloat(current.duration)) : prev,
			Number.NaN
		)
		contentDuration = Number.isFinite(maximumStreamDuration) ? maximumStreamDuration : undefined
	}

	return {
		status: pieceStatus,
		messages: _.compact(messages.map((msg) => msg.message)),
		progress: 0,

		freezes,
		blacks,
		scenes,

		thumbnailUrl: metadata
			? getAssetUrlFromContentMetaData(metadata, 'thumbnail', studio.settings.mediaPreviewsUrl)
			: undefined,
		previewUrl: metadata
			? getAssetUrlFromContentMetaData(metadata, 'preview', studio.settings.mediaPreviewsUrl)
			: undefined,

		packageName: metadata?.mediaId || null,

		contentDuration,
	}
}

function getAssetUrlFromContentMetaData(
	contentMetaData: MediaObjectLight,
	assetType: 'thumbnail' | 'preview',
	mediaPreviewUrl: string
): string | undefined {
	if (!contentMetaData || !contentMetaData.previewPath) return
	return (
		ensureHasTrailingSlash(mediaPreviewUrl ?? null) +
		`media/${assetType}/` +
		encodeURIComponent(contentMetaData.mediaId)
	)
}

interface ContentMessageLight {
	status: PieceStatusCode
	message: PackageStatusMessage
	customMessage?: string
	extraArgs?: { [key: string]: string | number }
}
interface ContentMessage extends ContentMessageLight {
	fileName: string
	packageContainers: string[]
}

async function checkPieceContentExpectedPackageStatus(
	piece: PieceContentStatusPiece,
	sourceLayer: ISourceLayer,
	studio: PieceContentStatusStudio,
	packageOwnerId: RundownId | BucketId | StudioId,
	getPackageInfos: (packageId: ExpectedPackageId) => Promise<PackageInfoLight[]>,
	getPackageContainerPackageStatus: (
		packageContainerId: string,
		expectedPackageId: ExpectedPackageId
	) => Promise<PackageContainerPackageStatusLight | undefined>,
	messageFactory: PieceContentStatusMessageFactory
): Promise<PieceContentStatusObj> {
	const settings: IStudioSettings | undefined = studio?.settings

	const ignoreMediaAudioStatus = piece.content && piece.content.ignoreAudioFormat

	const messages: Array<ContentMessage> = []
	const pushOrMergeMessage = (newMessage: ContentMessage) => {
		const existingMessage = messages.find((m) =>
			_.isEqual(omit(m, 'packageContainers'), omit(newMessage, 'packageContainers'))
		)
		if (existingMessage) {
			// If we have already added this message, just add the package name to the message
			existingMessage.packageContainers.push(...newMessage.packageContainers)
		} else {
			messages.push(newMessage)
		}
	}

	const packageInfos: ScanInfoForPackages = {}
	let readyCount = 0

	let freezes: Array<PackageInfo.Anomaly> = []
	let blacks: Array<PackageInfo.Anomaly> = []
	let scenes: Array<number> = []
	let packageName: string | null = null

	let thumbnailUrl: string | undefined
	let previewUrl: string | undefined
	let progress: number | undefined

	if (piece.expectedPackages && piece.expectedPackages.length) {
		const routes = getActiveRoutes(studio.routeSets)

		for (const expectedPackage of piece.expectedPackages) {
			// Route the mappings
			const routedDeviceIds = routeExpectedPackage(routes, studio.mappings, expectedPackage)

			const checkedPackageContainers = new Set<string>()

			for (const routedDeviceId of routedDeviceIds) {
				let matchedPackageContainer: [string, ReadonlyDeep<StudioPackageContainer>] | undefined
				for (const packageContainer of Object.entries<ReadonlyDeep<StudioPackageContainer>>(
					studio.packageContainers
				)) {
					if (packageContainer[1].deviceIds.includes(unprotectString(routedDeviceId))) {
						// TODO: how to handle if a device has multiple containers?
						matchedPackageContainer = packageContainer
						break // just picking the first one found, for now
					}
				}

				if (!matchedPackageContainer) {
					continue
				}

				if (checkedPackageContainers.has(matchedPackageContainer[0])) {
					// we have already checked this package container for this expected package
					continue
				}

				checkedPackageContainers.add(matchedPackageContainer[0])

				const expectedPackageIds = [
					// Synthesize the expected packageId from the piece
					// Note: this needs to match the output of getExpectedPackageIdFromIngestSource, but will be reworked properly as part of shared ownership
					protectString(`${packageOwnerId}_${piece._id}_${getHash(expectedPackage._id)}`),
				]
				if (piece.pieceInstanceId) {
					// If this is a PieceInstance, try looking up the PieceInstance first
					expectedPackageIds.unshift(
						getExpectedPackageIdForPieceInstance(piece.pieceInstanceId, expectedPackage._id)
					)

					if (piece.previousPieceInstanceId) {
						// Also try the previous PieceInstance, when this is an infinite continuation in case package-manager needs to catchup
						expectedPackageIds.unshift(
							getExpectedPackageIdForPieceInstance(piece.previousPieceInstanceId, expectedPackage._id)
						)
					}
				}

				const fileName = getExpectedPackageFileName(expectedPackage) ?? ''

				// Check if any of the sources exist and are valid
				// Future: This might be better to do by passing packageManager an 'forcedError' property in the publication, but this direct check is simpler and enough for now
				const hasValidSources =
					expectedPackage.sources &&
					(expectedPackage.sources.length === 0 ||
						!expectedPackage.sources.find((source) => !studio.packageContainers[source.containerId]))
				if (!hasValidSources) {
					// The expected package has no valid sources

					pushOrMergeMessage({
						status: PieceStatusCode.SOURCE_MISSING,
						message: PackageStatusMessage.FILE_MISSING_SOURCE_CONTAINERS,
						fileName: fileName,
						packageContainers: expectedPackage.sources.map((s) => s.containerId), // Ideally this would be labels, but the containers are missing
					})
					continue
				}

				let warningMessage: ContentMessageLight | null = null
				let matchedExpectedPackageId: ExpectedPackageId | null = null
				for (const expectedPackageId of expectedPackageIds) {
					const packageOnPackageContainer = await getPackageContainerPackageStatus(
						matchedPackageContainer[0],
						expectedPackageId
					)
					if (!packageOnPackageContainer) continue

					matchedExpectedPackageId = expectedPackageId

					if (!thumbnailUrl) {
						const sideEffect = getSideEffect(expectedPackage, studio)

						thumbnailUrl = await getAssetUrlFromPackageContainerStatus(
							studio.packageContainers,
							getPackageContainerPackageStatus,
							expectedPackageId,
							sideEffect.thumbnailContainerId,
							sideEffect.thumbnailPackageSettings?.path
						)
					}

					if (!previewUrl) {
						const sideEffect = getSideEffect(expectedPackage, studio)

						previewUrl = await getAssetUrlFromPackageContainerStatus(
							studio.packageContainers,
							getPackageContainerPackageStatus,
							expectedPackageId,
							sideEffect.previewContainerId,
							sideEffect.previewPackageSettings?.path
						)
					}

					warningMessage = getPackageWarningMessage(packageOnPackageContainer.status)

					progress = getPackageProgress(packageOnPackageContainer.status) ?? undefined

					// Found a packageOnPackageContainer
					break
				}

				const containerLabel = matchedPackageContainer[1].container.label

				if (!matchedExpectedPackageId || warningMessage) {
					// If no package matched, we must have a warning
					warningMessage = warningMessage ?? getPackageSourceMissingWarning()

					pushOrMergeMessage({
						...warningMessage,
						fileName: fileName,
						packageContainers: [containerLabel],
					})
				} else {
					// No warning, must be OK

					readyCount++
					packageInfos[expectedPackage._id] = {
						packageName: fileName || expectedPackage._id,
						containerLabel,
					}
					// Fetch scan-info about the package:
					const dbPackageInfos = await getPackageInfos(matchedExpectedPackageId)
					for (const packageInfo of dbPackageInfos) {
						if (packageInfo.type === PackageInfo.Type.SCAN) {
							packageInfos[expectedPackage._id].scan = packageInfo.payload
						} else if (packageInfo.type === PackageInfo.Type.DEEPSCAN) {
							packageInfos[expectedPackage._id].deepScan = packageInfo.payload
						}
					}
				}
			}
		}
	}

	for (const [_packageId, packageInfo] of Object.entries<ScanInfoForPackage>(packageInfos)) {
		const { scan, deepScan } = packageInfo

		if (scan && scan.streams) {
			const pushMessages = (newMessages: Array<ContentMessageLight>) => {
				for (const message of newMessages) {
					pushOrMergeMessage({
						...message,
						fileName: packageInfo.packageName,
						packageContainers: [packageInfo.containerLabel],
					})
				}
			}

			const { timebase, messages: formatMessages } = checkStreamFormatsAndCounts(
				scan.streams,
				(stream) => (deepScan ? buildFormatString(deepScan.field_order, stream) : null),
				settings,
				sourceLayer,
				ignoreMediaAudioStatus
			)
			pushMessages(formatMessages)

			if (timebase) {
				packageInfo.timebase = timebase // what todo?

				// check for black/freeze frames

				const sourceDuration = piece.content.sourceDuration

				if (!piece.content.ignoreBlackFrames && deepScan?.blacks?.length) {
					const blackMessages = addFrameWarning(
						timebase,
						sourceDuration,
						scan.format?.duration,
						deepScan.blacks,
						BlackFrameWarnings
					)
					pushMessages(blackMessages)
				}
				if (!piece.content.ignoreFreezeFrame && deepScan?.freezes?.length) {
					const freezeMessages = addFrameWarning(
						timebase,
						sourceDuration,
						scan.format?.duration,
						deepScan.freezes,
						FreezeFrameWarnings
					)
					pushMessages(freezeMessages)
				}
			}
		}
	}

	const firstPackage = Object.values<ScanInfoForPackage>(packageInfos)[0]
	let contentDuration: number | null | undefined = undefined
	if (firstPackage) {
		// TODO: support multiple packages:
		if (!piece.content.ignoreFreezeFrame && firstPackage.deepScan?.freezes?.length) {
			freezes = firstPackage.deepScan.freezes.map((i): PackageInfo.Anomaly => {
				return { start: i.start * 1000, end: i.end * 1000, duration: i.duration * 1000 }
			})
		}
		if (!piece.content.ignoreBlackFrames && firstPackage.deepScan?.blacks?.length) {
			blacks = firstPackage.deepScan.blacks.map((i): PackageInfo.Anomaly => {
				return { start: i.start * 1000, end: i.end * 1000, duration: i.duration * 1000 }
			})
		}
		if (firstPackage.deepScan?.scenes) {
			scenes = _.compact(firstPackage.deepScan.scenes.map((i) => i * 1000)) // convert into milliseconds
		}

		if (firstPackage.scan?.streams?.length) {
			const maximumStreamDuration = firstPackage.scan.streams.reduce(
				(prev, current) =>
					current.duration !== undefined ? Math.max(prev, Number.parseFloat(current.duration)) : prev,
				Number.NaN
			)
			contentDuration = Number.isFinite(maximumStreamDuration) ? maximumStreamDuration : undefined
		}

		packageName = firstPackage.packageName
	}

	let pieceStatus: PieceStatusCode = PieceStatusCode.UNKNOWN
	if (messages.length) {
		pieceStatus = messages.reduce((prev, msg) => Math.max(prev, msg.status), PieceStatusCode.UNKNOWN)
	} else if (readyCount > 0) {
		pieceStatus = PieceStatusCode.OK
	}

	const translatedMessages = messages.map((msg) => {
		const messageArgs: PieceContentStatusMessageRequiredArgs & { [k: string]: any } = {
			sourceLayer: sourceLayer.name,
			pieceName: piece.name,
			containerLabels: msg.packageContainers.join(', '),
			fileName: msg.fileName,
			...msg.extraArgs,
		}

		return msg.customMessage
			? { key: msg.customMessage, args: messageArgs }
			: messageFactory.getTranslation(msg.message, messageArgs)
	})

	return {
		status: pieceStatus,
		messages: _.compact(translatedMessages),
		progress,

		freezes,
		blacks,
		scenes,

		thumbnailUrl,
		previewUrl,

		packageName,

		contentDuration,
	}
}

async function getAssetUrlFromPackageContainerStatus(
	packageContainers: Record<string, StudioPackageContainer>,
	getPackageContainerPackageStatus: (
		packageContainerId: string,
		expectedPackageId: ExpectedPackageId
	) => Promise<PackageContainerPackageStatusLight | undefined>,
	expectedPackageId: ExpectedPackageId,
	assetContainerId: string | null | undefined,
	packageAssetPath: string | undefined
): Promise<string | undefined> {
	if (!assetContainerId || !packageAssetPath) return

	const assetPackageContainer = packageContainers[assetContainerId]
	if (!assetPackageContainer) return

	const previewPackageOnPackageContainer = await getPackageContainerPackageStatus(assetContainerId, expectedPackageId)
	if (!previewPackageOnPackageContainer) return

	return getAssetUrlFromExpectedPackages(packageAssetPath, assetPackageContainer, previewPackageOnPackageContainer)
}

function getAssetUrlFromExpectedPackages(
	assetPath: string,
	packageContainer: StudioPackageContainer,
	packageOnPackageContainer: Pick<PackageContainerPackageStatusDB, 'status'>
): string | undefined {
	if (packageOnPackageContainer.status.status !== ExpectedPackageStatusAPI.PackageContainerPackageStatusStatus.READY)
		return

	// Look up an accessor we can use:
	for (const accessor of Object.values<Accessor.Any>(packageContainer.container.accessors)) {
		if (
			(accessor.type === Accessor.AccessType.HTTP || accessor.type === Accessor.AccessType.HTTP_PROXY) &&
			accessor.baseUrl
		) {
			// Currently we only support public accessors (ie has no networkId set)
			if (!accessor.networkId) {
				return [
					accessor.baseUrl.replace(/\/$/, ''), // trim trailing slash
					encodeURIComponent(
						assetPath.replace(/^\//, '') // trim leading slash
					),
				].join('/')
			}
		}
	}
}

function getPackageProgress(
	packageOnPackageContainerStatus: ExpectedPackageStatusAPI.PackageContainerPackageStatus | undefined
): number | null {
	return packageOnPackageContainerStatus?.progress ?? null
}

function getPackageSourceMissingWarning(): ContentMessageLight {
	// Examples of contents in packageOnPackageContainer?.status.statusReason.user:
	// * Target package: Quantel clip "XXX" not found
	// * Can't read the Package from PackageContainer "Quantel source 0" (on accessor "${accessorLabel}"), due to: Quantel clip "XXX" not found

	return {
		status: PieceStatusCode.SOURCE_MISSING,
		message: PackageStatusMessage.FILE_CANT_BE_FOUND_ON_PLAYOUT_SYSTEM,
	}
}

function getPackageWarningMessage(
	packageOnPackageContainerStatus: ExpectedPackageStatusAPI.PackageContainerPackageStatus
): ContentMessageLight | null {
	if (
		packageOnPackageContainerStatus.status ===
		ExpectedPackageStatusAPI.PackageContainerPackageStatusStatus.NOT_FOUND
	) {
		return getPackageSourceMissingWarning()
	} else if (
		packageOnPackageContainerStatus.status ===
		ExpectedPackageStatusAPI.PackageContainerPackageStatusStatus.NOT_READY
	) {
		// Examples of contents in packageOnPackageContainer?.status.statusReason.user:
		// * Source file is still growing

		return {
			status: PieceStatusCode.SOURCE_MISSING,
			message: PackageStatusMessage.FILE_EXISTS_BUT_IS_NOT_READY_ON_PLAYOUT_SYSTEM,
			extraArgs: {
				reason: ((packageOnPackageContainerStatus?.statusReason.user || 'N/A') + '.').replace(/\.\.$/, '.'), // remove any trailing double "."
			},
		}
	} else if (
		// Examples of contents in packageOnPackageContainer?.status.statusReason.user:
		// * Reserved clip (0 frames)
		// * Reserved clip (1-9 frames)
		packageOnPackageContainerStatus.status ===
		ExpectedPackageStatusAPI.PackageContainerPackageStatusStatus.PLACEHOLDER
	) {
		return {
			status: PieceStatusCode.SOURCE_NOT_READY,
			message: PackageStatusMessage.FILE_IS_IN_PLACEHOLDER_STATE,
			// remove any trailing double "."
			customMessage: packageOnPackageContainerStatus?.statusReason.user
				? (packageOnPackageContainerStatus?.statusReason.user + '.').replace(/\.\.$/, '.')
				: undefined,
		}
	} else if (
		packageOnPackageContainerStatus.status ===
		ExpectedPackageStatusAPI.PackageContainerPackageStatusStatus.TRANSFERRING_READY
	) {
		return {
			status: PieceStatusCode.OK,
			message: PackageStatusMessage.FILE_IS_TRANSFERRING_TO_PLAYOUT_SYSTEM,
		}
	} else if (
		packageOnPackageContainerStatus.status ===
		ExpectedPackageStatusAPI.PackageContainerPackageStatusStatus.TRANSFERRING_NOT_READY
	) {
		return {
			status: PieceStatusCode.SOURCE_MISSING,
			message: PackageStatusMessage.FILE_IS_TRANSFERRING_TO_PLAYOUT_SYSTEM_NOT_READY,
		}
	} else if (
		packageOnPackageContainerStatus.status === ExpectedPackageStatusAPI.PackageContainerPackageStatusStatus.READY
	) {
		return null
	} else {
		assertNever(packageOnPackageContainerStatus.status)
		return {
			status: PieceStatusCode.SOURCE_UNKNOWN_STATE,
			message: PackageStatusMessage.FILE_IS_IN_UNKNOWN_STATE,
			extraArgs: {
				status: packageOnPackageContainerStatus.status,
			},
		}
	}
}

export type PieceContentStreamInfo = Pick<
	PackageInfo.FFProbeScanStream,
	'width' | 'height' | 'time_base' | 'codec_type' | 'codec_time_base' | 'channels' | 'r_frame_rate' | 'field_order'
>
function checkStreamFormatsAndCounts(
	streams: PieceContentStreamInfo[],
	getScanFormatString: (stream: PieceContentStreamInfo) => string | null,
	studioSettings: IStudioSettings | undefined,
	sourceLayer: ISourceLayer,
	ignoreMediaAudioStatus: boolean | undefined
): { timebase: number; messages: ContentMessageLight[] } {
	const messages: ContentMessageLight[] = []

	if (!ignoreMediaAudioStatus && streams.length < 2 && sourceLayer.type !== SourceLayerType.AUDIO) {
		messages.push({
			status: PieceStatusCode.SOURCE_BROKEN,
			message: PackageStatusMessage.FILE_DOESNT_HAVE_BOTH_VIDEO_AND_AUDIO,
		})
	}
	const formats = getAcceptedFormats(studioSettings)
	const audioConfig = studioSettings ? studioSettings.supportedAudioStreams : ''
	const expectedAudioStreams = audioConfig
		? new Set<string>(audioConfig.split(',').map((v) => v.trim()))
		: new Set<string>()

	let timebase = 0
	let audioStreams = 0
	let isStereo = false

	// check the streams for resolution info
	for (const stream of streams) {
		if (stream.width && stream.height) {
			if (stream.codec_time_base) {
				const formattedTimebase = /^(\d+)\/(\d+)$/.exec(stream.codec_time_base) as RegExpExecArray
				timebase = (1000 * Number(formattedTimebase[1])) / Number(formattedTimebase[2]) || 0
			}

			const deepScanFormat = getScanFormatString(stream)
			if (deepScanFormat) {
				if (!acceptFormat(deepScanFormat, formats)) {
					messages.push({
						status: PieceStatusCode.SOURCE_BROKEN,
						message: PackageStatusMessage.FILE_HAS_WRONG_FORMAT,
						extraArgs: {
							format: deepScanFormat,
						},
					})
				}
			}
		} else if (stream.codec_type === 'audio') {
			// this is the first (and hopefully last) track of audio, and has 2 channels
			if (audioStreams === 0 && stream.channels === 2) {
				isStereo = true
			}
			audioStreams++
		}
	}
	if (
		!ignoreMediaAudioStatus &&
		audioConfig &&
		(!expectedAudioStreams.has(audioStreams.toString()) || (isStereo && !expectedAudioStreams.has('stereo')))
	) {
		messages.push({
			status: PieceStatusCode.SOURCE_BROKEN,
			message: PackageStatusMessage.FILE_HAS_WRONG_AUDIO_STREAMS,
			extraArgs: {
				audioStreams,
			},
		})
	}

	return { timebase, messages }
}

function addFrameWarning(
	timebase: number,
	sourceDuration: number | undefined,
	scannedFormatDuration: number | string | undefined,
	anomalies: Array<PackageInfo.Anomaly>,
	strings: FrameWarningStrings
): ContentMessageLight[] {
	const messages: ContentMessageLight[] = []

	if (anomalies.length === 1) {
		/** Number of frames */
		const frames = Math.ceil((anomalies[0].duration * 1000) / timebase)
		if (anomalies[0].start === 0) {
			messages.push({
				status: PieceStatusCode.SOURCE_HAS_ISSUES,
				message: strings.clipStartsWithCount,
				extraArgs: {
					frames,
					seconds: Math.round(anomalies[0].duration),
				},
			})
		} else if (
			scannedFormatDuration &&
			anomalies[0].end === Number(scannedFormatDuration) &&
			(sourceDuration === undefined || Math.round(anomalies[0].start) * 1000 < sourceDuration)
		) {
			messages.push({
				status: PieceStatusCode.SOURCE_HAS_ISSUES,
				message: strings.clipEndsWithAfter,
				extraArgs: {
					frames: Math.ceil((anomalies[0].start * 1000) / timebase),
					seconds: Math.round(anomalies[0].start),
				},
			})
		} else if (frames > 0) {
			messages.push({
				status: PieceStatusCode.SOURCE_HAS_ISSUES,
				message: strings.countDetectedWithinClip,
				extraArgs: {
					frames,
					seconds: Math.round(anomalies[0].duration),
				},
			})
		}
	} else if (anomalies.length > 0) {
		const dur = anomalies
			.filter((a) => sourceDuration === undefined || a.start * 1000 < sourceDuration)
			.map((b) => b.duration)
			.reduce((a, b) => a + b, 0)
		const frames = Math.ceil((dur * 1000) / timebase)
		if (frames > 0) {
			messages.push({
				status: PieceStatusCode.SOURCE_HAS_ISSUES,
				message: strings.countDetectedInClip,
				extraArgs: {
					frames,
					seconds: Math.round(dur),
				},
			})
		}
	}

	return messages
}

interface FrameWarningStrings {
	clipStartsWithCount: PackageStatusMessage
	clipEndsWithAfter: PackageStatusMessage
	countDetectedWithinClip: PackageStatusMessage
	countDetectedInClip: PackageStatusMessage
}

const BlackFrameWarnings: FrameWarningStrings = {
	clipStartsWithCount: PackageStatusMessage.CLIP_STARTS_WITH_BLACK_FRAMES,
	clipEndsWithAfter: PackageStatusMessage.CLIP_ENDS_WITH_BLACK_FRAMES,
	countDetectedWithinClip: PackageStatusMessage.CLIP_HAS_SINGLE_BLACK_FRAMES_REGION,
	countDetectedInClip: PackageStatusMessage.CLIP_HAS_MULTIPLE_BLACK_FRAMES_REGIONS,
}

const FreezeFrameWarnings: FrameWarningStrings = {
	clipStartsWithCount: PackageStatusMessage.CLIP_STARTS_WITH_FREEZE_FRAMES,
	clipEndsWithAfter: PackageStatusMessage.CLIP_ENDS_WITH_FREEZE_FRAMES,
	countDetectedWithinClip: PackageStatusMessage.CLIP_HAS_SINGLE_FREEZE_FRAMES_REGION,
	countDetectedInClip: PackageStatusMessage.CLIP_HAS_MULTIPLE_FREEZE_FRAMES_REGIONS,
}

function routeExpectedPackage(
	routes: ResultingMappingRoutes,
	studioMappings: ReadonlyDeep<MappingsExt>,
	expectedPackage: ExpectedPackage.Base
): Set<PeripheralDeviceId> {
	// Collect the relevant mappings
	const mappingsWithPackages: MappingsExt = {}
	for (const layerName of expectedPackage.layers) {
		const mapping = studioMappings[layerName]

		if (mapping) {
			if (!mappingsWithPackages[layerName]) {
				mappingsWithPackages[layerName] = mapping
			}
		}
	}

	// Route the mappings
	const routedMappings = getRoutedMappings(mappingsWithPackages, routes)

	// Find the referenced deviceIds
	return new Set(Object.values<MappingExt>(routedMappings).map((mapping) => mapping.deviceId))
}
