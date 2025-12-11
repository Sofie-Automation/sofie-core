import type { IRundownUserContext } from './rundownContext.js'
import type {
	IBlueprintMutatablePart,
	IBlueprintPartInstance,
	IBlueprintPiece,
	IBlueprintPieceInstance,
} from '../documents/index.js'
import type { IEventContext } from './eventContext.js'

export interface ISyncIngestUpdateToPartInstanceContext extends IRundownUserContext, IEventContext {
	/** Sync a pieceInstance. Inserts the pieceInstance if new, updates if existing. Optionally pass in a mutated Piece, to override the content of the instance */
	syncPieceInstance(
		pieceInstanceId: string,
		mutatedPiece?: Omit<IBlueprintPiece, 'lifespan'>
	): IBlueprintPieceInstance

	/** Insert a pieceInstance. Returns id of new PieceInstance. Any timelineObjects will have their ids changed, so are not safe to reference from another piece */
	insertPieceInstance(piece: IBlueprintPiece): IBlueprintPieceInstance
	/** Update a pieceInstance */
	updatePieceInstance(pieceInstanceId: string, piece: Partial<IBlueprintPiece>): IBlueprintPieceInstance
	/** Remove a pieceInstance */
	removePieceInstances(...pieceInstanceIds: string[]): string[]

	// Upcoming interface:
	// /** Insert a AdlibInstance. Returns id of new AdlibInstance. Any timelineObjects will have their ids changed, so are not safe to reference from another piece */
	// insertAdlibInstance(adlibPiece: IBlueprintAdLibPiece): IBlueprintAdlibPieceInstance
	// /** Update a AdlibInstance */
	// updateAdlibInstance(adlibInstanceId: string, adlibPiece: Partial<OmitId<IBlueprintAdLibPiece>>): IBlueprintAdlibPieceInstance
	// /** Remove a AdlibInstance */
	// removeAdlibInstances(...adlibInstanceId: string[]): string[]

	// Upcoming interface:
	// /** Insert a ActionInstance. Returns id of new ActionInstance. Any timelineObjects will have their ids changed, so are not safe to reference from another piece */
	// insertActionInstance(action: IBlueprintAdlibAction): IBlueprintAdlibActionInstance
	// /** Update a ActionInstance */
	// updateActionInstance(actionInstanceId: string, action: Partial<OmitId<IBlueprintAdlibAction>>): IBlueprintAdlibActionInstance
	// /** Remove a ActionInstance */
	// removeActionInstances(...actionInstanceIds: string[]): string[]

	/** Update a partInstance */
	updatePartInstance(props: Partial<IBlueprintMutatablePart>): IBlueprintPartInstance

	/** Remove the partInstance. This is only valid when `playstatus: 'next'` */
	removePartInstance(): void
}
