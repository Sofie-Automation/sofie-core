import { BlueprintId, TimelineHash } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { JobContext, JobStudio } from '../../jobs'
import { ReadonlyDeep } from 'type-fest'
import {
	BlueprintResultBaseline,
	BlueprintResultTimeline,
	OnGenerateTimelineObj,
	Time,
	TSR,
} from '@sofie-automation/blueprints-integration'
import {
	deserializeTimelineBlob,
	OnGenerateTimelineObjExt,
	TimelineCompleteGenerationVersions,
	TimelineEnableExt,
	TimelineObjGeneric,
	TimelineObjRundown,
	TimelineObjType,
} from '@sofie-automation/corelib/dist/dataModel/Timeline'
import { RundownBaselineObj } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineObj'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { applyToArray, clone, literal, normalizeArray, omit } from '@sofie-automation/corelib/dist/lib'
import { PlayoutModel } from '../model/PlayoutModel'
import { logger } from '../../logging'
import { getCurrentTime, getSystemVersion } from '../../lib'
import { getResolvedPiecesForPartInstancesOnTimeline } from '../resolvedPieces'
import {
	processAndPrunePieceInstanceTimings,
	PieceInstanceWithTimings,
} from '@sofie-automation/corelib/dist/playout/processAndPrune'
import { StudioPlayoutModel, StudioPlayoutModelBase } from '../../studio/model/StudioPlayoutModel'
import { getLookeaheadObjects } from '../lookahead'
import { StudioBaselineContext, OnTimelineGenerateContext } from '../../blueprints/context'
import { ExpectedPackageDBType } from '@sofie-automation/corelib/dist/dataModel/ExpectedPackages'
import { WatchedPackagesHelper } from '../../blueprints/context/watchedPackages'
import { postProcessStudioBaselineObjects } from '../../blueprints/postProcess'
import { updateBaselineExpectedPackagesOnStudio } from '../../ingest/expectedPackages'
import { endTrace, sendTrace, startTrace } from '@sofie-automation/corelib/dist/influxdb'
import { deserializePieceTimelineObjectsBlob } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { convertResolvedPieceInstanceToBlueprints } from '../../blueprints/context/lib'
import { buildTimelineObjsForRundown, RundownTimelineTimingContext } from './rundown'
import { SourceLayers } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { calculateNowOffsetLatency, deNowifyMultiGatewayTimeline } from './multi-gateway'
import { validateTimeline } from 'superfly-timeline'
import { getPartTimingsOrDefaults, PartCalculatedTimings } from '@sofie-automation/corelib/dist/playout/timings'
import { applyAbPlaybackForTimeline } from '../abPlayback'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'
import { PlayoutPartInstanceModel } from '../model/PlayoutPartInstanceModel'

function isModelForStudio(model: StudioPlayoutModelBase): model is StudioPlayoutModel {
	const tmp = model as StudioPlayoutModel
	return !!tmp.isStudio
}

function generateTimelineVersions(
	studio: ReadonlyDeep<JobStudio>,
	blueprintId: BlueprintId | undefined,
	blueprintVersion: string
): TimelineCompleteGenerationVersions {
	return {
		core: getSystemVersion(),
		blueprintId: blueprintId,
		blueprintVersion: blueprintVersion,
		studio: studio._rundownVersionHash,
	}
}

