import { IBlueprintAdLibPiece } from '@sofie-automation/blueprints-integration'
import { RundownId, PartId } from './Ids'
import { PieceGeneric } from './Piece'

export interface AdLibPiece extends PieceGeneric, Omit<IBlueprintAdLibPiece, 'timelineObjects'> {
	/** Rundown this AdLib belongs to */
	rundownId: RundownId

	/** Part this AdLib belongs to */
	partId?: PartId
}
