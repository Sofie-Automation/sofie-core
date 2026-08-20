import {
	BucketAdLibId,
	PieceId,
	PieceInstanceId,
	RundownPlaylistActivationId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ReadonlyDeep } from 'type-fest'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { PieceInstance, PieceInstancePiece } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { IBlueprintMutatablePart, PieceLifespan, Time } from '@sofie-automation/blueprints-integration'
import { PartCalculatedTimings } from '@sofie-automation/corelib/dist/playout/timings'
import { PlayoutPieceInstanceModel } from './PlayoutPieceInstanceModel.js'
import { CoreUserEditingDefinition } from '@sofie-automation/corelib/dist/dataModel/UserEditingDefinitions'
import { PartInvalidReason } from '@sofie-automation/corelib/dist/dataModel/Part'

/**
 * Token returned when making a backup copy of a PlayoutPartInstanceModel
 * The contents of this type is opaque and will vary fully across implementations
 */
export interface PlayoutPartInstanceModelSnapshot {
	__isPlayoutPartInstanceModelBackup: true
}

export interface PlayoutMutatablePart extends Omit<IBlueprintMutatablePart, 'userEditOperations'> {
	userEditOperations?: CoreUserEditingDefinition[]
}

export interface PlayoutPartInstanceModel {
	/**
	 * The PartInstance properties
	 */
	readonly partInstance: ReadonlyDeep<DBPartInstance>

	/**
	 * All the PieceInstances in the PartInstance
	 */
	readonly pieceInstances: PlayoutPieceInstanceModel[]

	/**
	 * Take a snapshot of the current state of this PlayoutPartInstanceModel
	 * This can be restored with `snapshotRestore` to rollback to a previous state of the model
	 */
	snapshotMakeCopy(): PlayoutPartInstanceModelSnapshot

	/**
	 * Restore a snapshot of this PlayoutPartInstanceModel, to rollback to a previous state
	 * Note: It is only possible to restore each snapshot once.
	 * Note: Any references to child `PlayoutPieceInstanceModel` or `DBPartInstance` may no longer be valid after this operation
	 * @param snapshot Snapshot to restore
	 */
	snapshotRestore(snapshot: PlayoutPartInstanceModelSnapshot): void

	/**
	 * Block a take out of this PartInstance from happening until the specified timestamp
	 * This can be necessary when an uninteruptable Piece is being played out
	 * @param timestamp Timestampt to block until
	 */
	blockTakeUntil(timestamp: Time | null): void

	/**
	 * Set the invalid reason for this PartInstance.
	 * This indicates a runtime validation issue that prevents taking the part.
	 * This is distinct from the planned `invalidReason` on the Part itself.
	 * @param reason The reason the part is invalid, or undefined to clear
	 */
	setInvalidReason(reason: PartInvalidReason | undefined): void

	/**
	 * Get a PieceInstance which belongs to this PartInstance
	 * @param id Id of the PieceInstance
	 */
	getPieceInstance(id: PieceInstanceId): PlayoutPieceInstanceModel | undefined

	/**
	 * Insert a Piece into this PartInstance as an adlibbed PieceInstance
	 * @param piece Piece to insert
	 * @param fromAdlibId Id of the source Adlib, if any
	 * @returns The inserted PlayoutPieceInstanceModel
	 */
	insertAdlibbedPiece(
		piece: Omit<PieceInstancePiece, 'startPartId'>,
		fromAdlibId: PieceId | BucketAdLibId | undefined
	): PlayoutPieceInstanceModel

	/**
	 * Extend a PieceInstance into this PartInstance as a Piece extended by HOLD
	 * The PieceInstance being extended must have been prepared with `prepareForHold` before calling this
	 * @param extendPieceInstance Piece to extend
	 * @returns The inserted PlayoutPieceInstanceModel
	 */
	insertHoldPieceInstance(extendPieceInstance: PlayoutPieceInstanceModel): PlayoutPieceInstanceModel

	/**
	 * Insert a Piece as if it were originally planned at the time of ingest
	 * This is a weird operation to have for playout, but it is a needed part of the SyncIngestChanges flow
	 * @param piece Piece to insert into this PartInstance
	 * @returns The inserted PlayoutPieceInstanceModel
	 */
	insertPlannedPiece(piece: Omit<PieceInstancePiece, 'startPartId'>): PlayoutPieceInstanceModel

	/**
	 * Insert a virtual adlib Piece into this PartInstance
	 * This will stop another piece following the infinite rules, but has no content and will not be visible in the UI
	 * @param start Start time of the Piece, relative to the start of the PartInstance
	 * @param lifespan Infinite lifespan to use
	 * @param sourceLayerId Id of the SourceLayer the Piece should play on
	 * @param outputLayerId Id of the OutputLayer the Piece should play on
	 * @returns The inserted PlayoutPieceInstanceModel
	 */
	insertVirtualPiece(
		start: number,
		lifespan: PieceLifespan,
		sourceLayerId: string,
		outputLayerId: string
	): PlayoutPieceInstanceModel

