import { PieceInstanceInfiniteId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ReadonlyDeep } from 'type-fest'
import { PieceInstance, PieceInstancePiece } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { Time } from '@sofie-automation/blueprints-integration'

export interface PlayoutPieceInstanceModel {
	/**
	 * The PieceInstance properties
	 */
	readonly pieceInstance: ReadonlyDeep<PieceInstance>

	/**
	 * Prepare this PieceInstance to be continued during HOLD
	 * This sets the PieceInstance up as an infinite, to allow the Timeline to be generated correctly
	 */
	prepareForHold(): PieceInstanceInfiniteId

	/**
	 * Set the PieceInstance as disabled/enabled
	 * If disabled, it will be ignored by the Timeline and infinites logic
	 * @param disabled Whether the PieceInstance should be disabled
	 */
	setDisabled(disabled: boolean): void

	/**
	 * Give the PieceInstance a new end point/duration which has been decided by Playout operations
	 * @param duration New duration/end point
	 */
	setDuration(duration: Required<PieceInstance>['userDuration']): void

	/**
	 * Set the Planned started playback time
	 * This will clear the Planned stopped playback time
	 * @param time Planned started time, or undefined if not known
	 */
	setPlannedStartedPlayback(time: Time | undefined): boolean
	/**
	 * Set the Planned stopped playback time
	 * @param time Planned stopped time
	 */
	setPlannedStoppedPlayback(time: Time | undefined): boolean
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
	 * Update some properties for the wrapped Piece
	 * Note: This is missing a lot of validation, and will become stricter later
	 * @param props New properties for the Piece being wrapped
	 */
	updatePieceProps(props: Partial<PieceInstancePiece>): void
}
