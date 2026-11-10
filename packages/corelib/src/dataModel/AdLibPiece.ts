import type { IBlueprintAdLibPiece, SomeContent } from '@sofie-automation/blueprints-integration'
import type { RundownId, PartId } from './Ids.js'
import type { PieceGeneric } from './Piece.js'

export interface AdLibPiece
	extends PieceGeneric, Omit<IBlueprintAdLibPiece, 'content' | 'userEditOperations' | 'userEditProperties'> {
	/** Rundown this AdLib belongs to */
	rundownId: RundownId

	content: SomeContent

	/** Part this AdLib belongs to */
	partId?: PartId
}