	/**
	 * Mark this PartInstance as 'reset'
	 * This will unload it from memory at the end of the operation from both the backend and UI.
	 * Any UI's will ignore this PartInstance and will use the original Part instead
	 */
	markAsReset(): void

	/**
	 * Recalculate the `expectedDurationWithTransition` property for this PartInstance
	 * Future: is this needed? should this be handled internally?
	 */
	recalculateExpectedDurationWithTransition(): void

	/**
	 * Remove a PieceInstance from the model.
	 * This is a slightly dangerous operation to have, as it could remove a PieceInstance which will be readded by the ingest or SyncIngestChanges logic
	 * @param id Piece to remove from this PartInstance
	 * @returns Whether the PieceInstance was found and removed
	 */
	removePieceInstance(id: PieceInstanceId): boolean

	/**
	 * Replace the infinite PieceInstances inherited from the previous playhead
	 * These PieceInstances are not supposed to be modified directly, as they are 'extensions'.
	 * This allows them to be replaced without embedding the infinite logic inside the model
	 * @param pieceInstances New infinite pieces from previous playhead
	 */
	replaceInfinitesFromPreviousPlayhead(pieceInstances: PieceInstance[]): void

	/**
	 * Merge a PieceInstance with a new version, or insert as a new PieceInstance.
	 * If there is an existing PieceInstance with the same id, it will be merged onto that
	 * Note: this can replace any playout owned properties too
	 * @param pieceInstance Replacement PieceInstance to use
	 * @returns The inserted PlayoutPieceInstanceModel
	 */
	mergeOrInsertPieceInstance(pieceInstance: ReadonlyDeep<PieceInstance>): PlayoutPieceInstanceModel

	/**
	 * Mark this PartInstance as being orphaned
	 * @param orphaned New orphaned state
	 */
	setOrphaned(orphaned: 'adlib-part' | 'deleted' | undefined): void

	/**
	 * Update the activation id of this PartInstance
	 * This can be done to move this PartInstance when resetting the Playlist, if some previous PartInstances want to be kept
	 * @param id New activation id
	 */
	setPlaylistActivationId(id: RundownPlaylistActivationId): void

	/**
	 * Set the Planned started playback time
	 * This will clear the Planned stopped playback time
	 * @param time Planned started time
	 */
	setPlannedStartedPlayback(time: Time | undefined): void
	/**
	 * Set the Planned stopped playback time
	 * @param time Planned stopped time
	 */
	setPlannedStoppedPlayback(time: Time | undefined): void
	/**
	 * Set the Reported (from playout-gateway) started playback time
	 * This will clear the Reported stopped playback time
	 * @param time Reported started time
	 */
	setReportedStartedPlayback(time: Time): boolean
	/**
	 * Set the Reported (from playout-gateway) stopped playback time
	 * @param time Reported stopped time
	 */
	setReportedStoppedPlayback(time: Time): boolean
	/**
	 * Set the Reported stopped playback time, including still-playing PieceInstances
	 * @param time Reported stopped time on all available objects
	 */
	setReportedStoppedPlaybackWithPieceInstances(time: Time): boolean

	/**
	 * Set the rank of this PartInstance, to update it's position in the Segment
	 * @param rank New rank
	 */
	setRank(rank: number): void

	/**
	 * Set the PartInstance as having been taken, if an offset is provided the plannedStartedPlayback of the PartInstance will be set to match,
	 * to force the PartInstance to have started a certain distance in the past
	 * @param takeTime The timestamp to record as when it was taken
	 * @param playOffset If set, offset into the PartInstance to start playback from
	 */
	setTaken(takeTime: number, playOffset: number | null): void

	/**
	 * Define some cached values, to be done when taking the PartInstance
	 * @param partPlayoutTimings Timings used for Playout, these depend on the previous PartInstance and should not change once playback is started
	 * @param previousPartEndState A state compiled by the Blueprints
	 */
	storePlayoutTimingsAndPreviousEndState(
		partPlayoutTimings: PartCalculatedTimings,
		previousPartEndState: unknown
	): void

	/**
	 * Update some properties for the wrapped Part
	 * Note: This is missing a lot of validation, and will become stricter later
	 * @param props New properties for the Part being wrapped
	 * @returns True if any valid properties were provided
	 */
	updatePartProps(props: Partial<PlayoutMutatablePart>): boolean

	/**
	 * Ensure that this PartInstance is setup correctly for being in the AdlibTesting Segment
	 */
	validateAdlibTestingSegmentProperties(): void

	/**
	 * Whether this part instance is too close to autoNexting out of, to perform operations that might cause glitches
	 * @param isTake
	 */
	isTooCloseToAutonext(isTake: boolean): boolean

	/**
	 * Returns the contained partInstance, with QuickLoop overrides applied, if needed
	 */
	getPartInstanceWithQuickLoopOverrides(): ReadonlyDeep<DBPartInstance>
}