export async function updateStudioTimeline(
	context: JobContext,
	playoutModel: StudioPlayoutModel | PlayoutModel
): Promise<void> {
	const span = context.startSpan('updateStudioTimeline')
	logger.debug('updateStudioTimeline running...')
	const studio = context.studio
	// Ensure there isn't a playlist active, as that should be using a different function call
	if (isModelForStudio(playoutModel)) {
		const activePlaylists = playoutModel.getActiveRundownPlaylists()
		if (activePlaylists.length > 0) {
			throw new Error(`Studio has an active playlist`)
		}
	} else {
		if (playoutModel.playlist.activationId) {
			throw new Error(`Studio has an active playlist`)
		}
	}

	let baselineObjects: TimelineObjRundown[] = []
	let studioBaseline: BlueprintResultBaseline | undefined

	const studioBlueprint = context.studioBlueprint
	if (studioBlueprint) {
		const watchedPackages = await WatchedPackagesHelper.create(context, {
			fromPieceType: ExpectedPackageDBType.STUDIO_BASELINE_OBJECTS,
		})

		const blueprint = studioBlueprint.blueprint
		try {
			studioBaseline = blueprint.getBaseline(
				new StudioBaselineContext(
					{ name: 'studioBaseline', identifier: `studioId=${studio._id}` },
					context,
					watchedPackages
				)
			)
		} catch (err) {
			logger.error(`Error in studioBlueprint.getBaseline: ${stringifyError(err)}`)
			studioBaseline = {
				timelineObjects: [],
			}
		}
		baselineObjects = postProcessStudioBaselineObjects(studio.blueprintId, studioBaseline.timelineObjects)
	}

	const versions = generateTimelineVersions(
		studio,
		studio.blueprintId,
		studioBlueprint?.blueprint?.blueprintVersion ?? '-'
	)

	flattenAndProcessTimelineObjects(context, baselineObjects)

	// Future: We should handle any 'now' objects that are at the root of this timeline
	preserveOrReplaceNowTimesInObjects(playoutModel, baselineObjects)

	if (playoutModel.isMultiGatewayMode) {
		logAnyRemainingNowTimes(context, baselineObjects)
	}

	const timelineHash = saveTimeline(context, playoutModel, baselineObjects, versions)

	if (studioBaseline) {
		updateBaselineExpectedPackagesOnStudio(context, playoutModel, studioBaseline)
	}

	logger.verbose(`updateStudioTimeline done, hash: "${timelineHash}"`)
	if (span) span.end()
}

export async function updateTimeline(context: JobContext, playoutModel: PlayoutModel): Promise<void> {
	const span = context.startSpan('updateTimeline')
	logger.debug('updateTimeline running...')

	if (!playoutModel.playlist.activationId) {
		throw new Error(`RundownPlaylist ("${playoutModel.playlist._id}") is not active")`)
	}

	const nowOffsetLatency = calculateNowOffsetLatency(context, playoutModel)
	const targetNowTime = getCurrentTime() + (nowOffsetLatency ?? 0)

	const {
		versions,
		objs: timelineObjs,
		timingContext: timingInfo,
	} = await getTimelineRundown(context, playoutModel, targetNowTime)

	flattenAndProcessTimelineObjects(context, timelineObjs)

	preserveOrReplaceNowTimesInObjects(playoutModel, timelineObjs)

	if (playoutModel.isMultiGatewayMode) {
		deNowifyMultiGatewayTimeline(playoutModel, timelineObjs, timingInfo, targetNowTime)

		logAnyRemainingNowTimes(context, timelineObjs)
	}

	const timelineHash = saveTimeline(context, playoutModel, timelineObjs, versions)
	logger.verbose(`updateTimeline done, hash: "${timelineHash}"`)

	if (span) span.end()
}

function preserveOrReplaceNowTimesInObjects(
	studioPlayoutModel: StudioPlayoutModelBase,
	timelineObjs: Array<TimelineObjGeneric>
) {
	const timeline = studioPlayoutModel.timeline
	const oldTimelineObjsMap = normalizeArray(
		(timeline?.timelineBlob !== undefined && deserializeTimelineBlob(timeline.timelineBlob)) || [],
		'id'
	)

	timelineObjs.forEach((tlo: TimelineObjGeneric) => {
		// A timeline object is updated if found in both collections

		const tloldo: TimelineObjGeneric | undefined = oldTimelineObjsMap[tlo.id]

		let oldNow: TSR.Timeline.TimelineEnable['start'] | undefined
		if (tloldo && tloldo.enable) {
			applyToArray(tloldo.enable, (enable) => {
				if (enable.setFromNow) oldNow = enable.start
			})
		}

		if (oldNow !== undefined) {
			applyToArray(tlo.enable, (enable) => {
				if (enable.start === 'now') {
					enable.start = oldNow
					enable.setFromNow = true
				}
			})
		}
	})
}

