/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
	PeripheralDeviceCategory,
	PeripheralDeviceType,
	PERIPHERAL_SUBTYPE_PROCESS,
} from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'
import {
	setupDefaultRundownPlaylist,
	setupMockPeripheralDevice,
	setupMockShowStyleCompound,
} from '../../__mocks__/presetCollections.js'
import { MockJobContext, setupDefaultJobEnvironment } from '../../__mocks__/context.js'
import { DBRundown, Rundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { handleTakeNextPart } from '../take.js'
import { handleActivateHold } from '../holdJobs.js'
import { handleActivateRundownPlaylist, handleDeactivateRundownPlaylist } from '../activePlaylistJobs.js'
import { fixSnapshot } from '../../__mocks__/helpers/snapshot.js'
import { runJobWithPlayoutModel } from '../lock.js'
import { updateTimeline } from '../timeline/generate.js'
import { getSelectedPartInstances, getSortedPartsForRundown } from './lib.js'
import { PieceLifespan, IBlueprintPieceType, Time } from '@sofie-automation/blueprints-integration'
import { AdLibPiece } from '@sofie-automation/corelib/dist/dataModel/AdLibPiece'
import { RundownPlaylistId, RundownId, PartId, PartInstanceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import {
	TimelineEnableExt,
	TimelineComplete,
	deserializeTimelineBlob,
} from '@sofie-automation/corelib/dist/dataModel/Timeline'
import { normalizeArrayToMap, literal, getRandomId } from '@sofie-automation/corelib/dist/lib'
import { getPartGroupId, getPieceControlObjectId, getPieceGroupId } from '@sofie-automation/corelib/dist/playout/ids'
import { unprotectString, protectString } from '@sofie-automation/corelib/dist/protectedString'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import {
	setupRundownWithInTransitionExistingInfinite,
	setupRundownWithInTransition,
	setupRundownWithInTransitionContentDelay,
	setupRundownWithInTransitionContentDelayAndPreroll,
	setupRundownWithPreroll,
	setupRundownWithInTransitionNewInfinite,
	setupRundownWithInTransitionPlannedPiece,
	setupRundownWithInTransitionEnableHold,
	setupRundownWithInTransitionDisabled,
	setupRundownWithOutTransition,
	setupRundownWithOutTransitionAndPreroll,
	setupRundownWithOutTransitionAndPreroll2,
	setupRundownWithOutTransitionAndInTransition,
	setupRundownWithOutTransitionEnableHold,
	setupRundownBase,
} from './helpers/rundowns.js'
import { defaultRundownPlaylist } from '../../__mocks__/defaultCollectionObjects.js'
import { ReadonlyDeep } from 'type-fest'
import { innerStartOrQueueAdLibPiece } from '../adlibUtils.js'
import { EmptyPieceTimelineObjectsBlob } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { adjustFakeTime, useFakeCurrentTime, useRealCurrentTime } from '../../__mocks__/time.js'
import { restartRandomId } from '../../__mocks__/nanoid.js'
import { ProcessedShowStyleCompound } from '../../jobs/index.js'
import { handleOnPlayoutPlaybackChanged, handleTimelineTriggerTime } from '../timings/index.js'
import {
	PlayoutChangedResult,
	PlayoutChangedType,
} from '@sofie-automation/shared-lib/dist/peripheralDevice/peripheralDeviceAPI'
import _ from 'underscore'
import { PlayoutRundownModel } from '../model/PlayoutRundownModel.js'
import { PlayoutPartInstanceModel } from '../model/PlayoutPartInstanceModel.js'
import { PlayoutPartInstanceModelImpl } from '../model/implementation/PlayoutPartInstanceModelImpl.js'
import { mock } from 'jest-mock-extended'
import { QuickLoopService } from '../model/services/QuickLoopService.js'
import { getCurrentTime } from '../../lib/time.js'

/**
 * An object used to represent the simplified timeline structure.
 * This allows for a simple declarative form of the timeline containing only the bits that are relevant to the layout of the parts and pieces
 */
interface PartTimelineTimings {
	/** Expected enable for the previous part group, if it is on the timeline */
	previousPart: TimelineEnableExt | null
	currentPieces: {
		/**
		 * The pieces for the current part.
		 * Every piece in the part must be represented here or in currentInfinitePieces.
		 * Use null for pieces that have no presence in the timeline
		 */
		[id: string]: {
			/** Expected offsets of the child group relative to the control object */
			childGroup: PreAndPostRoll | PreAndPostRoll[]
			/** Expected enable for the control object */
			controlObj: TimelineEnableExt | TimelineEnableExt[]
		} | null
	}
	currentInfinitePieces: {
		/**
		 * The pieces for the current part.
		 * Every piece in the part must be represented here or in currentPieces.
		 * Use null for pieces that have no presence in the timeline
		 */
		[id: string]: {
			/** Expected enable for the virtual part group wrapping this infinite */
			partGroup: TimelineEnableExt | TimelineEnableExt[]
			pieceGroup: {
				/** Expected offsets of the child group relative to the control object */
				childGroup: PreAndPostRoll | PreAndPostRoll[]
				/** Expected enable for the control object */
				controlObj: TimelineEnableExt | TimelineEnableExt[]
			}
		} | null
	}
	/**
	 * If there is a previous outTransition, then the piece generated must be represented here
	 */
	previousOutTransition:
		| {
				/** Expected offsets of the child group relative to the control object */
				childGroup: PreAndPostRoll | PreAndPostRoll[]
				/** Expected enable for the control object */
				controlObj: TimelineEnableExt | TimelineEnableExt[]
		  }
		| null
		| undefined
}

interface PreAndPostRoll {
	preroll: number
	postroll: number
	invalid?: string
}
/**
 * Parse a TimelineEnable for a piece group timeline object into a simplifeid form of just the numbers ignoring the id of the control object it is relative to
 */
function parsePieceGroupPrerollAndPostroll(
	enable: TimelineEnableExt | TimelineEnableExt[]
): PreAndPostRoll | PreAndPostRoll[] {
	const doIt = (enable: TimelineEnableExt): PreAndPostRoll => {
		const res: PreAndPostRoll = {
			preroll: 0,
			postroll: 0,
		}

		if (typeof enable.start === 'string') {
			const start = enable.start

			const match = start.match(/^#piece_group_control_(.*)\.start - (\d+)$/)
			if (match) {
				res.preroll = Number(match[2])
			} else {
				res.invalid = 'Failed to parse start'
			}
		} else {
			res.invalid = 'Failed to parse start'
		}
		if (typeof enable.end === 'string') {
			const end = enable.end

			const match = end.match(/^#piece_group_control_(.*)\.end \+ (\d+)$/)
			if (match) {
				res.postroll = Number(match[2])
			} else {
				res.invalid = 'Failed to parse end'
			}
		} else {
			res.invalid = 'Failed to parse end'
		}

		if (Object.keys(enable).length !== 2) {
			res.invalid = 'Extra keys!'
		}

		return res
	}

	if (Array.isArray(enable)) {
		return enable.map(doIt)
	} else {
		return doIt(enable)
	}
}

/**
 * Check the timings of objects in the timeline to an expected result
 * Note: this ensures that every piece for the currentPartInstance is accounted for in the expected result
 */
function checkTimingsRaw(
	rundownId: RundownId,
	timeline: TimelineComplete | undefined,
	currentPartInstance: PlayoutPartInstanceModel,
	previousPartInstance: PlayoutPartInstanceModel | undefined,
	expectedTimings: PartTimelineTimings
) {
	const timelineObjs = timeline ? deserializeTimelineBlob(timeline?.timelineBlob) : []
	const objs = normalizeArrayToMap(timelineObjs, 'id')

	// previous part group
	const prevPartTlObj = previousPartInstance ? objs.get(getPartGroupId(previousPartInstance.partInstance)) : undefined
	if (expectedTimings.previousPart) {
		expect(prevPartTlObj).toBeTruthy()
		expect(prevPartTlObj?.enable).toMatchObject(expectedTimings.previousPart)
	} else {
		expect(prevPartTlObj).toBeFalsy()
	}

	// current part group is assumed to start at now

	// Current pieces
	const currentPieces = currentPartInstance.pieceInstances
	const targetCurrentPieces: PartTimelineTimings['currentPieces'] = {}
	const targetCurrentInfinitePieces: PartTimelineTimings['currentInfinitePieces'] = {}
	for (const piece of currentPieces) {
		let entryId = unprotectString(piece.pieceInstance.piece._id)
		if (entryId.startsWith(unprotectString(rundownId)))
			entryId = entryId.substring(unprotectString(rundownId).length + 1)

		if (piece.pieceInstance.piece.lifespan === PieceLifespan.WithinPart) {
			const pieceObj = objs.get(getPieceGroupId(piece.pieceInstance))
			const controlObj = objs.get(getPieceControlObjectId(piece.pieceInstance))

			targetCurrentPieces[entryId] = controlObj
				? {
						childGroup: parsePieceGroupPrerollAndPostroll(pieceObj?.enable ?? []),
						controlObj: controlObj.enable,
					}
				: null
		} else {
			const partGroupId =
				getPartGroupId(protectString<PartInstanceId>(unprotectString(piece.pieceInstance._id))) + '_infinite'
			const partObj = objs.get(partGroupId)
			if (!partObj) {
				targetCurrentInfinitePieces[entryId] = null
			} else {
				const pieceObj = objs.get(getPieceGroupId(piece.pieceInstance))
				const controlObj = objs.get(getPieceControlObjectId(piece.pieceInstance))

				targetCurrentInfinitePieces[entryId] = {
					partGroup: partObj.enable,
					pieceGroup: {
						childGroup: parsePieceGroupPrerollAndPostroll(pieceObj?.enable ?? []),
						controlObj: controlObj?.enable ?? [],
					},
				}
			}
		}
	}
	expect(targetCurrentPieces).toEqual(expectedTimings.currentPieces)
	expect(targetCurrentInfinitePieces).toEqual(expectedTimings.currentInfinitePieces)

	if (previousPartInstance) {
		// Previous pieces
		const previousPieces = previousPartInstance.pieceInstances
		let previousOutTransition: PartTimelineTimings['previousOutTransition']
		for (const piece of previousPieces) {
			if (piece.pieceInstance.piece.pieceType === IBlueprintPieceType.OutTransition) {
				if (previousOutTransition !== undefined) throw new Error('Too many out transition pieces were found')

				const pieceObj = objs.get(getPieceGroupId(piece.pieceInstance))
				const controlObj = objs.get(getPieceControlObjectId(piece.pieceInstance))
				previousOutTransition = controlObj
					? {
							childGroup: parsePieceGroupPrerollAndPostroll(pieceObj?.enable ?? []),
							controlObj: controlObj.enable,
						}
					: null
			}
		}
		expect(previousOutTransition).toEqual(expectedTimings.previousOutTransition)
	} else {
		expect(expectedTimings.previousOutTransition).toBeFalsy()
	}
}

/** Perform a take and check the selected part ids are as expected. Wait for 1500ms before doing a take. */
async function doTakePart(
	context: MockJobContext,
	playlistId: RundownPlaylistId,
	expectedPreviousPartId: PartId | null,
	expectedCurrentPartId: PartId | null,
	expectedNextPartId: PartId | null
) {
	adjustFakeTime(1500)

	{
		const playlist = (await context.directCollections.RundownPlaylists.findOne(playlistId)) as DBRundownPlaylist
		expect(playlist).toBeTruthy()

		await handleTakeNextPart(context, {
			playlistId: playlistId,
			fromPartInstanceId: playlist.currentPartInfo?.partInstanceId ?? null,
		})
	}

	const playlist = (await context.directCollections.RundownPlaylists.findOne(playlistId)) as DBRundownPlaylist
	expect(playlist).toBeTruthy()

	const { currentPartInstance, nextPartInstance, previousPartInstance } = await getSelectedPartInstances(
		context,
		playlist
	)

	if (expectedCurrentPartId) {
		expect(currentPartInstance).toBeTruthy()
		expect(currentPartInstance!.part._id).toEqual(expectedCurrentPartId)
	} else {
		expect(currentPartInstance).toBeFalsy()
	}

	if (expectedPreviousPartId) {
		expect(previousPartInstance).toBeTruthy()
		expect(previousPartInstance!.part._id).toEqual(expectedPreviousPartId)
	} else {
		expect(previousPartInstance).toBeFalsy()
	}

	if (expectedNextPartId) {
		expect(nextPartInstance).toBeTruthy()
		expect(nextPartInstance!.part._id).toEqual(expectedNextPartId)
	} else {
		expect(nextPartInstance).toBeFalsy()
	}

	return { currentPartInstance, nextPartInstance, previousPartInstance }
}

/** Perform the playback timing confirmation from playout-gateway */
async function doOnPlayoutPlaybackChanged(
	context: MockJobContext,
	playlistId: RundownPlaylistId,
	timings: {
		/** Base time for the part and pieces */
		baseTime: number
		/** Id of the part being affected */
		partId: PartInstanceId
		/** Whether to report the part as started */
		includePart: boolean
		/**
		 * Times of pieces having started playback, as offset relative to baseTime.
		 * Note: every piece in the part must be represented here, use null if it should not be reported as playing
		 */
		pieceOffsets: Record<string, number | null>
	}
) {
	const pieceInstances = await context.directCollections.PieceInstances.findFetch({ partInstanceId: timings.partId })
	for (const pieceInstance of pieceInstances) {
		expect(timings.pieceOffsets[unprotectString(pieceInstance._id)]).not.toBeUndefined()
	}

	await handleOnPlayoutPlaybackChanged(context, {
		playlistId,
		changes: _.compact<(PlayoutChangedResult | undefined)[]>([
			timings.includePart
				? {
						type: PlayoutChangedType.PART_PLAYBACK_STARTED,
						data: {
							partInstanceId: timings.partId,
							time: timings.baseTime,
						},
						objId: getPartGroupId(timings.partId),
					}
				: undefined,
			// The piece controlObjects start offset into the part, so need a manual offset
			...Object.entries<number | null>(timings.pieceOffsets).map(
				([pieceInstanceId, offset]): PlayoutChangedResult | undefined =>
					offset !== null
						? {
								type: PlayoutChangedType.PIECE_PLAYBACK_STARTED,
								data: {
									partInstanceId: timings.partId,
									pieceInstanceId: protectString(pieceInstanceId),
									time: timings.baseTime + offset,
								},
								objId: getPieceControlObjectId(protectString(pieceInstanceId)),
							}
						: undefined
			),
		]),
	})
}

/** Perform the playback timing confirmation from playout-gateway using automatic timings */
async function doAutoPlayoutPlaybackChangedForPart(
	context: MockJobContext,
	playlistId: RundownPlaylistId,
	partInstanceId: PartInstanceId,
	takeTime: number
) {
	// Report the first part as having started playback
	const pieceInstances = await context.directCollections.PieceInstances.findFetch({
		partInstanceId: partInstanceId,
	})
	await doOnPlayoutPlaybackChanged(context, playlistId, {
		baseTime: takeTime,
		partId: partInstanceId,
		includePart: true,
		pieceOffsets: Object.fromEntries(pieceInstances.map((piece) => [piece._id, piece.piece.enable.start])),
	})
}

/** Perform an activate and check the next part id is as expected */
async function doActivatePlaylist(context: MockJobContext, playlistId: RundownPlaylistId, nextPartId: PartId) {
	adjustFakeTime(1000)

	await handleActivateRundownPlaylist(context, {
		playlistId: playlistId,
		rehearsal: false,
	})

	const playlist = (await context.directCollections.RundownPlaylists.findOne(playlistId)) as DBRundownPlaylist
	expect(playlist).toBeTruthy()

	const { currentPartInstance, nextPartInstance } = await getSelectedPartInstances(context, playlist)
	expect(currentPartInstance).toBeFalsy()
	expect(nextPartInstance).toBeTruthy()
	expect(nextPartInstance!.part._id).toEqual(nextPartId)
	expect(playlist).toMatchObject({
		activationId: expect.stringMatching(/^randomId/),
		rehearsal: false,
		currentPartInfo: null,
		// nextPartInstanceId: parts[0]._id,
	})
}

/** Perform an activate and check the selected part ids are cleared */
async function doDeactivatePlaylist(context: MockJobContext, playlistId: RundownPlaylistId) {
	adjustFakeTime(1000)

	await handleDeactivateRundownPlaylist(context, {
		playlistId: playlistId,
	})

	const playlist = (await context.directCollections.RundownPlaylists.findOne(playlistId)) as DBRundownPlaylist
	expect(playlist).toBeTruthy()

	// Ensure this is defined to something, for the jest matcher
	playlist.activationId = playlist.activationId ?? undefined

	expect(playlist).toMatchObject({
		activationId: undefined,
		currentPartInfo: null,
		nextPartInfo: null,
	})
}

/** perform an update of the timeline */
async function doUpdateTimeline(context: MockJobContext, playlistId: RundownPlaylistId) {
	await runJobWithPlayoutModel(
		context,
		{
			playlistId: playlistId,
		},
		null,
		async (playoutModel) => {
			await updateTimeline(context, playoutModel)
		}
	)
}

interface SelectedPartInstances {
	currentPartInstance: PlayoutPartInstanceModel | undefined
	nextPartInstance: PlayoutPartInstanceModel | undefined
	previousPartInstance: PlayoutPartInstanceModel | undefined
}

describe('Timeline', () => {
	describe('Single-gateway mode', () => {
		let context: MockJobContext
		let showStyle: ReadonlyDeep<ProcessedShowStyleCompound>
		beforeEach(async () => {
			restartRandomId()

			context = setupDefaultJobEnvironment()

			useFakeCurrentTime()

			showStyle = await setupMockShowStyleCompound(context)

			// Ignore calls to queueEventJob, they are expected
			context.queueEventJob = async () => Promise.resolve()
		})
		afterEach(() => {
			useRealCurrentTime()
		})
		test('Basic rundown', async () => {
			await setupMockPeripheralDevice(
				context,
				PeripheralDeviceCategory.PLAYOUT,
				PeripheralDeviceType.PLAYOUT,
				PERIPHERAL_SUBTYPE_PROCESS
			)

			const { rundownId: rundownId0, playlistId: playlistId0 } = await setupDefaultRundownPlaylist(context)
			expect(rundownId0).toBeTruthy()
			expect(playlistId0).toBeTruthy()

			const getRundown0 = async () => {
				return (await context.directCollections.Rundowns.findOne(rundownId0)) as DBRundown
			}
			const getPlaylist0 = async () => {
				const playlist = (await context.directCollections.RundownPlaylists.findOne(
					playlistId0
				)) as DBRundownPlaylist
				playlist.activationId = playlist.activationId ?? undefined
				return playlist
			}

			await expect(getRundown0()).resolves.toBeTruthy()
			await expect(getPlaylist0()).resolves.toBeTruthy()

			const parts = await context.directCollections.Parts.findFetch({ rundownId: rundownId0 })

			await expect(getPlaylist0()).resolves.toMatchObject({
				activationId: undefined,
				rehearsal: false,
			})

			{
				// Prepare and activate in rehersal:
				await handleActivateRundownPlaylist(context, { playlistId: playlistId0, rehearsal: false })
				const { currentPartInstance, nextPartInstance } = await getSelectedPartInstances(
					context,
					await getPlaylist0()
				)
				expect(currentPartInstance).toBeFalsy()
				expect(nextPartInstance).toBeTruthy()
				expect(nextPartInstance!.part._id).toEqual(parts[0]._id)
				await expect(getPlaylist0()).resolves.toMatchObject({
					activationId: expect.stringMatching(/^randomId/),
					rehearsal: false,
					currentPartInfo: null,
					// nextPartInstanceId: parts[0]._id,
				})
			}

			{
				// Take the first Part:
				await handleTakeNextPart(context, { playlistId: playlistId0, fromPartInstanceId: null })
				const { currentPartInstance, nextPartInstance } = await getSelectedPartInstances(
					context,
					await getPlaylist0()
				)
				expect(currentPartInstance).toBeTruthy()
				expect(nextPartInstance).toBeTruthy()
				expect(currentPartInstance!.part._id).toEqual(parts[0]._id)
				expect(nextPartInstance!.part._id).toEqual(parts[1]._id)
				// expect(getPlaylist0()).toMatchObject({
				// 	currentPartInstanceId: parts[0]._id,
				// 	nextPartInstanceId: parts[1]._id,
				// })
			}

			await runJobWithPlayoutModel(context, { playlistId: playlistId0 }, null, async (playoutModel) => {
				await updateTimeline(context, playoutModel)
			})

			expect(fixSnapshot(await context.directCollections.Timelines.findFetch())).toMatchSnapshot()

			{
				// Deactivate rundown:
				await handleDeactivateRundownPlaylist(context, { playlistId: playlistId0 })
				await expect(getPlaylist0()).resolves.toMatchObject({
					activationId: undefined,
					currentPartInfo: null,
					nextPartInfo: null,
				})
			}

			expect(fixSnapshot(await context.directCollections.Timelines.findFetch())).toMatchSnapshot()
		})

		/**
		 * Perform a test to check how a transition is formed on the timeline.
		 * This simulates two takes then allows for analysis of the state.
		 * @param name Name of the test
		 * @param customRundownFactory Factory to produce the rundown to play
		 * @param checkFcn Function used to check the resulting timeline
		 * @param timeout Override the timeout of the test
		 */
		function testTransitionTimings(
			name: string,
			customRundownFactory: (
				context: MockJobContext,
				playlistId: RundownPlaylistId,
				rundownId: RundownId,
				showStyle: ReadonlyDeep<ProcessedShowStyleCompound>
			) => Promise<RundownId>,
			checkFcn: (
				rundownId: RundownId,
				timeline: null,
				currentPartInstance: DBPartInstance,
				previousPartInstance: DBPartInstance,
				checkTimings: (timings: PartTimelineTimings) => Promise<void>,
				previousTakeTime: number
			) => Promise<void>,
			timeout?: number
		) {
			// eslint-disable-next-line jest/expect-expect
			test(
				// eslint-disable-next-line jest/valid-title
				name,
				async () =>
					runTimelineTimings(
						customRundownFactory,
						async (playlistId, rundownId, parts, _getPartInstances, checkTimings) => {
							// Take the first Part:
							const { currentPartInstance: currentPartInstance0 } = await doTakePart(
								context,
								playlistId,
								null,
								parts[0]._id,
								parts[1]._id
							)

							// Report the first part as having started playback
							const previousTakeTime = 10000
							await doAutoPlayoutPlaybackChangedForPart(
								context,
								playlistId,
								currentPartInstance0!._id,
								previousTakeTime
							)

							// Take the second Part:
							const { currentPartInstance, previousPartInstance } = await doTakePart(
								context,
								playlistId,
								parts[0]._id,
								parts[1]._id,
								null
							)

							// Report the second part as having started playback
							await doAutoPlayoutPlaybackChangedForPart(
								context,
								playlistId,
								currentPartInstance!._id,
								previousTakeTime + 10000
							)

							// Run the result check
							await checkFcn(
								rundownId,
								null,
								currentPartInstance!,
								previousPartInstance!,
								checkTimings,
								previousTakeTime
							)
						}
					),
				timeout
			)
		}

		/**
		 * Perform a test to check how a timeline is formed
		 * This simulates two takes then allows for analysis of the state.
		 * @param customRundownFactory Factory to produce the rundown to play
		 * @param fcn Function to perform some playout operations and check the results
		 */
		async function runTimelineTimings(
			customRundownFactory: (
				context: MockJobContext,
				playlistId: RundownPlaylistId,
				rundownId: RundownId,
				showStyle: ReadonlyDeep<ProcessedShowStyleCompound>
			) => Promise<RundownId>,
			fcn: (
				playlistId: RundownPlaylistId,
				rundownId: RundownId,
				parts: DBPart[],
				getPartInstances: () => Promise<SelectedPartInstances>,
				checkTimings: (timings: PartTimelineTimings) => Promise<void>
			) => Promise<void>
		) {
			const rundownId0: RundownId = getRandomId()
			const playlistId0 = await context.mockCollections.RundownPlaylists.insertOne(
				defaultRundownPlaylist(protectString('playlist_' + rundownId0), context.studioId)
			)

			const rundownId = await customRundownFactory(context, playlistId0, rundownId0, showStyle)
			expect(rundownId0).toBe(rundownId)

			const rundown = (await context.directCollections.Rundowns.findOne(rundownId0)) as Rundown
			expect(rundown).toBeTruthy()

			{
				const playlist = (await context.directCollections.RundownPlaylists.findOne(
					playlistId0
				)) as DBRundownPlaylist
				expect(playlist).toBeTruthy()

				// Ensure this is defined to something, for the jest matcher
				playlist.activationId = playlist.activationId ?? undefined

				expect(playlist).toMatchObject({
					activationId: undefined,
					rehearsal: false,
				})
			}

			const parts = await getSortedPartsForRundown(context, rundown._id)

			// Prepare and activate in rehersal:
			await doActivatePlaylist(context, playlistId0, parts[0]._id)

			const getPartInstances = async (): Promise<SelectedPartInstances> => {
				const playlist = (await context.directCollections.RundownPlaylists.findOne(
					playlistId0
				)) as DBRundownPlaylist
				expect(playlist).toBeTruthy()
				const res = await getSelectedPartInstances(context, playlist)

				async function wrapPartInstance(
					partInstance: DBPartInstance | null
				): Promise<PlayoutPartInstanceModel | undefined> {
					if (!partInstance) return undefined

					const pieceInstances = await context.directCollections.PieceInstances.findFetch({
						partInstanceId: partInstance?._id,
					})
					return new PlayoutPartInstanceModelImpl(
						partInstance,
						pieceInstances,
						false,
						mock<QuickLoopService>()
					)
				}

				return {
					currentPartInstance: await wrapPartInstance(res.currentPartInstance),
					nextPartInstance: await wrapPartInstance(res.nextPartInstance),
					previousPartInstance: await wrapPartInstance(res.previousPartInstance),
				}
			}

			const checkTimings = async (timings: PartTimelineTimings) => {
				// Check the calculated timings
				const timeline = await context.directCollections.Timelines.findOne(context.studio._id)
				expect(timeline).toBeTruthy()

				// console.log('objs', JSON.stringify(timeline?.timeline?.map((o) => o.id) || [], undefined, 4))

				await doUpdateTimeline(context, playlistId0)

				const { currentPartInstance, previousPartInstance } = await getPartInstances()
				return checkTimingsRaw(rundownId0, timeline, currentPartInstance!, previousPartInstance, timings)
			}

			// Run the required steps
			await fcn(playlistId0, rundownId0, parts, getPartInstances, checkTimings)

			// Deactivate rundown:
			await doDeactivatePlaylist(context, playlistId0)

			const timelinesEnd = await context.directCollections.Timelines.findFetch()
			expect(fixSnapshot(timelinesEnd)).toMatchSnapshot()
		}

		describe('In transitions', () => {
			testTransitionTimings(
				'Basic inTransition',
				setupRundownWithInTransition,
				async (_rundownId0, _timeline, currentPartInstance, _previousPartInstance, checkTimings) => {
					await checkTimings({
						// old part is extended by 1000ms due to transition keepalive
						previousPart: { end: `#${getPartGroupId(currentPartInstance)}.start + 1000` },
						currentPieces: {
							// pieces are delayed by the content delay
							piece010: {
								controlObj: { start: 0 },
								childGroup: { preroll: 0, postroll: 0 },
							},
						},
						currentInfinitePieces: {},
						previousOutTransition: undefined,
					})
				}
			)

			testTransitionTimings(
				'Basic inTransition with planned pieces',
				setupRundownWithInTransitionPlannedPiece,
				async (_rundownId0, _timeline, currentPartInstance, _previousPartInstance, checkTimings) => {
					await checkTimings({
						// old part is extended by 1000ms due to transition keepalive
						previousPart: { end: `#${getPartGroupId(currentPartInstance)}.start + 1000` },
						currentPieces: {
							// pieces are delayed by the content delay
							piece010: {
								controlObj: { start: 500 },
								childGroup: { preroll: 0, postroll: 0 },
							},
							// transition piece
							piece011: {
								controlObj: { start: 0 },
								childGroup: { preroll: 0, postroll: 0 },
							},
							// pieces are delayed by the content delay
							piece012: {
								controlObj: { start: 1500, duration: 1000 },
								childGroup: { preroll: 0, postroll: 0 },
							},
						},
						currentInfinitePieces: {},
						previousOutTransition: undefined,
					})
				}
			)

			testTransitionTimings(
				'Preroll',
				setupRundownWithPreroll,
				async (_rundownId0, _timeline, currentPartInstance, _previousPartInstance, checkTimings) => {
					await checkTimings({
						// old part is extended due to preroll
						previousPart: { end: `#${getPartGroupId(currentPartInstance)}.start + 500` },
						currentPieces: {
							// main piece
							piece010: {
								controlObj: { start: 500 },
								childGroup: { preroll: 500, postroll: 0 },
							},
						},
						currentInfinitePieces: {},
						previousOutTransition: undefined,
					})
				}
			)

			testTransitionTimings(
				'Basic inTransition with contentDelay',
				setupRundownWithInTransitionContentDelay,
				async (_rundownId0, _timeline, currentPartInstance, _previousPartInstance, checkTimings) => {
					await checkTimings({
						// old part is extended due to preroll and transition keepalive
						previousPart: { end: `#${getPartGroupId(currentPartInstance)}.start + 1000` },
						currentPieces: {
							// pieces are delayed by the content delay
							piece010: {
								controlObj: { start: 500 },
								childGroup: { preroll: 0, postroll: 0 },
							},
							// transition piece
							piece011: {
								controlObj: { start: 0 },
								childGroup: { preroll: 0, postroll: 0 },
							},
						},
						currentInfinitePieces: {},
						previousOutTransition: undefined,
					})
				}
			)

			testTransitionTimings(
				'Basic inTransition with contentDelay + preroll',
				setupRundownWithInTransitionContentDelayAndPreroll,
				async (_rundownId0, _timeline, currentPartInstance, _previousPartInstance, checkTimings) => {
					await checkTimings({
						// old part is extended due to preroll and transition keepalive
						previousPart: { end: `#${getPartGroupId(currentPartInstance)}.start + 1000` },
						currentPieces: {
							// pieces are delayed by the content delay
							piece010: {
								controlObj: { start: 500 },
								childGroup: { preroll: 250, postroll: 0 },
							},
							// transition piece
							piece011: {
								controlObj: { start: 0 },
								childGroup: { preroll: 0, postroll: 0 },
							},
						},
						currentInfinitePieces: {},
						previousOutTransition: undefined,
					})
				}
			)

			testTransitionTimings(
				'inTransition with existing infinites',
				setupRundownWithInTransitionExistingInfinite,
				async (
					_rundownId0,
					_timeline,
					currentPartInstance,
					_previousPartInstance,
					checkTimings,
					previousTakeTime
				) => {
					await checkTimings({
						// old part is extended due to transition keepalive
						previousPart: { end: `#${getPartGroupId(currentPartInstance)}.start + 1000` },
						currentPieces: {
							// pieces are delayed by the content delay
							piece010: {
								controlObj: { start: 500 },
								childGroup: { preroll: 0, postroll: 0 },
							},
							// transition piece
							piece011: {
								controlObj: { start: 0 },
								childGroup: { preroll: 0, postroll: 0 },
							},
						},
						currentInfinitePieces: {
							piece002: {
								// Should still be based on the time of previousPart, offset for preroll
								partGroup: { start: previousTakeTime - 500 },
								pieceGroup: {
									controlObj: { start: 500 },
									childGroup: { preroll: 0, postroll: 0 },
								},
							},
						},
						previousOutTransition: undefined,
					})
				}
			)

			testTransitionTimings(
				'inTransition with new infinite',
				setupRundownWithInTransitionNewInfinite,
				async (_rundownId0, _timeline, currentPartInstance, _previousPartInstance, checkTimings) => {
					await checkTimings({
						// old part is extended due to transition keepalive
						previousPart: { end: `#${getPartGroupId(currentPartInstance)}.start + 1000` },
						currentPieces: {
							// pieces are delayed by the content delay
							piece010: {
								controlObj: { start: 500 },
								childGroup: { preroll: 0, postroll: 0 },
							},
							// transition piece
							piece011: {
								controlObj: { start: 0 },
								childGroup: { preroll: 0, postroll: 0 },
							},
						},
						currentInfinitePieces: {
							piece012: {
								// Delay get applied to the pieceGroup inside the partGroup
								partGroup: { start: `#${getPartGroupId(currentPartInstance)}.start` },
								pieceGroup: {
									controlObj: { start: 500 },
									childGroup: { preroll: 0, postroll: 0 },
								},
							},
						},
						previousOutTransition: undefined,
					})
				}
			)

			// eslint-disable-next-line jest/expect-expect
			test('inTransition is disabled during hold', async () =>
				runTimelineTimings(
					setupRundownWithInTransitionEnableHold,
					async (playlistId, _rundownId, parts, getPartInstances, checkTimings) => {
						// Take the first Part:
						await doTakePart(context, playlistId, null, parts[0]._id, parts[1]._id)

						// activate hold mode
						await handleActivateHold(context, { playlistId: playlistId })

						await doTakePart(context, playlistId, parts[0]._id, parts[1]._id, null)

						const { currentPartInstance } = await getPartInstances()
						await checkTimings({
							// old part ends immediately
							previousPart: { end: `#${getPartGroupId(currentPartInstance!.partInstance)}.start + 0` },
							currentPieces: {
								// pieces are not delayed
								piece010: {
									controlObj: { start: 0 },
									childGroup: { preroll: 0, postroll: 0 },
								},
								// no in transition
								piece011: null,
							},
							currentInfinitePieces: {},
							previousOutTransition: undefined,
						})
					}
				))

			testTransitionTimings(
				'inTransition disabled',
				setupRundownWithInTransitionDisabled,
				async (_rundownId0, _timeline, currentPartInstance, _previousPartInstance, checkTimings) => {
					await checkTimings({
						// old part is not extended
						previousPart: { end: `#${getPartGroupId(currentPartInstance)}.start + 0` },
						currentPieces: {
							// pieces are not delayed
							piece010: {
								controlObj: { start: 0 },
								childGroup: { preroll: 0, postroll: 0 },
							},
							// no transition piece
							piece011: null,
						},
						currentInfinitePieces: {},
						previousOutTransition: undefined,
					})
				}
			)
		})

		describe('Out transitions', () => {
			testTransitionTimings(
				'Basic outTransition',
				setupRundownWithOutTransition,
				async (_rundownId0, _timeline, currentPartInstance, previousPartInstance, checkTimings) => {
					await checkTimings({
						// old part is extended by 1000ms due to transition keepalive
						previousPart: { end: `#${getPartGroupId(currentPartInstance)}.start + 1000` },
						currentPieces: {
							// pieces are delayed by outTransition time
							piece010: {
								controlObj: { start: 1000 },
								childGroup: { preroll: 0, postroll: 0 },
							},
						},
						currentInfinitePieces: {},
						// outTransitionPiece is inserted
						previousOutTransition: {
							controlObj: { start: `#${getPartGroupId(previousPartInstance)}.end - 1000` },
							childGroup: { preroll: 0, postroll: 0 },
						},
					})
				}
			)

			testTransitionTimings(
				'outTransition + preroll',
				setupRundownWithOutTransitionAndPreroll,
				async (_rundownId0, _timeline, currentPartInstance, previousPartInstance, checkTimings) => {
					await checkTimings({
						// old part is extended by 1000ms due to transition keepalive
						previousPart: { end: `#${getPartGroupId(currentPartInstance)}.start + 1000` },
						currentPieces: {
							// pieces are delayed by outTransition time
							piece010: {
								// 1000ms out transition, 250ms preroll
								controlObj: { start: 1000 },
								childGroup: { preroll: 250, postroll: 0 },
							},
						},
						currentInfinitePieces: {},
						// outTransitionPiece is inserted
						previousOutTransition: {
							controlObj: { start: `#${getPartGroupId(previousPartInstance)}.end - 1000` },
							childGroup: { preroll: 0, postroll: 0 },
						},
					})
				}
			)

			testTransitionTimings(
				'outTransition + preroll (2)',
				setupRundownWithOutTransitionAndPreroll2,
				async (_rundownId0, _timeline, currentPartInstance, previousPartInstance, checkTimings) => {
					await checkTimings({
						// old part is extended by 1000ms due to transition keepalive
						previousPart: { end: `#${getPartGroupId(currentPartInstance)}.start + 1000` },
						currentPieces: {
							// pieces are delayed by outTransition time
							piece010: {
								// 250ms out transition, 1000ms preroll. preroll takes precedence
								controlObj: { start: 1000 },
								childGroup: { preroll: 1000, postroll: 0 },
							},
						},
						currentInfinitePieces: {},
						// outTransitionPiece is inserted
						previousOutTransition: {
							controlObj: { start: `#${getPartGroupId(previousPartInstance)}.end - 250` },
							childGroup: { preroll: 0, postroll: 0 },
						},
					})
				}
			)

			testTransitionTimings(
				'outTransition + inTransition',
				setupRundownWithOutTransitionAndInTransition,
				async (_rundownId0, _timeline, currentPartInstance, previousPartInstance, checkTimings) => {
					await checkTimings({
						// old part is extended by 1000ms due to transition keepalive
						previousPart: { end: `#${getPartGroupId(currentPartInstance)}.start + 600` }, // 600ms outtransiton & 250ms transition keepalive
						currentPieces: {
							// pieces are delayed by in transition preroll time
							piece010: {
								// inTransPieceTlObj + 300 contentDelay
								controlObj: { start: 650 },
								childGroup: { preroll: 0, postroll: 0 },
							},
							// in transition is delayed by outTransition time
							piece011: {
								// 600 - 250 = 350
								controlObj: { start: 350, duration: 500 },
								childGroup: { preroll: 0, postroll: 0 },
							},
						},
						currentInfinitePieces: {},
						// outTransitionPiece is inserted
						previousOutTransition: {
							controlObj: { start: `#${getPartGroupId(previousPartInstance)}.end - 600` },
							childGroup: { preroll: 0, postroll: 0 },
						},
					})
				}
			)

			// eslint-disable-next-line jest/expect-expect
			test('outTransition is disabled during hold', async () =>
				runTimelineTimings(
					setupRundownWithOutTransitionEnableHold,
					async (playlistId, _rundownId, parts, getPartInstances, checkTimings) => {
						// Take the first Part:
						await doTakePart(context, playlistId, null, parts[0]._id, parts[1]._id)

						// activate hold mode
						await handleActivateHold(context, { playlistId: playlistId })

						await doTakePart(context, playlistId, parts[0]._id, parts[1]._id, null)

						const { currentPartInstance } = await getPartInstances()
						await checkTimings({
							previousPart: { end: `#${getPartGroupId(currentPartInstance!.partInstance)}.start + 500` }, // note: this seems odd, but the pieces are delayed to compensate
							currentPieces: {
								piece010: {
									controlObj: { start: 500 }, // note: Offset matches extension of previous partGroup
									childGroup: { preroll: 0, postroll: 0 },
								},
							},
							currentInfinitePieces: {},
							previousOutTransition: undefined,
						})
					}
				))
		})

		describe('Adlib pieces', () => {
			async function doStartAdlibPiece(playlistId: RundownPlaylistId, adlibSource: AdLibPiece) {
				await runJobWithPlayoutModel(context, { playlistId }, null, async (playoutModel) => {
					const currentPartInstance = playoutModel.currentPartInstance as PlayoutPartInstanceModel
					expect(currentPartInstance).toBeTruthy()

					const rundown = playoutModel.getRundown(
						currentPartInstance.partInstance.rundownId
					) as PlayoutRundownModel
					expect(rundown).toBeTruthy()

					return innerStartOrQueueAdLibPiece(
						context,
						playoutModel,
						rundown,
						false,
						currentPartInstance,
						adlibSource
					)
				})
			}

			async function doSimulatePiecePlaybackTimings(
				playlistId: RundownPlaylistId,
				time: Time,
				objectCount: number
			) {
				const timelineComplete = (await context.directCollections.Timelines.findOne(
					context.studioId
				)) as TimelineComplete
				expect(timelineComplete).toBeTruthy()

				const rawTimelineObjs = deserializeTimelineBlob(timelineComplete.timelineBlob)
				const nowObjs = rawTimelineObjs.filter(
					(obj) => !Array.isArray(obj.enable) && obj.enable.start === 'now'
				)
				expect(nowObjs).toHaveLength(objectCount)

				const results = nowObjs.map((obj) => ({
					id: obj.id,
					time: time,
				}))
				// console.log('Sending trigger for:', results)

				await handleTimelineTriggerTime(context, { results })

				await doUpdateTimeline(context, playlistId)
			}

			test('Current part with preroll', async () =>
				runTimelineTimings(
					async (
						context: MockJobContext,
						playlistId: RundownPlaylistId,
						rundownId: RundownId,
						showStyle: ReadonlyDeep<ProcessedShowStyleCompound>
					): Promise<RundownId> => {
						const sourceLayerIds = Object.keys(showStyle.sourceLayers)

						await setupRundownBase(
							context,
							playlistId,
							rundownId,
							showStyle,
							{},
							{
								piece0: { prerollDuration: 500 },
								piece1: { prerollDuration: 50, sourceLayerId: sourceLayerIds[3] },
							}
						)

						return rundownId
					},
					async (playlistId, rundownId, parts, getPartInstances, checkTimings) => {
						const outputLayerIds = Object.keys(showStyle.outputLayers)
						const sourceLayerIds = Object.keys(showStyle.sourceLayers)

						// Take the only Part:
						await doTakePart(context, playlistId, null, parts[0]._id, null)

						// Should look normal for now
						await checkTimings({
							previousPart: null,
							currentPieces: {
								piece000: {
									controlObj: { start: 500 }, // This one gave the preroll
									childGroup: { preroll: 500, postroll: 0 },
								},
								piece001: {
									controlObj: { start: 500 },
									childGroup: { preroll: 50, postroll: 0 },
								},
							},
							currentInfinitePieces: {},
							previousOutTransition: undefined,
						})

						const { currentPartInstance } = await getPartInstances()
						expect(currentPartInstance).toBeTruthy()

						// Insert an adlib piece
						await doStartAdlibPiece(
							playlistId,
							literal<AdLibPiece>({
								_id: protectString('adlib1'),
								rundownId: currentPartInstance!.partInstance.rundownId,
								externalId: 'fake',
								name: 'Adlibbed piece',
								lifespan: PieceLifespan.WithinPart,
								sourceLayerId: sourceLayerIds[0],
								outputLayerId: outputLayerIds[0],
								content: {},
								timelineObjectsString: EmptyPieceTimelineObjectsBlob,
								_rank: 0,
							})
						)

						const adlibbedPieceId = 'randomId9007'

						// The adlib should be starting at 'now'
						await checkTimings({
							previousPart: null,
							currentPieces: {
								piece000: {
									controlObj: {
										start: 500, // This one gave the preroll
										end: `#piece_group_control_${
											currentPartInstance!.partInstance._id
										}_${rundownId}_piece000_cap_now.start + 0`,
									},
									childGroup: {
										preroll: 500,
										postroll: 0,
									},
								},
								piece001: {
									controlObj: {
										start: 500,
									},
									childGroup: {
										preroll: 50,
										postroll: 0,
									},
								},
								[adlibbedPieceId]: {
									// Our adlibbed piece
									controlObj: {
										start: 'now',
									},
									childGroup: {
										preroll: 0,
										postroll: 0,
									},
								},
							},
							currentInfinitePieces: {},
							previousOutTransition: undefined,
						})

						const pieceOffset = 12560

						// Simulate the piece timing confirmation from playout-gateway
						await doSimulatePiecePlaybackTimings(playlistId, pieceOffset, 2) // This pieceOffset includes the partPreroll

						// Now we have a concrete time
						await checkTimings({
							previousPart: null,
							currentPieces: {
								piece000: {
									controlObj: {
										start: 500, // This one gave the preroll
										end: pieceOffset, // This is expected to match the start of the adlib
									},
									childGroup: {
										preroll: 500,
										postroll: 0,
									},
								},
								piece001: {
									controlObj: {
										start: 500,
									},
									childGroup: {
										preroll: 50,
										postroll: 0,
									},
								},
								[adlibbedPieceId]: {
									// Our adlibbed piece
									controlObj: {
										start: pieceOffset,
									},
									childGroup: {
										preroll: 0,
										postroll: 0,
									},
								},
							},
							currentInfinitePieces: {},
							previousOutTransition: undefined,
						})
					}
				))

			test('Current part with preroll and adlib preroll', async () =>
				runTimelineTimings(
					async (
						context: MockJobContext,
						playlistId: RundownPlaylistId,
						rundownId: RundownId,
						showStyle: ReadonlyDeep<ProcessedShowStyleCompound>
					): Promise<RundownId> => {
						const sourceLayerIds = Object.keys(showStyle.sourceLayers)

						await setupRundownBase(
							context,
							playlistId,
							rundownId,
							showStyle,
							{},
							{
								piece0: { prerollDuration: 500 },
								piece1: { prerollDuration: 50, sourceLayerId: sourceLayerIds[3] },
							}
						)

						return rundownId
					},
					async (playlistId, _rundownId, parts, getPartInstances, checkTimings) => {
						const outputLayerIds = Object.keys(showStyle.outputLayers)
						const sourceLayerIds = Object.keys(showStyle.sourceLayers)

						// Take the only Part:
						await doTakePart(context, playlistId, null, parts[0]._id, null)

						// Should look normal for now
						await checkTimings({
							previousPart: null,
							currentPieces: {
								piece000: {
									// This one gave the preroll
									controlObj: {
										start: 500,
									},
									childGroup: {
										preroll: 500,
										postroll: 0,
									},
								},
								piece001: {
									controlObj: {
										start: 500,
									},
									childGroup: {
										preroll: 50,
										postroll: 0,
									},
								},
							},
							currentInfinitePieces: {},
							previousOutTransition: undefined,
						})

						const { currentPartInstance } = await getPartInstances()
						expect(currentPartInstance).toBeTruthy()

						// Insert an adlib piece
						await doStartAdlibPiece(
							playlistId,
							literal<AdLibPiece>({
								_id: protectString('adlib1'),
								rundownId: currentPartInstance!.partInstance.rundownId,
								externalId: 'fake',
								name: 'Adlibbed piece',
								lifespan: PieceLifespan.WithinPart,
								sourceLayerId: sourceLayerIds[0],
								outputLayerId: outputLayerIds[0],
								content: {},
								timelineObjectsString: EmptyPieceTimelineObjectsBlob,
								_rank: 0,
								prerollDuration: 340,
							})
						)

						const adlibbedPieceId = 'randomId9007'

						// The adlib should be starting at 'now'
						await checkTimings({
							previousPart: null,
							currentPieces: {
								piece000: {
									controlObj: {
										start: 500, // This one gave the preroll
										end: `#piece_group_control_${
											currentPartInstance!.partInstance._id
										}_${_rundownId}_piece000_cap_now.start + 0`,
									},
									childGroup: {
										preroll: 500,
										postroll: 0,
									},
								},
								piece001: {
									controlObj: {
										start: 500,
									},
									childGroup: {
										preroll: 50,
										postroll: 0,
									},
								},
								[adlibbedPieceId]: {
									// Our adlibbed piece
									controlObj: {
										start: `#piece_group_control_${
											currentPartInstance!.partInstance._id
										}_${adlibbedPieceId}_start_now + 340`,
									},
									childGroup: {
										preroll: 340,
										postroll: 0,
									},
								},
							},
							currentInfinitePieces: {},
							previousOutTransition: undefined,
						})

						const pieceOffset = 12560
						// Simulate the piece timing confirmation from playout-gateway
						await doSimulatePiecePlaybackTimings(playlistId, pieceOffset, 2)

						// Now we have a concrete time
						await checkTimings({
							previousPart: null,
							currentPieces: {
								piece000: {
									controlObj: {
										start: 500, // This one gave the preroll
										end: pieceOffset,
									},
									childGroup: {
										preroll: 500,
										postroll: 0,
									},
								},
								piece001: {
									controlObj: {
										start: 500,
									},
									childGroup: {
										preroll: 50,
										postroll: 0,
									},
								},
								[adlibbedPieceId]: {
									// Our adlibbed piece
									controlObj: {
										start: pieceOffset,
									},
									childGroup: {
										preroll: 340,
										postroll: 0,
									},
								},
							},
							currentInfinitePieces: {},
							previousOutTransition: undefined,
						})
					}
				))
		})

		describe('Infinite Pieces', () => {
			test('Infinite Piece has stable timing across timeline regenerations with/without plannedStartedPlayback', async () =>
				runTimelineTimings(
					async (
						context: MockJobContext,
						playlistId: RundownPlaylistId,
						rundownId: RundownId,
						showStyle: ReadonlyDeep<ProcessedShowStyleCompound>
					): Promise<RundownId> => {
						const sourceLayerIds = Object.keys(showStyle.sourceLayers)

						await setupRundownBase(
							context,
							playlistId,
							rundownId,
							showStyle,
							{},
							{
								piece0: { prerollDuration: 500 },
								piece1: {
									prerollDuration: 50,
									sourceLayerId: sourceLayerIds[3],
									lifespan: PieceLifespan.OutOnSegmentEnd,
								},
							}
						)

						return rundownId
					},
					async (playlistId, rundownId, parts, getPartInstances, checkTimings) => {
						// Take the only Part:
						await doTakePart(context, playlistId, null, parts[0]._id, null)

						const { currentPartInstance } = await getPartInstances()
						expect(currentPartInstance).toBeTruthy()
						if (!currentPartInstance) throw new Error('currentPartInstance must be defined')

						// Should look normal for now
						await checkTimings({
							previousPart: null,
							currentPieces: {
								piece000: {
									// This one gave the preroll
									controlObj: {
										start: 500,
									},
									childGroup: {
										preroll: 500,
										postroll: 0,
									},
								},
							},
							currentInfinitePieces: {
								piece001: {
									pieceGroup: {
										childGroup: {
											preroll: 50,
											postroll: 0,
										},
										controlObj: {
											start: 500,
										},
									},
									partGroup: {
										start: `#part_group_${currentPartInstance.partInstance._id}.start`,
									},
								},
							},
							previousOutTransition: undefined,
						})

						const currentPieceInstances = currentPartInstance.pieceInstances
						const pieceInstance0 = currentPieceInstances.find(
							(instance) => instance.pieceInstance.piece._id === protectString(`${rundownId}_piece000`)
						)
						if (!pieceInstance0) throw new Error('pieceInstance0 must be defined')
						const pieceInstance1 = currentPieceInstances.find(
							(instance) => instance.pieceInstance.piece._id === protectString(`${rundownId}_piece001`)
						)
						if (!pieceInstance1) throw new Error('pieceInstance1 must be defined')

						const currentTime = 12300
						await doOnPlayoutPlaybackChanged(context, playlistId, {
							baseTime: currentTime,
							partId: currentPartInstance.partInstance._id,
							includePart: true,
							pieceOffsets: {
								[unprotectString(pieceInstance0.pieceInstance._id)]: 500,
								[unprotectString(pieceInstance1.pieceInstance._id)]: 500,
							},
						})

						await doUpdateTimeline(context, playlistId)

						await checkTimings({
							previousPart: null,
							currentPieces: {
								piece000: {
									controlObj: {
										start: 500,
									},
									childGroup: {
										preroll: 500,
										postroll: 0,
									},
								},
							},
							currentInfinitePieces: {
								piece001: {
									pieceGroup: {
										childGroup: {
											preroll: 50,
											postroll: 0,
										},
										controlObj: {
											start: 500,
										},
									},
									partGroup: {
										start: currentTime, // same as the partGroup, note that this counteracts the offset in onPlayoutPlaybackChanged
									},
								},
							},
							previousOutTransition: undefined,
						})
					}
				))
		})
	})
	describe('Multi-gateway mode', () => {
		let context: MockJobContext
		let showStyle: ReadonlyDeep<ProcessedShowStyleCompound>

		const playoutLatency = 5
		const latencySafetyMargin = 10

		beforeEach(async () => {
			restartRandomId()

			context = setupDefaultJobEnvironment(undefined, {
				forceMultiGatewayMode: true,
				multiGatewayNowSafeLatency: latencySafetyMargin,
			})

			useFakeCurrentTime(10000)

			showStyle = await setupMockShowStyleCompound(context)

			// Ignore calls to queueEventJob, they are expected
			context.queueEventJob = async () => Promise.resolve()
		})
		afterEach(() => {
			useRealCurrentTime()
		})

		/**
		 * Perform a test to check how a transition is formed on the timeline.
		 * This simulates two takes then allows for analysis of the state.
		 * @param name Name of the test
		 * @param customRundownFactory Factory to produce the rundown to play
		 * @param checkFcn Function used to check the resulting timeline
		 * @param timeout Override the timeout of the test
		 */
		function testTransitionTimings(
			name: string,
			customRundownFactory: (
				context: MockJobContext,
				playlistId: RundownPlaylistId,
				rundownId: RundownId,
				showStyle: ReadonlyDeep<ProcessedShowStyleCompound>
			) => Promise<RundownId>,
			checkFcn: (
				rundownId: RundownId,
				timeline: null,
				currentPartInstance: DBPartInstance,
				previousPartInstance: DBPartInstance,
				checkTimings: (timings: PartTimelineTimings) => Promise<void>,
				previousTakeTime: number
			) => Promise<void>,
			timeout?: number
		) {
			// eslint-disable-next-line jest/expect-expect
			test(
				// eslint-disable-next-line jest/valid-title
				name,
				async () =>
					runTimelineTimings(
						customRundownFactory,
						async (playlistId, rundownId, parts, _getPartInstances, checkTimings) => {
							// Take the first Part:
							const { currentPartInstance: currentPartInstance0 } = await doTakePart(
								context,
								playlistId,
								null,
								parts[0]._id,
								parts[1]._id
							)

							const afterFirstTakeTime = getCurrentTime()

							// Report the first part as having started playback
							await doAutoPlayoutPlaybackChangedForPart(
								context,
								playlistId,
								currentPartInstance0!._id,
								getCurrentTime()
							)

							// Take the second Part:
							const { currentPartInstance, previousPartInstance } = await doTakePart(
								context,
								playlistId,
								parts[0]._id,
								parts[1]._id,
								null
							)

							// Report the second part as having started playback
							await doAutoPlayoutPlaybackChangedForPart(
								context,
								playlistId,
								currentPartInstance!._id,
								getCurrentTime()
							)

							// Run the result check
							await checkFcn(
								rundownId,
								null,
								currentPartInstance!,
								previousPartInstance!,
								checkTimings,
								afterFirstTakeTime + playoutLatency + latencySafetyMargin
							)
						}
					),
				timeout
			)
		}

		/**
		 * Perform a test to check how a timeline is formed
		 * This simulates two takes then allows for analysis of the state.
		 * @param customRundownFactory Factory to produce the rundown to play
		 * @param fcn Function to perform some playout operations and check the results
		 */
		async function runTimelineTimings(
			customRundownFactory: (
				context: MockJobContext,
				playlistId: RundownPlaylistId,
				rundownId: RundownId,
				showStyle: ReadonlyDeep<ProcessedShowStyleCompound>
			) => Promise<RundownId>,
			fcn: (
				playlistId: RundownPlaylistId,
				rundownId: RundownId,
				parts: DBPart[],
				getPartInstances: () => Promise<SelectedPartInstances>,
				checkTimings: (timings: PartTimelineTimings) => Promise<void>
			) => Promise<void>
		) {
			await setupMockPeripheralDevice(
				context,
				PeripheralDeviceCategory.PLAYOUT,
				PeripheralDeviceType.PLAYOUT,
				PERIPHERAL_SUBTYPE_PROCESS,
				{
					latencies: [playoutLatency],
				}
			)

			const rundownId0: RundownId = getRandomId()
			const playlistId0 = await context.mockCollections.RundownPlaylists.insertOne(
				defaultRundownPlaylist(protectString('playlist_' + rundownId0), context.studioId)
			)

			const rundownId = await customRundownFactory(context, playlistId0, rundownId0, showStyle)
			expect(rundownId0).toBe(rundownId)

			const rundown = (await context.directCollections.Rundowns.findOne(rundownId0)) as Rundown
			expect(rundown).toBeTruthy()

			{
				const playlist = (await context.directCollections.RundownPlaylists.findOne(
					playlistId0
				)) as DBRundownPlaylist
				expect(playlist).toBeTruthy()

				// Ensure this is defined to something, for the jest matcher
				playlist.activationId = playlist.activationId ?? undefined

				expect(playlist).toMatchObject({
					activationId: undefined,
					rehearsal: false,
				})
			}

			const parts = await getSortedPartsForRundown(context, rundown._id)

			// Prepare and activate in rehersal:
			await doActivatePlaylist(context, playlistId0, parts[0]._id)

			const getPartInstances = async (): Promise<SelectedPartInstances> => {
				const playlist = (await context.directCollections.RundownPlaylists.findOne(
					playlistId0
				)) as DBRundownPlaylist
				expect(playlist).toBeTruthy()
				const res = await getSelectedPartInstances(context, playlist)

				async function wrapPartInstance(
					partInstance: DBPartInstance | null
				): Promise<PlayoutPartInstanceModel | undefined> {
					if (!partInstance) return undefined

					const pieceInstances = await context.directCollections.PieceInstances.findFetch({
						partInstanceId: partInstance?._id,
					})
					return new PlayoutPartInstanceModelImpl(
						partInstance,
						pieceInstances,
						false,
						mock<QuickLoopService>()
					)
				}

				return {
					currentPartInstance: await wrapPartInstance(res.currentPartInstance),
					nextPartInstance: await wrapPartInstance(res.nextPartInstance),
					previousPartInstance: await wrapPartInstance(res.previousPartInstance),
				}
			}

			const checkTimings = async (timings: PartTimelineTimings) => {
				// Check the calculated timings
				const timeline = await context.directCollections.Timelines.findOne(context.studio._id)
				expect(timeline).toBeTruthy()

				const { currentPartInstance, previousPartInstance } = await getPartInstances()
				return checkTimingsRaw(rundownId0, timeline, currentPartInstance!, previousPartInstance, timings)
			}

			// Run the required steps
			await fcn(playlistId0, rundownId0, parts, getPartInstances, checkTimings)

			// Deactivate rundown:
			await doDeactivatePlaylist(context, playlistId0)

			const timelinesEnd = await context.directCollections.Timelines.findFetch()
			expect(fixSnapshot(timelinesEnd)).toMatchSnapshot()
		}

		describe('In transitions', () => {
			testTransitionTimings(
				'inTransition with existing infinites',
				setupRundownWithInTransitionExistingInfinite,
				async (
					_rundownId0,
					_timeline,
					currentPartInstance,
					_previousPartInstance,
					checkTimings,
					firstPartTakeTime
				) => {
					await checkTimings({
						// old part is extended due to transition keepalive
						previousPart: { end: `#${getPartGroupId(currentPartInstance)}.start + 1000` },
						currentPieces: {
							// pieces are delayed by the content delay
							piece010: {
								controlObj: { start: 500 },
								childGroup: { preroll: 0, postroll: 0 },
							},
							// transition piece
							piece011: {
								controlObj: { start: 0 },
								childGroup: { preroll: 0, postroll: 0 },
							},
						},
						currentInfinitePieces: {
							piece002: {
								// Should still be based on the time of previousPart
								partGroup: { start: firstPartTakeTime },
								pieceGroup: {
									controlObj: { start: 500 },
									childGroup: { preroll: 0, postroll: 0 },
								},
							},
						},
						previousOutTransition: undefined,
					})
				}
			)
		})

		describe('Infinite Pieces', () => {
			test('Infinite Piece has stable timing across timeline regenerations after onPlayoutPlaybackChanged', async () =>
				runTimelineTimings(
					async (
						context: MockJobContext,
						playlistId: RundownPlaylistId,
						rundownId: RundownId,
						showStyle: ReadonlyDeep<ProcessedShowStyleCompound>
					): Promise<RundownId> => {
						const sourceLayerIds = Object.keys(showStyle.sourceLayers)

						await setupRundownBase(
							context,
							playlistId,
							rundownId,
							showStyle,
							{},
							{
								piece0: { prerollDuration: 500 },
								piece1: {
									prerollDuration: 50,
									sourceLayerId: sourceLayerIds[3],
									lifespan: PieceLifespan.OutOnSegmentEnd,
								},
							}
						)

						return rundownId
					},
					async (playlistId, rundownId, parts, getPartInstances, checkTimings) => {
						useFakeCurrentTime(10000)

						// Take the only Part:
						await doTakePart(context, playlistId, null, parts[0]._id, null) // this moves 1500ms forward in fake time before doing a take
						const afterTakeTime = 11500 // getCurrentTime()
						const plannedStartedPlayback = afterTakeTime + playoutLatency + latencySafetyMargin // 11515 = 11500 + 5 + 10

						const { currentPartInstance } = await getPartInstances()
						expect(currentPartInstance).toBeTruthy()
						if (!currentPartInstance) throw new Error('currentPartInstance must be defined')

						const expectedTimeline = {
							previousPart: null,
							currentPieces: {
								piece000: {
									// This one gave the preroll
									controlObj: {
										start: 500,
									},
									childGroup: {
										preroll: 500,
										postroll: 0,
									},
								},
							},
							currentInfinitePieces: {
								piece001: {
									pieceGroup: {
										childGroup: {
											preroll: 50,
											postroll: 0,
										},
										controlObj: {
											start: 500,
										},
									},
									partGroup: {
										start: plannedStartedPlayback,
									},
								},
							},
							previousOutTransition: undefined,
						} as const

						// Should look normal for now
						await checkTimings(expectedTimeline)

						await doUpdateTimeline(context, playlistId)

						// Should look normal for now
						await checkTimings(expectedTimeline)

						const currentPieceInstances = currentPartInstance.pieceInstances
						const pieceInstance0 = currentPieceInstances.find(
							(instance) => instance.pieceInstance.piece._id === protectString(`${rundownId}_piece000`)
						)
						if (!pieceInstance0) throw new Error('pieceInstance0 must be defined')
						const pieceInstance1 = currentPieceInstances.find(
							(instance) => instance.pieceInstance.piece._id === protectString(`${rundownId}_piece001`)
						)
						if (!pieceInstance1) throw new Error('pieceInstance1 must be defined')

						// actual playback starts a bit later than planned
						const actualStartedPlayback = plannedStartedPlayback + 3

						// reception of the onPlayoutPlaybackChanged event also takes some time
						adjustFakeTime(200)

						await doOnPlayoutPlaybackChanged(context, playlistId, {
							baseTime: actualStartedPlayback,
							partId: currentPartInstance.partInstance._id,
							includePart: true,
							pieceOffsets: {
								[unprotectString(pieceInstance0.pieceInstance._id)]: 500,
								[unprotectString(pieceInstance1.pieceInstance._id)]: 500,
							},
						})

						await doUpdateTimeline(context, playlistId)

						await checkTimings(expectedTimeline)
					}
				))
		})
	})
})
