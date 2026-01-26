import {
	PartId,
	PartInstanceId,
	PieceId,
	PieceInstanceId,
	RundownId,
	RundownPlaylistActivationId,
	RundownPlaylistId,
	SegmentId,
	SegmentPlayoutId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { PeripheralDevice, PeripheralDeviceType } from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'
import {
	ABSessionAssignments,
	ABSessionInfo,
	DBRundownPlaylist,
	QuickLoopMarker,
	RundownHoldState,
	SelectedPartInstance,
} from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { ReadonlyDeep } from 'type-fest'
import { JobContext } from '../../../jobs/index.js'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import {
	getPieceInstanceIdForPiece,
	PieceInstance,
	PieceInstancePiece,
} from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import {
	serializeTimelineBlob,
	TimelineComplete,
	TimelineCompleteGenerationVersions,
	TimelineObjGeneric,
} from '@sofie-automation/corelib/dist/dataModel/Timeline'
import _ from 'underscore'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { PlaylistLock } from '../../../jobs/lock.js'
import { logger } from '../../../logging.js'
import {
	clone,
	getRandomId,
	groupByToMapFunc,
	literal,
	normalizeArrayToMapFunc,
} from '@sofie-automation/corelib/dist/lib'
import { sleep } from '@sofie-automation/shared-lib/dist/lib/lib'
import { sortRundownIDsInPlaylist } from '@sofie-automation/corelib/dist/playout/playlist'
import { PlayoutRundownModel } from '../PlayoutRundownModel.js'
import { PlayoutRundownModelImpl } from './PlayoutRundownModelImpl.js'
import { PlayoutSegmentModel } from '../PlayoutSegmentModel.js'
import { PlayoutPartInstanceModelImpl } from './PlayoutPartInstanceModelImpl.js'
import { PlayoutPartInstanceModel } from '../PlayoutPartInstanceModel.js'
import { getCurrentTime } from '../../../lib/index.js'
import { protectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import { queuePartInstanceTimingEvent } from '../../timings/events.js'
import { IS_PRODUCTION } from '../../../environment.js'
import { DeferredAfterSaveFunction, DeferredFunction, PlayoutModel, PlayoutModelReadonly } from '../PlayoutModel.js'
import {
	writePartInstancesAndPieceInstances,
	writeAdlibTestingSegments,
	writeExpectedPackagesForPlayoutSources,
} from './SavePlayoutModel.js'
import { PlayoutPieceInstanceModel } from '../PlayoutPieceInstanceModel.js'
import { DatabasePersistedModel } from '../../../modelBase.js'
import { ExpectedPlayoutItemStudio } from '@sofie-automation/corelib/dist/dataModel/ExpectedPlayoutItem'
import { StudioBaselineHelper } from '../../../studio/model/StudioBaselineHelper.js'
import { QuickLoopService } from '../services/QuickLoopService.js'
import { calculatePartTimings, PartCalculatedTimings } from '@sofie-automation/corelib/dist/playout/timings'
import { PieceInstanceWithTimings } from '@sofie-automation/corelib/dist/playout/processAndPrune'
import { NotificationsModelHelper } from '../../../notifications/NotificationsModelHelper.js'
import { getExpectedLatency } from '@sofie-automation/corelib/dist/studio/playout'
import { ExpectedPackage } from '@sofie-automation/blueprints-integration'

export class PlayoutModelReadonlyImpl implements PlayoutModelReadonly {
	public readonly playlistId: RundownPlaylistId

	public readonly playlistLock: PlaylistLock

	public readonly peripheralDevices: ReadonlyDeep<PeripheralDevice[]>

	protected readonly playlistImpl: DBRundownPlaylist
	public get playlist(): ReadonlyDeep<DBRundownPlaylist> {
		return this.playlistImpl
	}

	protected readonly rundownsImpl: readonly PlayoutRundownModelImpl[]
	public get rundowns(): readonly PlayoutRundownModel[] {
		return this.rundownsImpl
	}

	protected timelineImpl: TimelineComplete | null
	public get timeline(): TimelineComplete | null {
		return this.timelineImpl
	}

	protected allPartInstances: Map<PartInstanceId, PlayoutPartInstanceModelImpl | null> = new Map()

	protected quickLoopService: QuickLoopService

	public constructor(
		protected readonly context: JobContext,
		playlistLock: PlaylistLock,
		playlistId: RundownPlaylistId,
		peripheralDevices: ReadonlyDeep<PeripheralDevice[]>,
		playlist: DBRundownPlaylist,
		partInstances: DBPartInstance[],
		groupedPieceInstances: Map<PartInstanceId, PieceInstance[]>,
		rundowns: PlayoutRundownModelImpl[],
		timeline: TimelineComplete | undefined
	) {
		this.playlistId = playlistId
		this.playlistLock = playlistLock

		this.peripheralDevices = peripheralDevices
		this.playlistImpl = playlist

		this.quickLoopService = new QuickLoopService(context, this)

		this.allPartInstances = normalizeArrayToMapFunc(
			this.createPartInstanceModelImpls(partInstances, groupedPieceInstances),
			(p) => p.partInstance._id
		)

		this.rundownsImpl = rundowns

		this.timelineImpl = timeline ?? null
	}

	private createPartInstanceModelImpls(
		partInstances: DBPartInstance[],
		groupedPieceInstances: Map<PartInstanceId, PieceInstance[]>
	) {
		const allPartInstances: PlayoutPartInstanceModelImpl[] = []
		for (const partInstance of partInstances) {
			const wrappedPartInstance = new PlayoutPartInstanceModelImpl(
				partInstance,
				groupedPieceInstances.get(partInstance._id) ?? [],
				false,
				this.quickLoopService
			)
			allPartInstances.push(wrappedPartInstance)
		}

		return allPartInstances
	}

	public get olderPartInstances(): PlayoutPartInstanceModel[] {
		const allPartInstances = this.loadedPartInstances

		const ignoreIds = new Set(this.selectedPartInstanceIds)

		return allPartInstances.filter((partInstance) => !ignoreIds.has(partInstance.partInstance._id))
	}
	public get previousPartInstance(): PlayoutPartInstanceModel | null {
		if (!this.playlist.previousPartInfo?.partInstanceId) return null
		const partInstance = this.allPartInstances.get(this.playlist.previousPartInfo.partInstanceId)
		if (!partInstance) return null // throw new Error('PreviousPartInstance is missing')
		return partInstance
	}
	public get currentPartInstance(): PlayoutPartInstanceModel | null {
		if (!this.playlist.currentPartInfo?.partInstanceId) return null
		const partInstance = this.allPartInstances.get(this.playlist.currentPartInfo.partInstanceId)
		if (!partInstance) return null // throw new Error('CurrentPartInstance is missing')
		return partInstance
	}
	public get nextPartInstance(): PlayoutPartInstanceModel | null {
		if (!this.playlist.nextPartInfo?.partInstanceId) return null
		const partInstance = this.allPartInstances.get(this.playlist.nextPartInfo.partInstanceId)
		if (!partInstance) return null // throw new Error('NextPartInstance is missing')
		return partInstance
	}

	public get selectedPartInstanceIds(): PartInstanceId[] {
		return _.compact([
			this.playlist.previousPartInfo?.partInstanceId,
			this.playlist.currentPartInfo?.partInstanceId,
			this.playlist.nextPartInfo?.partInstanceId,
		])
	}

	public get selectedPartInstances(): PlayoutPartInstanceModel[] {
		return _.compact([this.currentPartInstance, this.previousPartInstance, this.nextPartInstance])
	}

	public get loadedPartInstances(): PlayoutPartInstanceModel[] {
		return Array.from(this.allPartInstances.values()).filter((v): v is PlayoutPartInstanceModelImpl => v !== null)
	}

	public get sortedLoadedPartInstances(): PlayoutPartInstanceModel[] {
		const allInstances = this.loadedPartInstances
		allInstances.sort((a, b) => a.partInstance.takeCount - b.partInstance.takeCount)

		return allInstances
	}

	public getPartInstance(partInstanceId: PartInstanceId): PlayoutPartInstanceModel | undefined {
		return this.allPartInstances.get(partInstanceId) ?? undefined
	}

	/**
	 * Search for a Part through the whole Playlist
	 * @param id
	 */
	findPart(id: PartId): ReadonlyDeep<DBPart> | undefined {
		for (const rundown of this.rundowns) {
			for (const segment of rundown.segments) {
				const part = segment.getPart(id)
				if (part) return part
			}
		}

		return undefined
	}
	getAllOrderedParts(): ReadonlyDeep<DBPart>[] {
		return this.rundowns.flatMap((rundown) => rundown.getAllOrderedParts())
	}

	findSegment(id: SegmentId): ReadonlyDeep<PlayoutSegmentModel> | undefined {
		for (const rundown of this.rundowns) {
			const segment = rundown.getSegment(id)
			if (segment) return segment
		}

		return undefined
	}
	getAllOrderedSegments(): ReadonlyDeep<PlayoutSegmentModel>[] {
		return this.rundowns.flatMap((rundown) => rundown.segments)
	}

	getRundown(id: RundownId): PlayoutRundownModel | undefined {
		return this.rundowns.find((rundown) => rundown.rundown._id === id)
	}
	getRundownIds(): RundownId[] {
		return sortRundownIDsInPlaylist(
			this.playlist.rundownIdsInOrder,
			this.rundowns.map((rd) => rd.rundown._id)
		)
	}

	findPieceInstance(
		id: PieceInstanceId
	): { partInstance: PlayoutPartInstanceModel; pieceInstance: PlayoutPieceInstanceModel } | undefined {
		for (const partInstance of this.loadedPartInstances) {
			const pieceInstance = partInstance.getPieceInstance(id)
			if (pieceInstance) return { partInstance, pieceInstance }
		}

		return undefined
	}

	getSegmentsBetweenQuickLoopMarker(start: QuickLoopMarker, end: QuickLoopMarker): SegmentId[] {
		return this.quickLoopService.getSegmentsBetweenMarkers(start, end)
	}
	getPartsBetweenQuickLoopMarker(
		start: QuickLoopMarker,
		end: QuickLoopMarker
	): { parts: PartId[]; segments: SegmentId[] } {
		return this.quickLoopService.getPartsBetweenMarkers(start, end)
	}

	#isMultiGatewayMode: boolean | undefined = undefined
	public get isMultiGatewayMode(): boolean {
		if (this.#isMultiGatewayMode === undefined) {
			if (this.context.studio.settings.forceMultiGatewayMode) {
				this.#isMultiGatewayMode = true
			} else {
				const playoutDevices = this.peripheralDevices.filter(
					(device) => device.type === PeripheralDeviceType.PLAYOUT
				)
				this.#isMultiGatewayMode = playoutDevices.length > 1
			}
		}
		return this.#isMultiGatewayMode
	}

	public get multiGatewayNowSafeLatency(): number | undefined {
		return this.context.studio.settings.multiGatewayNowSafeLatency
	}

	/**
	 * Calculate an offset to apply to the 'now' value, to compensate for delay in playout-gateway
	 * The intention is that any concrete value used instead of 'now' should still be just in the future for playout-gateway
	 */
	protected getNowOffsetLatency(): number | undefined {
		/** The timestamp that "now" was set to */
		let nowOffsetLatency: number | undefined

		if (this.isMultiGatewayMode) {
			const playoutDevices = this.peripheralDevices.filter(
				(device) => device.type === PeripheralDeviceType.PLAYOUT
			)
			const worstLatency = Math.max(0, ...playoutDevices.map((device) => getExpectedLatency(device).safe))
			/** Add a little more latency, to account for network latency variability */
			const ADD_SAFE_LATENCY = this.multiGatewayNowSafeLatency || 30
			nowOffsetLatency = worstLatency + ADD_SAFE_LATENCY
		}

		return nowOffsetLatency
	}
}

/**
 * This is a model used for playout operations.
 * It contains everything that is needed to generate the timeline, and everything except for pieces needed to update the partinstances.
 * Anything not in this model should not be needed often, and only for specific operations (eg, AdlibActions needed to run one).
 */
export class PlayoutModelImpl extends PlayoutModelReadonlyImpl implements PlayoutModel, DatabasePersistedModel {
	readonly #baselineHelper: StudioBaselineHelper
	readonly #notificationsHelper: NotificationsModelHelper

	#deferredBeforeSaveFunctions: DeferredFunction[] = []
	#deferredAfterSaveFunctions: DeferredAfterSaveFunction[] = []
	#disposed = false

	#playlistHasChanged = false
	#timelineHasChanged = false

	#pendingPartInstanceTimingEvents = new Set<PartInstanceId>()

	get hackDeletedPartInstanceIds(): PartInstanceId[] {
		const result: PartInstanceId[] = []
		for (const [id, doc] of this.allPartInstances) {
			if (!doc) result.push(id)
		}
		return result
	}

	public constructor(
		context: JobContext,
		playlistLock: PlaylistLock,
		playlistId: RundownPlaylistId,
		peripheralDevices: ReadonlyDeep<PeripheralDevice[]>,
		playlist: DBRundownPlaylist,
		partInstances: DBPartInstance[],
		groupedPieceInstances: Map<PartInstanceId, PieceInstance[]>,
		rundowns: PlayoutRundownModelImpl[],
		timeline: TimelineComplete | undefined
	) {
		super(
			context,
			playlistLock,
			playlistId,
			peripheralDevices,
			playlist,
			partInstances,
			groupedPieceInstances,
			rundowns,
			timeline
		)
		context.trackCache(this)

		this.#baselineHelper = new StudioBaselineHelper(context)
		this.#notificationsHelper = new NotificationsModelHelper(context, `playout:${playlist._id}`, playlistId)
	}

	public get displayName(): string {
		return `PlayoutModel "${this.playlistId}"`
	}

	activatePlaylist(rehearsal: boolean): RundownPlaylistActivationId {
		this.playlistImpl.activationId = getRandomId()
		this.playlistImpl.rehearsal = rehearsal

		this.#playlistHasChanged = true

		return this.playlistImpl.activationId
	}

	clearSelectedPartInstances(): void {
		this.playlistImpl.currentPartInfo = null
		this.playlistImpl.nextPartInfo = null
		this.playlistImpl.previousPartInfo = null
		this.playlistImpl.holdState = RundownHoldState.NONE

		delete this.playlistImpl.lastTakeTime
		delete this.playlistImpl.queuedSegmentId

		this.#playlistHasChanged = true
	}

	clearPreviousPartInstance(): void {
		this.playlistImpl.previousPartInfo = null

		// Make sure that a hold isn't running. We can't block it here, so abort it immediately instead
		this.playlistImpl.holdState = RundownHoldState.NONE

		this.#playlistHasChanged = true
	}

	calculatePartTimings(
		fromPartInstance: PlayoutPartInstanceModel | null,
		toPartInstance: PlayoutPartInstanceModel,
		toPieceInstances: PieceInstanceWithTimings[]
	): PartCalculatedTimings {
		return calculatePartTimings(
			this.playlist.holdState,
			fromPartInstance?.getPartInstanceWithQuickLoopOverrides()?.part,
			fromPartInstance?.pieceInstances.map((p) => p.pieceInstance.piece) ?? [],
			toPartInstance?.getPartInstanceWithQuickLoopOverrides()?.part,
			toPieceInstances.filter((p) => !p.infinite || p.infinite.infiniteInstanceIndex === 0).map((p) => p.piece)
		)
	}

	#fixupPieceInstancesForPartInstance(partInstance: DBPartInstance, pieceInstances: PieceInstance[]): void {
		for (const pieceInstance of pieceInstances) {
			// Future: should these be PieceInstance already, or should that be handled here?
			pieceInstance._id = getPieceInstanceIdForPiece(partInstance._id, pieceInstance.piece._id)
			pieceInstance.partInstanceId = partInstance._id
		}
	}

	createAdlibbedPartInstance(
		part: Omit<DBPart, 'segmentId' | 'rundownId'>,
		pieces: Omit<PieceInstancePiece, 'startPartId'>[],
		fromAdlibId: PieceId | undefined,
		infinitePieceInstances: PieceInstance[]
	): PlayoutPartInstanceModel {
		const currentPartInstance = this.currentPartInstance
		if (!currentPartInstance) throw new Error('No currentPartInstance')

		const newPartInstance: DBPartInstance = {
			_id: getRandomId(),
			rundownId: currentPartInstance.partInstance.rundownId,
			segmentId: currentPartInstance.partInstance.segmentId,
			playlistActivationId: currentPartInstance.partInstance.playlistActivationId,
			segmentPlayoutId: currentPartInstance.partInstance.segmentPlayoutId,
			takeCount: currentPartInstance.partInstance.takeCount + 1,
			rehearsal: currentPartInstance.partInstance.rehearsal,
			orphaned: 'adlib-part',
			part: {
				...part,
				rundownId: currentPartInstance.partInstance.rundownId,
				segmentId: currentPartInstance.partInstance.segmentId,
			},
		}

		this.#fixupPieceInstancesForPartInstance(newPartInstance, infinitePieceInstances)

		const partInstance = new PlayoutPartInstanceModelImpl(
			newPartInstance,
			infinitePieceInstances,
			true,
			this.quickLoopService
		)

		for (const piece of pieces) {
			partInstance.insertAdlibbedPiece(piece, fromAdlibId)
		}

		partInstance.recalculateExpectedDurationWithTransition()

		this.allPartInstances.set(newPartInstance._id, partInstance)

		return partInstance
	}

	createInstanceForPart(nextPart: ReadonlyDeep<DBPart>, pieceInstances: PieceInstance[]): PlayoutPartInstanceModel {
		const playlistActivationId = this.playlist.activationId
		if (!playlistActivationId) throw new Error(`Playlist is not active`)

		const currentPartInstance = this.currentPartInstance

		const newTakeCount = currentPartInstance ? currentPartInstance.partInstance.takeCount + 1 : 0 // Increment
		const segmentPlayoutId: SegmentPlayoutId =
			currentPartInstance && nextPart.segmentId === currentPartInstance.partInstance.segmentId
				? currentPartInstance.partInstance.segmentPlayoutId
				: getRandomId()

		const newPartInstance: DBPartInstance = {
			_id: protectString<PartInstanceId>(`${nextPart._id}_${getRandomId()}`),
			rundownId: nextPart.rundownId,
			segmentId: nextPart.segmentId,
			playlistActivationId: playlistActivationId,
			segmentPlayoutId,
			takeCount: newTakeCount,
			rehearsal: !!this.playlist.rehearsal,
			part: clone<DBPart>(nextPart),
			timings: {
				setAsNext: getCurrentTime(),
			},
		}

		this.#fixupPieceInstancesForPartInstance(newPartInstance, pieceInstances)

		const partInstance = new PlayoutPartInstanceModelImpl(
			newPartInstance,
			pieceInstances,
			true,
			this.quickLoopService
		)
		partInstance.recalculateExpectedDurationWithTransition()

		this.allPartInstances.set(newPartInstance._id, partInstance)

		return partInstance
	}

	createAdlibTestingPartInstance(
		rundown: PlayoutRundownModel,
		part: Omit<DBPart, 'segmentId' | 'rundownId'>
	): PlayoutPartInstanceModel {
		const currentPartInstance = this.currentPartInstance
		if (currentPartInstance) throw new Error('AdlibTesting can only be used before the first take')

		const adlibTestingSegment = rundown.getAdlibTestingSegment()
		if (!adlibTestingSegment) throw new Error('No AdlibTesting segment')
		if (this.loadedPartInstances.find((p) => p.partInstance.segmentId === adlibTestingSegment.segment._id))
			throw new Error('AdlibTesting segment already has content')

		const activationId = this.playlist.activationId
		if (!activationId) throw new Error('Playlist is not active')

		const newPartInstance: DBPartInstance = {
			_id: getRandomId(),
			rundownId: rundown.rundown._id,
			segmentId: adlibTestingSegment.segment._id,
			playlistActivationId: activationId,
			segmentPlayoutId: getRandomId(),
			takeCount: 1,
			rehearsal: !!this.playlist.rehearsal,
			orphaned: 'adlib-part',
			part: {
				...part,
				rundownId: rundown.rundown._id,
				segmentId: adlibTestingSegment.segment._id,
			},
		}

		const partInstance = new PlayoutPartInstanceModelImpl(newPartInstance, [], true, this.quickLoopService)
		partInstance.recalculateExpectedDurationWithTransition()

		this.allPartInstances.set(newPartInstance._id, partInstance)

		return partInstance
	}

	switchRouteSet(routeSetId: string, isActive: boolean | 'toggle'): boolean {
		return this.context.setRouteSetActive(routeSetId, isActive)
	}

	cycleSelectedPartInstances(): void {
		this.playlistImpl.previousPartInfo = this.playlistImpl.currentPartInfo
		this.playlistImpl.currentPartInfo = this.playlistImpl.nextPartInfo
		this.playlistImpl.nextPartInfo = null
		this.playlistImpl.lastTakeTime = getCurrentTime()

		this.#playlistHasChanged = true
	}

	resetHoldState(): void {
		this.setHoldState(RundownHoldState.NONE)
	}

	deactivatePlaylist(): void {
		delete this.playlistImpl.activationId

		if (this.currentPartInstance) {
			this.currentPartInstance.setReportedStoppedPlaybackWithPieceInstances(getCurrentTime())
			this.queuePartInstanceTimingEvent(this.currentPartInstance.partInstance._id)
		}

		this.clearSelectedPartInstances()
		this.playlistImpl.quickLoop = this.quickLoopService.getUpdatedPropsByClearingMarkers()

		this.#playlistHasChanged = true
	}

	queuePartInstanceTimingEvent(partInstanceId: PartInstanceId): void {
		this.#pendingPartInstanceTimingEvents.add(partInstanceId)
	}

	removeAllRehearsalPartInstances(): void {
		const partInstancesToRemove: PartInstanceId[] = []

		for (const [id, partInstance] of this.allPartInstances.entries()) {
			if (partInstance?.partInstance.rehearsal) {
				this.allPartInstances.set(id, null)
				partInstancesToRemove.push(id)
			}
		}

		// Defer ones which arent loaded
		this.deferAfterSave(async (playoutModel) => {
			const rundownIds = playoutModel.getRundownIds()
			// We need to keep any for PartInstances which are still existent in the model (as they werent removed)
			const partInstanceIdsInModel = playoutModel.loadedPartInstances.map((p) => p.partInstance._id)

			// Find all the partInstances which are not loaded, but should be removed
			const removeFromDb = await this.context.directCollections.PartInstances.findFetch(
				{
					// Not any which are in the model, as they have already been done if needed
					_id: { $nin: partInstanceIdsInModel },
					rundownId: { $in: rundownIds },
					rehearsal: true,
				},
				{ projection: { _id: 1 } }
			).then((ps) => ps.map((p) => p._id))

			// Do the remove
			const allToRemove = [...removeFromDb, ...partInstancesToRemove]
			await Promise.all([
				removeFromDb.length > 0
					? this.context.directCollections.PartInstances.remove({
							_id: { $in: removeFromDb },
							rundownId: { $in: rundownIds },
						})
					: undefined,
				allToRemove.length > 0
					? this.context.directCollections.PieceInstances.remove({
							partInstanceId: { $in: allToRemove },
							rundownId: { $in: rundownIds },
						})
					: undefined,
				allToRemove.length > 0
					? this.context.directCollections.Notifications.remove({
							'relatedTo.studioId': this.context.studioId,
							'relatedTo.rundownId': { $in: rundownIds },
							'relatedTo.partInstanceId': { $in: allToRemove },
						})
					: undefined,
			])
		})
	}

	removeUntakenPartInstances(): void {
		const removedPartInstanceIds: PartInstanceId[] = []

		for (const partInstance of this.olderPartInstances) {
			if (!partInstance.partInstance.isTaken) {
				this.allPartInstances.set(partInstance.partInstance._id, null)
				removedPartInstanceIds.push(partInstance.partInstance._id)
			}
		}

		// Ensure there are no notifications left for these partInstances
		if (removedPartInstanceIds.length > 0) {
			this.deferAfterSave(async (playoutModel) => {
				const rundownIds = playoutModel.getRundownIds()

				await this.context.directCollections.Notifications.remove({
					'relatedTo.studioId': this.context.studioId,
					'relatedTo.rundownId': { $in: rundownIds },
					'relatedTo.partInstanceId': { $in: removedPartInstanceIds },
				})
			})
		}
	}

	/**
	 * Reset the playlist for playout
	 */
	resetPlaylist(regenerateActivationId: boolean): void {
		this.playlistImpl.previousPartInfo = null
		this.playlistImpl.currentPartInfo = null
		this.playlistImpl.nextPartInfo = null
		this.playlistImpl.holdState = RundownHoldState.NONE
		this.playlistImpl.resetTime = getCurrentTime()

		delete this.playlistImpl.lastTakeTime
		delete this.playlistImpl.startedPlayback
		delete this.playlistImpl.rundownsStartedPlayback
		delete this.playlistImpl.segmentsStartedPlayback
		delete this.playlistImpl.previousPersistentState
		delete this.playlistImpl.trackedAbSessions
		delete this.playlistImpl.queuedSegmentId

		if (regenerateActivationId) this.playlistImpl.activationId = getRandomId()

		// reset quickloop if applicable:
		if (this.playlist.quickLoop && !this.playlist.quickLoop.locked) {
			this.setQuickLoopMarker('start', null)
			this.setQuickLoopMarker('end', null)
		}

		this.#playlistHasChanged = true
	}

	async saveAllToDatabase(): Promise<void> {
		if (this.#disposed) {
			throw new Error('Cannot save disposed PlayoutModel')
		}

		// TODO - ideally we should make sure to preserve the lock during this operation
		if (!this.playlistLock.isLocked) {
			throw new Error('Cannot save changes with released playlist lock')
		}

		const span = this.context.startSpan('PlayoutModelImpl.saveAllToDatabase')

		// Execute deferBeforeSave()'s
		for (const fn of this.#deferredBeforeSaveFunctions) {
			await fn(this as any)
		}
		this.#deferredBeforeSaveFunctions.length = 0 // clear the array

		// Prioritise the timeline for publication reasons
		if (this.#timelineHasChanged && this.timelineImpl) {
			await this.context.directCollections.Timelines.replace(this.timelineImpl)
			if (!process.env.JEST_WORKER_ID) {
				// Wait a little bit before saving the rest.
				// The idea is that this allows for the high priority publications to update (such as the Timeline),
				// sending the updated timeline to Playout-gateway
				await sleep(2)
			}
		}
		this.#timelineHasChanged = false

		const partInstancesByRundownId = groupByToMapFunc(
			Array.from(this.allPartInstances.values()).filter((p) => !!p),
			(p) => p.partInstance.rundownId
		)

		await Promise.all([
			this.#playlistHasChanged
				? this.context.directCollections.RundownPlaylists.replace(this.playlistImpl)
				: undefined,
			...writePartInstancesAndPieceInstances(this.context, this.allPartInstances),
			writeAdlibTestingSegments(this.context, this.rundownsImpl),
			...Array.from(partInstancesByRundownId.entries()).map(async ([rundownId, partInstances]) =>
				writeExpectedPackagesForPlayoutSources(this.context, this.playlistId, rundownId, partInstances)
			),
			this.#baselineHelper.saveAllToDatabase(),
			this.#notificationsHelper.saveAllToDatabase(),
			this.context.saveRouteSetChanges(),
		])

		// Clean up deleted partInstances, since they have now been deleted by writePartInstancesAndPieceInstances
		for (const [partInstanceId, partInstance] of this.allPartInstances) {
			if (partInstance !== null) continue
			this.allPartInstances.delete(partInstanceId)
		}

		this.#playlistHasChanged = false

		// Execute deferAfterSave()'s
		for (const fn of this.#deferredAfterSaveFunctions) {
			await fn(this as any)
		}
		this.#deferredAfterSaveFunctions.length = 0 // clear the array

		for (const partInstanceId of this.#pendingPartInstanceTimingEvents) {
			// Run in the background, we don't want to hold onto the lock to do this
			queuePartInstanceTimingEvent(this.context, this.playlistId, partInstanceId)
		}
		this.#pendingPartInstanceTimingEvents.clear()

		if (span) span.end()
	}

	setHoldState(newState: RundownHoldState): void {
		this.playlistImpl.holdState = newState

		this.#playlistHasChanged = true
	}

	setAbResolvingState(
		assignedAbSessions: Record<string, ABSessionAssignments>,
		trackedAbSessions: ABSessionInfo[]
	): void {
		this.playlistImpl.assignedAbSessions = assignedAbSessions
		this.playlistImpl.trackedAbSessions = trackedAbSessions

		this.#playlistHasChanged = true
	}

	setBlueprintPersistentState(persistentState: unknown | undefined): void {
		this.playlistImpl.previousPersistentState = persistentState

		this.#playlistHasChanged = true
	}

	setPartInstanceAsNext(
		partInstance: PlayoutPartInstanceModel | null,
		setManually: boolean,
		consumesQueuedSegmentId: boolean,
		nextTimeOffset?: number
	): void {
		if (partInstance) {
			const storedPartInstance = this.allPartInstances.get(partInstance.partInstance._id)
			if (!storedPartInstance) throw new Error(`PartInstance being set as next was not constructed correctly`)
			// Make sure we were given the exact same object
			if (storedPartInstance !== partInstance) throw new Error(`PartInstance being set as next is not current`)
		}

		if (partInstance) {
			this.playlistImpl.nextPartInfo = literal<SelectedPartInstance>({
				partInstanceId: partInstance.partInstance._id,
				rundownId: partInstance.partInstance.rundownId,
				manuallySelected: !!(setManually || partInstance.partInstance.orphaned),
				consumesQueuedSegmentId,
			})
			this.playlistImpl.nextTimeOffset = nextTimeOffset || null
		} else {
			this.playlistImpl.nextPartInfo = null
			this.playlistImpl.nextTimeOffset = null
		}

		this.#playlistHasChanged = true
	}

	setQueuedSegment(segment: PlayoutSegmentModel | null): void {
		this.playlistImpl.queuedSegmentId = segment?.segment?._id ?? undefined

		this.#playlistHasChanged = true
	}

	setRundownStartedPlayback(rundownId: RundownId, timestamp: number): void {
		if (!this.playlistImpl.rundownsStartedPlayback) {
			this.playlistImpl.rundownsStartedPlayback = {}
		}

		// If the partInstance is "untimed", it will not update the playlist's startedPlayback and will not count time in the GUI:
		const rundownIdStr = unprotectString(rundownId)
		if (!this.playlistImpl.rundownsStartedPlayback[rundownIdStr]) {
			this.playlistImpl.rundownsStartedPlayback[rundownIdStr] = timestamp
		}

		if (!this.playlistImpl.startedPlayback) {
			this.playlistImpl.startedPlayback = timestamp
		}

		this.#playlistHasChanged = true
	}

	setSegmentStartedPlayback(segmentPlayoutId: SegmentPlayoutId, timestamp: number): void {
		const segmentPlayoutIdsToKeep: string[] = []
		if (this.previousPartInstance) {
			segmentPlayoutIdsToKeep.push(unprotectString(this.previousPartInstance.partInstance.segmentPlayoutId))
		}
		if (this.currentPartInstance) {
			segmentPlayoutIdsToKeep.push(unprotectString(this.currentPartInstance.partInstance.segmentPlayoutId))
		}

		this.playlistImpl.segmentsStartedPlayback = this.playlistImpl.segmentsStartedPlayback
			? _.pick(this.playlistImpl.segmentsStartedPlayback, segmentPlayoutIdsToKeep)
			: {}

		const segmentPlayoutIdStr = unprotectString(segmentPlayoutId)
		this.playlistImpl.segmentsStartedPlayback[segmentPlayoutIdStr] = timestamp
		this.#playlistHasChanged = true
	}

	setTimeline(
		timelineObjs: TimelineObjGeneric[],
		generationVersions: TimelineCompleteGenerationVersions,
		regenerateTimelineToken: string | undefined
	): ReadonlyDeep<TimelineComplete> {
		this.timelineImpl = {
			_id: this.context.studioId,
			timelineHash: getRandomId(), // randomized on every timeline change
			generated: getCurrentTime(),
			timelineBlob: serializeTimelineBlob(timelineObjs),
			generationVersions: generationVersions,
			regenerateTimelineToken: regenerateTimelineToken,
		}
		this.#timelineHasChanged = true

		return this.timelineImpl
	}

	setExpectedPackagesForStudioBaseline(packages: ExpectedPackage.Any[]): void {
		this.#baselineHelper.setExpectedPackages(packages)
	}
	setExpectedPlayoutItemsForStudioBaseline(playoutItems: ExpectedPlayoutItemStudio[]): void {
		this.#baselineHelper.setExpectedPlayoutItems(playoutItems)
	}

	setQuickLoopMarker(type: 'start' | 'end', marker: QuickLoopMarker | null): void {
		this.playlistImpl.quickLoop = this.quickLoopService.getUpdatedPropsBySettingAMarker(type, marker)
		this.playlistImpl.quickLoop = this.quickLoopService.getUpdatedProps(type)
		this.#playlistHasChanged = true
	}

	updateQuickLoopState(): void {
		this.playlistImpl.quickLoop = this.quickLoopService.getUpdatedProps()
		this.#playlistHasChanged = true
	}

	#lastMonotonicNowInPlayout = getCurrentTime()
	getNowInPlayout(): number {
		const nowOffsetLatency = this.getNowOffsetLatency() ?? 0
		const targetNowTime = getCurrentTime() + nowOffsetLatency
		const result = Math.max(this.#lastMonotonicNowInPlayout, targetNowTime)
		this.#lastMonotonicNowInPlayout = result
		return result
	}

	/** Notifications */

	async getAllNotifications(
		...args: Parameters<NotificationsModelHelper['getAllNotifications']>
	): ReturnType<NotificationsModelHelper['getAllNotifications']> {
		return this.#notificationsHelper.getAllNotifications(...args)
	}
	clearNotification(
		...args: Parameters<NotificationsModelHelper['clearNotification']>
	): ReturnType<NotificationsModelHelper['clearNotification']> {
		return this.#notificationsHelper.clearNotification(...args)
	}
	setNotification(
		...args: Parameters<NotificationsModelHelper['setNotification']>
	): ReturnType<NotificationsModelHelper['setNotification']> {
		return this.#notificationsHelper.setNotification(...args)
	}
	clearAllNotifications(
		...args: Parameters<NotificationsModelHelper['clearAllNotifications']>
	): ReturnType<NotificationsModelHelper['clearAllNotifications']> {
		return this.#notificationsHelper.clearAllNotifications(...args)
	}

	/** Lifecycle */

	/** @deprecated */
	deferBeforeSave(fcn: DeferredFunction): void {
		this.#deferredBeforeSaveFunctions.push(fcn)
	}
	/** @deprecated */
	deferAfterSave(fcn: DeferredAfterSaveFunction): void {
		this.#deferredAfterSaveFunctions.push(fcn)
	}

	/** BaseModel */

	/**
	 * Assert that no changes should have been made to the model, will throw an Error otherwise. This can be used in
	 * place of `saveAllToDatabase()`, when the code controlling the model expects no changes to have been made and any
	 * changes made are an error and will cause issues.
	 */
	assertNoChanges(): void {
		const span = this.context.startSpan('PlayoutModelImpl.assertNoChanges')

		function logOrThrowError(error: Error) {
			if (!IS_PRODUCTION) {
				throw error
			} else {
				logger.error(error)
			}
		}

		if (this.#deferredBeforeSaveFunctions.length > 0)
			logOrThrowError(
				new Error(
					`Failed no changes in model assertion, there were ${
						this.#deferredBeforeSaveFunctions.length
					} deferred functions`
				)
			)

		if (this.#deferredAfterSaveFunctions.length > 0)
			logOrThrowError(
				new Error(
					`Failed no changes in model assertion, there were ${
						this.#deferredAfterSaveFunctions.length
					} after-save deferred functions`
				)
			)

		if (this.#timelineHasChanged)
			logOrThrowError(new Error(`Failed no changes in model assertion, Timeline has been changed`))

		if (this.#playlistHasChanged)
			logOrThrowError(new Error(`Failed no changes in model assertion, Playlist has been changed`))

		if (this.rundownsImpl.find((rd) => rd.AdlibTestingSegmentHasChanged))
			logOrThrowError(new Error(`Failed no changes in model assertion, an AdlibTesting Segment has been changed`))

		const changedPartInstances = Array.from(this.allPartInstances.entries()).filter(
			([_, partInstance]) =>
				!partInstance ||
				partInstance.partInstanceHasChanges ||
				partInstance.changedPieceInstanceIds().length > 0
		)

		if (changedPartInstances.length > 0) {
			logOrThrowError(
				new Error(
					`Failed no changes in model assertion, PartInstances has been changed: ${JSON.stringify(
						changedPartInstances.map(
							([id, pi]) =>
								`${id}: ` +
								(!pi
									? 'null'
									: `partInstanceHasChanges: ${
											pi.partInstanceHasChanges
										}, changedPieceInstanceIds: ${JSON.stringify(pi.changedPieceInstanceIds())}`)
						)
					)}`
				)
			)
		}

		if (span) span.end()
	}

	/**
	 * Discards all documents in this model, and marks it as unusable
	 */
	dispose(): void {
		this.#disposed = true

		// Discard any hooks too
		this.#deferredAfterSaveFunctions.length = 0
		this.#deferredBeforeSaveFunctions.length = 0
	}
}
