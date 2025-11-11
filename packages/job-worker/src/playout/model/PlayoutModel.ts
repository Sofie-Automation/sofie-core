import {
	BucketAdLibId,
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
import { BaseModel } from '../../modelBase.js'
import {
	ABSessionAssignments,
	ABSessionInfo,
	DBRundownPlaylist,
	QuickLoopMarker,
	RundownHoldState,
} from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { ReadonlyDeep } from 'type-fest'
import { StudioPlayoutModelBase, StudioPlayoutModelBaseReadonly } from '../../studio/model/StudioPlayoutModel.js'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { PieceInstance, PieceInstancePiece } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { PlaylistLock } from '../../jobs/lock.js'
import { PlayoutRundownModel } from './PlayoutRundownModel.js'
import { PlayoutSegmentModel } from './PlayoutSegmentModel.js'
import { PlayoutPartInstanceModel } from './PlayoutPartInstanceModel.js'
import { PeripheralDevice } from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { PlayoutPieceInstanceModel } from './PlayoutPieceInstanceModel.js'
import { PieceInstanceWithTimings } from '@sofie-automation/corelib/dist/playout/processAndPrune'
import { PartCalculatedTimings } from '@sofie-automation/corelib/dist/playout/timings'
import type { INotificationsModel } from '../../notifications/NotificationsModel.js'

export type DeferredFunction = (playoutModel: PlayoutModel) => void | Promise<void>
export type DeferredAfterSaveFunction = (playoutModel: PlayoutModelReadonly) => void | Promise<void>

/**
 * A lightweight version of the `PlayoutModel`, used to perform some pre-checks before loading the full model
 *
 * This represents a `RundownPlaylist` in a `Studio`, in a minimal readonly fashion
 */
export interface PlayoutModelPreInit {
	/**
	 * The Id of the RundownPlaylist this PlayoutModel operates for
	 */
	readonly playlistId: RundownPlaylistId
	/**
	 * Reference to the lock for the RundownPlaylist
	 */
	readonly playlistLock: PlaylistLock

	/**
	 * All of the PeripheralDevices that belong to the Studio of this RundownPlaylist
	 */
	readonly peripheralDevices: ReadonlyDeep<PeripheralDevice[]>

	/**
	 * The RundownPlaylist this PlayoutModel operates for
	 */
	readonly playlist: ReadonlyDeep<DBRundownPlaylist>
	/**
	 * The unwrapped Rundowns in this RundownPlaylist, sorted in order specified by RundownPlaylist
	 */
	readonly rundowns: ReadonlyDeep<DBRundown[]>

	/**
	 * Get a Rundown which belongs to this RundownPlaylist
	 * @param id Id of the Rundown
	 */
	getRundown(id: RundownId): DBRundown | undefined
}

/**
 * A readonly version of the `PlayoutModel`
 *
 * This represents a `RundownPlaylist` and its content in a `Studio`, in a readonly fashion
 */
export interface PlayoutModelReadonly extends StudioPlayoutModelBaseReadonly {
	/**
	 * The Id of the RundownPlaylist this PlayoutModel operates for
	 */
	readonly playlistId: RundownPlaylistId
	/**
	 * Reference to the lock for the RundownPlaylist
	 */
	readonly playlistLock: PlaylistLock

	/**
	 * The RundownPlaylist this PlayoutModel operates for
	 */
	get playlist(): ReadonlyDeep<DBRundownPlaylist>
	/**
	 * The Rundowns in this RundownPlaylist
	 */
	get rundowns(): readonly PlayoutRundownModel[]

	/**
	 * All of the loaded PartInstances which are not one of the Previous, Current or Next
	 * This may or may not contain all PartInstances from the RundownPlaylist, depending on implementation.
	 * At a minimum it will contain all PartInstances from the Segments of the previous, current and next PartInstances
	 */
	get olderPartInstances(): PlayoutPartInstanceModel[]
	/**
	 * The PartInstance previously played, if any
	 */
	get previousPartInstance(): PlayoutPartInstanceModel | null
	/**
	 * The PartInstance currently being played, if any
	 */
	get currentPartInstance(): PlayoutPartInstanceModel | null
	/**
	 * The PartInstance which is next to be played, if any
	 */
	get nextPartInstance(): PlayoutPartInstanceModel | null
	/**
	 * Ids of the previous, current and next PartInstances
	 */
	get selectedPartInstanceIds(): PartInstanceId[]
	/**
	 * The previous, current and next PartInstances
	 */
	get selectedPartInstances(): PlayoutPartInstanceModel[]
	/**
	 * All of the loaded PartInstances
	 * This may or may not contain all PartInstances from the RundownPlaylist, depending on implementation.
	 * At a minimum it will contain all PartInstances from the Segments of the previous, current and next PartInstances
	 */
	get loadedPartInstances(): PlayoutPartInstanceModel[]
	/**
	 * All of the loaded PartInstances, sorted by order of playback
	 */
	get sortedLoadedPartInstances(): PlayoutPartInstanceModel[]
	/**
	 * Get a PartInstance which belongs to this RundownPlaylist
	 * @param id Id of the PartInstance
	 */
	getPartInstance(partInstanceId: PartInstanceId): PlayoutPartInstanceModel | undefined

	/**
	 * Search for a Part through the whole RundownPlaylist
	 * @param id Id of the Part
	 */
	findPart(id: PartId): ReadonlyDeep<DBPart> | undefined
	/**
	 * Collect all Parts in the RundownPlaylist, and return them sorted by the Segment and Part ranks
	 */
	getAllOrderedParts(): ReadonlyDeep<DBPart>[]

	/**
	 * Search for a Segment through the whole RundownPlaylist
	 * @param id Id of the Segment
	 */
	findSegment(id: SegmentId): ReadonlyDeep<PlayoutSegmentModel> | undefined
	/**
	 * Collect all Segments in the RundownPlaylist, and return them sorted by their ranks
	 */
	getAllOrderedSegments(): ReadonlyDeep<PlayoutSegmentModel>[]

	/**
	 * Get a Rundown which belongs to this RundownPlaylist
	 * @param id Id of the Rundown
	 */
	getRundown(id: RundownId): PlayoutRundownModel | undefined
	/**
	 * Get the Ids of the Rundowns in this RundownPlaylist
	 */
	getRundownIds(): RundownId[]

	/**
	 * Returns any segmentId's that are found between 2 quickloop markers, none will be returned if
	 * the end is before the start.
	 * @param start A quickloop marker
	 * @param end A quickloop marker
	 */
	getSegmentsBetweenQuickLoopMarker(start: QuickLoopMarker, end: QuickLoopMarker): SegmentId[]

	/**
	 * Returns any segmentId's that are found between 2 quickloop markers, none will be returned if
	 * the end is before the start.
	 * @param start A quickloop marker
	 * @param end A quickloop marker
	 */
	getPartsBetweenQuickLoopMarker(
		start: QuickLoopMarker,
		end: QuickLoopMarker
	): { parts: PartId[]; segments: SegmentId[] }

	/**
	 * Search for a PieceInstance in the RundownPlaylist
	 * @param id Id of the PieceInstance
	 * @returns The found PieceInstance and its parent PartInstance
	 */
	findPieceInstance(
		id: PieceInstanceId
	): { partInstance: PlayoutPartInstanceModel; pieceInstance: PlayoutPieceInstanceModel } | undefined
}

/**
 * A view of a `RundownPlaylist` and its content in a `Studio`
 */
export interface PlayoutModel extends PlayoutModelReadonly, StudioPlayoutModelBase, BaseModel, INotificationsModel {
	/**
	 * Temporary hack for debug logging
	 */
	get hackDeletedPartInstanceIds(): PartInstanceId[]

	/**
	 * Set the RundownPlaylist as activated (or reactivate)
	 * @param rehearsal Whether to activate in rehearsal mode
	 * @returns Id of this activation
	 */
	activatePlaylist(rehearsal: boolean): RundownPlaylistActivationId

	/**
	 * Update the active state of a RouteSet
	 * @param routeSetId
	 * @param isActive
	 * @returns Whether the change may affect timeline generation
	 */
	switchRouteSet(routeSetId: string, isActive: boolean | 'toggle'): boolean

	/**
	 * Clear the currently selected PartInstances, so that nothing is selected for playback
	 */
	clearSelectedPartInstances(): void

	/**
	 * Clear the currently selected previousPartInstance.
	 * This can be useful if it references a Rundown that has been removed from the Playlist
	 */
	clearPreviousPartInstance(): void

	/**
	 * Insert an adlibbed PartInstance into the RundownPlaylist
	 * @param part Part to insert
	 * @param pieces Planned Pieces to insert into Part
	 * @param fromAdlibId Id of the source Adlib, if any
	 * @param infinitePieceInstances Infinite PieceInstances to be continued
	 * @returns The inserted PlayoutPartInstanceModel
	 */
	createAdlibbedPartInstance(
		part: Omit<DBPart, 'segmentId' | 'rundownId'>,
		pieces: Omit<PieceInstancePiece, 'startPartId'>[],
		fromAdlibId: PieceId | BucketAdLibId | undefined,
		infinitePieceInstances: PieceInstance[]
	): PlayoutPartInstanceModel

	/**
	 * Insert a planned PartInstance into the RundownPlaylist
	 * Future: This needs refactoring to take Pieces not PieceInstances
	 * @param nextPart Part to insert
	 * @param pieceInstances All the PieceInstances to insert
	 * @returns The inserted PlayoutPartInstanceModel
	 */
	createInstanceForPart(nextPart: ReadonlyDeep<DBPart>, pieceInstances: PieceInstance[]): PlayoutPartInstanceModel

	/**
	 * Insert an adlibbed PartInstance into the AdlibTesting Segment of a Rundown in this RundownPlaylist
	 * @param rundown Rundown to insert for
	 * @param part Part to insert
	 * @returns The inserted PlayoutPartInstanceModel
	 */
	createAdlibTestingPartInstance(
		rundown: PlayoutRundownModel,
		part: Omit<DBPart, 'segmentId' | 'rundownId'>
	): PlayoutPartInstanceModel

	/**
	 * Cycle the selected PartInstances
	 * The current will become the previous, the next will become the current, and there will be no next PartInstance.
	 */
	cycleSelectedPartInstances(): void

	/**
	 * Update loop markers anytime something significant occurs that could result in entering or exiting the mode.
	 */
	updateQuickLoopState(): void

	/*
	 * Reset the hold state to a base state
	 */
	resetHoldState(): void

	/**
	 * Set the RundownPlaylist as deactivated
	 */
	deactivatePlaylist(): void

	/**
	 * Queue a `PartInstanceTimingEvent` to be performed upon completion of this Playout operation
	 * @param partInstanceId Id of the PartInstance the event is in relation to
	 */
	queuePartInstanceTimingEvent(partInstanceId: PartInstanceId): void

	/**
	 * Remove all loaded PartInstances marked as `rehearsal` from this RundownPlaylist
	 */
	removeAllRehearsalPartInstances(): void

	/**
	 * Remove any untaken PartInstances from this RundownPlaylist
	 * This ignores any which are a selected PartInstance
	 */
	removeUntakenPartInstances(): void

	/**
	 * Reset the playlist for playout
	 */
	resetPlaylist(regenerateActivationId: boolean): void

	/**
	 * Update the HOLD state of the RundownPlaylist
	 * @param newState New HOLD state
	 */
	setHoldState(newState: RundownHoldState): void

	/**
	 * Store the persistent results of the AB playback resolving
	 * @param assignedAbSessions The applied AB sessions
	 * @param trackedAbSessions The known AB sessions
	 */
	setAbResolvingState(
		assignedAbSessions: Record<string, ABSessionAssignments>,
		trackedAbSessions: ABSessionInfo[]
	): void

	/**
	 * Store the blueprint persistent state
	 * @param persistentState Blueprint owned state
	 */
	setBlueprintPersistentState(persistentState: unknown | undefined): void

	/**
	 * Set a PartInstance as the nexted PartInstance
	 * @param partInstance PartInstance to be set as next, or none
	 * @param setManually Whether this was specified by the user
	 * @param consumesQueuedSegmentId Whether this consumes the `queuedSegment` property of the RundownPlaylist
	 * @param nextTimeOffset The time offset of the next line
	 */
	setPartInstanceAsNext(
		partInstance: PlayoutPartInstanceModel | null,
		setManually: boolean,
		consumesQueuedSegmentId: boolean,
		nextTimeOffset?: number
	): void

	/**
	 * Set a Segment as queued, indicating it should be played after the current Segment
	 * @param segment Segment to set as queued, or none
	 */
	setQueuedSegment(segment: PlayoutSegmentModel | null): void

	/**
	 * Track a Rundown as having started playback
	 * @param rundownId Id of the Rundown
	 * @param timestamp Timestamp playback started
	 */
	setRundownStartedPlayback(rundownId: RundownId, timestamp: number): void

	/**
	 * Track a Segment as having started playback
	 * @param segmentPlayoutId Playout id of the Segment
	 * @param timestamp Timestamp playback started
	 */
	setSegmentStartedPlayback(segmentPlayoutId: SegmentPlayoutId, timestamp: number): void

	/**
	 * Set or clear a QuickLoop Marker
	 * @param type
	 * @param marker
	 */
	setQuickLoopMarker(type: 'start' | 'end', marker: QuickLoopMarker | null): void

	calculatePartTimings(
		fromPartInstance: PlayoutPartInstanceModel | null,
		toPartInstance: PlayoutPartInstanceModel,
		toPieceInstances: PieceInstanceWithTimings[]
	): PartCalculatedTimings

	/** Lifecycle */

	/**
	 * @deprecated
	 * Defer some code to be run before the data is saved
	 */
	deferBeforeSave(fcn: DeferredFunction): void
	/**
	 * @deprecated
	 * Defer some code to be run after the data is saved
	 */
	deferAfterSave(fcn: DeferredAfterSaveFunction): void
}