function logAnyRemainingNowTimes(_context: JobContext, timelineObjs: Array<TimelineObjGeneric>): void {
	const badTimelineObjs: any[] = []

	for (const obj of timelineObjs) {
		if (hasNow(obj.enable)) {
			badTimelineObjs.push(obj)
		}

		for (const kf of obj.keyframes || []) {
			if (hasNow(kf.enable)) {
				badTimelineObjs.push(kf)
			}
		}
	}

	if (badTimelineObjs.length) {
		logger.error(`Some timeline objects have unexpected now times!: ${JSON.stringify(badTimelineObjs)}`)
	}
}
function hasNow(obj: TimelineEnableExt | TimelineEnableExt[]) {
	let res = false
	applyToArray(obj, (enable) => {
		if (enable.start === 'now' || enable.end === 'now') res = true
	})
	return res
}

/** Store the timelineobjects into the model, and perform any post-save actions */
export function saveTimeline(
	context: JobContext,
	studioPlayoutModel: StudioPlayoutModelBase,
	timelineObjs: TimelineObjGeneric[],
	generationVersions: TimelineCompleteGenerationVersions
): TimelineHash {
	const newTimeline = studioPlayoutModel.setTimeline(timelineObjs, generationVersions)

	// Also do a fast-track for the timeline to be published faster:
	context.hackPublishTimelineToFastTrack(newTimeline)

	return newTimeline.timelineHash
}

export interface SelectedPartInstancesTimelineInfo {
	previous?: SelectedPartInstanceTimelineInfo
	current?: SelectedPartInstanceTimelineInfo
	next?: SelectedPartInstanceTimelineInfo
}
export interface SelectedPartInstanceTimelineInfo {
	nowInPart: number
	partStarted: number | undefined
	partInstance: ReadonlyDeep<DBPartInstance>
	pieceInstances: PieceInstanceWithTimings[]
	calculatedTimings: PartCalculatedTimings
}

function getPartInstanceTimelineInfo(
	currentTime: Time,
	sourceLayers: SourceLayers,
	partInstance: PlayoutPartInstanceModel | null
): SelectedPartInstanceTimelineInfo | undefined {
	if (!partInstance) return undefined

	const partStarted = partInstance.partInstance.timings?.plannedStartedPlayback
	const nowInPart = partStarted === undefined ? 0 : currentTime - partStarted
	const pieceInstances = processAndPrunePieceInstanceTimings(
		sourceLayers,
		partInstance.pieceInstances.map((p) => p.pieceInstance),
		nowInPart
	)

	const partInstanceWithOverrides = partInstance.getPartInstanceWithQuickLoopOverrides()
	return {
		partInstance: partInstanceWithOverrides,
		pieceInstances,
		nowInPart,
		partStarted,
		// Approximate `calculatedTimings`, for the partInstances which already have it cached
		calculatedTimings: getPartTimingsOrDefaults(partInstanceWithOverrides, pieceInstances),
	}
}

/**
 * Returns timeline objects related to rundowns in a studio
 */
