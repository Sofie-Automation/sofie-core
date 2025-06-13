import type { ISourceLayer } from '@sofie-automation/shared-lib/dist/core/model/ShowStyle'
import type { PieceExtended } from './Piece.js'

export interface ISourceLayerExtended extends ISourceLayer {
	/** Pieces present on this source layer */
	pieces: Array<PieceExtended>
	followingItems: Array<PieceExtended>
}
