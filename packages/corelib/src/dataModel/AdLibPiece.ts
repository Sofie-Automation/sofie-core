import { IBlueprintAdLibPiece, SomeContent } from '@sofie-automation/blueprints-integration'
import { RundownId, PartId } from './Ids.js'
import { PieceGeneric } from './Piece.js'

export interface AdLibPiece extends PieceGeneric, Omit<IBlueprintAdLibPiece, 'content'> {
	/** Rundown this AdLib belongs to */
	rundownId: RundownId

	content: SomeContent

	/** Part this AdLib belongs to */
	partId?: PartId
}