async function getTimelineRundown(
	context: JobContext,
	playoutModel: PlayoutModel,
	targetNowTime: number
): Promise<{
	objs: Array<TimelineObjRundown>
	versions: TimelineCompleteGenerationVersions
	timingContext: RundownTimelineTimingContext | undefined
}> {
	const span = context.startSpan('getTimelineRundown')
	try {
		let timelineObjs: Array<TimelineObjGeneric & OnGenerateTimelineObjExt> = []

		const currentPartInstance = playoutModel.currentPartInstance
		const nextPartInstance = playoutModel.nextPartInstance
		const previousPartInstance = playoutModel.previousPartInstance

		const partForRundown = currentPartInstance || nextPartInstance
		const activeRundown = partForRundown && playoutModel.getRundown(partForRundown.partInstance.rundownId)

		let timelineVersions: TimelineCompleteGenerationVersions | undefined
		if (activeRundown) {
			// Fetch showstyle blueprint:
			const showStyle = await context.getShowStyleCompound(
				activeRundown.rundown.showStyleVariantId,
				activeRundown.rundown.showStyleBaseId
			)
			if (!showStyle) {
				throw new Error(
					`ShowStyleBase "${activeRundown.rundown.showStyleBaseId}" not found! (referenced by Rundown "${activeRundown.rundown._id}")`
				)
			}

			const partInstancesInfo: SelectedPartInstancesTimelineInfo = {
				current: getPartInstanceTimelineInfo(targetNowTime, showStyle.sourceLayers, currentPartInstance),
				next: getPartInstanceTimelineInfo(targetNowTime, showStyle.sourceLayers, nextPartInstance),
				previous: getPartInstanceTimelineInfo(targetNowTime, showStyle.sourceLayers, previousPartInstance),
			}

			if (partInstancesInfo.next && nextPartInstance) {
				// the nextPartInstance doesn't have accurate cached `calculatedTimings` yet, so calculate a prediction
				partInstancesInfo.next.calculatedTimings = playoutModel.calculatePartTimings(
					currentPartInstance,
					nextPartInstance,
					partInstancesInfo.next.pieceInstances // already processed and pruned
				)
			}

			// next (on pvw (or on pgm if first))
			const pLookaheadObjs = getLookeaheadObjects(context, playoutModel, partInstancesInfo)
			const rawBaselineItems = activeRundown.baselineObjects
			if (rawBaselineItems.length > 0) {
				timelineObjs = timelineObjs.concat(transformBaselineItemsIntoTimeline(rawBaselineItems))
			} else {
				logger.warn(`Missing Baseline objects for Rundown "${activeRundown.rundown._id}"`)
			}

			const rundownTimelineResult = buildTimelineObjsForRundown(context, playoutModel.playlist, partInstancesInfo)

			timelineObjs = timelineObjs.concat(rundownTimelineResult.timeline)
			timelineObjs = timelineObjs.concat(await pLookaheadObjs)

			const blueprint = await context.getShowStyleBlueprint(showStyle._id)
			timelineVersions = generateTimelineVersions(
				context.studio,
				showStyle.blueprintId,
				blueprint.blueprint.blueprintVersion
			)

			if (blueprint.blueprint.onTimelineGenerate || blueprint.blueprint.getAbResolverConfiguration) {
				const resolvedPieces = getResolvedPiecesForPartInstancesOnTimeline(
					context,
					partInstancesInfo,
					targetNowTime
				)
				const blueprintContext = new OnTimelineGenerateContext(
					context.studio,
					context.getStudioBlueprintConfig(),
					showStyle,
					context.getShowStyleBlueprintConfig(showStyle),
					playoutModel.playlist,
					activeRundown.rundown,
					previousPartInstance?.partInstance,
					currentPartInstance?.partInstance,
					nextPartInstance?.partInstance,
					resolvedPieces
				)
				try {
					const abHelper = blueprintContext.abSessionsHelper // Future: this should be removed from OnTimelineGenerateContext once the methods are removed from the api
					const newAbSessionsResult = applyAbPlaybackForTimeline(
						context,
						abHelper,
						blueprint,
						showStyle,
						playoutModel.playlist,
						resolvedPieces,
						timelineObjs
					)

					// Store the new notes in the model
					const notificationCategory = 'abPlayback'
					playoutModel.clearAllNotifications(notificationCategory)
					for (const notification of newAbSessionsResult.notifications) {
						playoutModel.setNotification(notificationCategory, {
							...notification,
							relatedTo: { type: 'playlist' },
						})
					}

					let tlGenRes: BlueprintResultTimeline | undefined
					if (blueprint.blueprint.onTimelineGenerate) {
						const span = context.startSpan('blueprint.onTimelineGenerate')
						const influxTrace = startTrace('blueprints:onTimelineGenerate')
						tlGenRes = await blueprint.blueprint.onTimelineGenerate(
							blueprintContext,
							timelineObjs,
							clone(playoutModel.playlist.previousPersistentState),
							clone(currentPartInstance?.partInstance?.previousPartEndState),
							resolvedPieces.map(convertResolvedPieceInstanceToBlueprints)
						)
						sendTrace(endTrace(influxTrace))
						if (span) span.end()

						timelineObjs = tlGenRes.timeline.map((object: OnGenerateTimelineObj<any>) => {
							return literal<TimelineObjGeneric & OnGenerateTimelineObjExt>({
								...(object as OnGenerateTimelineObjExt),
								objectType: TimelineObjType.RUNDOWN,
							})
						})
					}

					playoutModel.setOnTimelineGenerateResult(
						tlGenRes?.persistentState,
						newAbSessionsResult.assignments,
						blueprintContext.abSessionsHelper.knownSessions
					)
				} catch (err) {
					// TODO - this may not be sufficient?
					logger.error(`Error in showStyleBlueprint.onTimelineGenerate: ${stringifyError(err)}`)
				}
			}

			if (span) span.end()
			return {
				objs: timelineObjs.map<TimelineObjRundown>((timelineObj) => {
					return {
						...omit(
							timelineObj,
							// temporary fields from OnGenerateTimelineObj
							'pieceInstanceId',
							'infinitePieceInstanceId',
							'partInstanceId',
							'originalId'
						),
						objectType: TimelineObjType.RUNDOWN,
					}
				}),
				versions: timelineVersions ?? generateTimelineVersions(context.studio, undefined, '-'),
				timingContext: rundownTimelineResult.timingContext,
			}
		} else {
			if (span) span.end()
			logger.error('No active rundown during updateTimeline')
			return {
				objs: [],
				versions: generateTimelineVersions(context.studio, undefined, '-'),
				timingContext: undefined,
			}
		}
	} catch (e) {
		if (span) span.end()
		logger.error(`Error in getTimelineRundown: ${stringifyError(e)}`)
		return {
			objs: [],
			versions: generateTimelineVersions(context.studio, undefined, '-'),
			timingContext: undefined,
		}
	}
}

/**
 * Process the timeline objects, to provide some basic validation. Also flattens the nested objects into a single array
 * Note: Input array is mutated in place
 * @param context
 * @param timelineObjs Array of timeline objects
 */
function flattenAndProcessTimelineObjects(context: JobContext, timelineObjs: Array<TimelineObjGeneric>): void {
	const span = context.startSpan('processTimelineObjects')

	// first, split out any grouped objects, to make the timeline shallow:
	const fixObjectChildren = (o: TimelineObjGeneric): void => {
		// Unravel children objects and put them on the (flat) timelineObjs array
		if (o.isGroup && o.children && o.children.length) {
			for (const child of o.children) {
				const childFixed: TimelineObjGeneric = {
					...(child as TimelineObjGeneric),
					objectType: o.objectType,
					inGroup: o.id,
					priority: o.priority ?? 0,
				}
				if (!childFixed.id) logger.error(`TimelineObj missing id attribute (child of ${o.id})`, childFixed)
				timelineObjs.push(childFixed)

				fixObjectChildren(childFixed)
			}
			o.children = []
		}
	}

	for (const obj of timelineObjs) {
		fixObjectChildren(obj)
	}

	try {
		// Do a validation of the timeline, to ensure that it doesn't contain any nastiness that can crash the Timeline-resolving later.
		validateTimeline(timelineObjs, true)
	} catch (err) {
		throw new Error(`Error in generated timeline: Validation failed: ${err}`)
	}

	if (span) span.end()
}

/**
 * Convert RundownBaselineObj into TimelineObjects for the timeline
 */
function transformBaselineItemsIntoTimeline(
	objs: ReadonlyDeep<RundownBaselineObj[]>
): Array<TimelineObjRundown & OnGenerateTimelineObjExt> {
	const timelineObjs: Array<TimelineObjRundown & OnGenerateTimelineObjExt> = []
	for (const obj of objs) {
		const objects = deserializePieceTimelineObjectsBlob(obj.timelineObjectsString)
		// the baseline objects are layed out without any grouping
		for (const o of objects) {
			timelineObjs.push({
				metaData: undefined,
				...o,
				objectType: TimelineObjType.RUNDOWN,
				partInstanceId: null,
			})
		}
	}
	return timelineObjs
}
