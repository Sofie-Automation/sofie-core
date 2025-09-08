import type { PieceInstanceWithTimings } from '@sofie-automation/corelib/dist/playout/processAndPrune'
import type { IOutputLayerExtended } from './OutputLayer.js'
import type { ISourceLayerExtended } from './SourceLayer.js'

export interface PieceExtended {
	instance: PieceInstanceWithTimings

	/** Source layer that this piece belongs to */
	sourceLayer?: ISourceLayerExtended
	/** Output layer that this part uses */
	outputLayer?: IOutputLayerExtended
	/** Position in timeline, relative to the beginning of the Part */
	renderedInPoint: number | null
	/** Duration in timeline */
	renderedDuration: number | null
	/** If set, the item was cropped in runtime by another item following it */
	cropped?: boolean
	/** Maximum width of a label so as not to appear underneath the following item */
	maxLabelWidth?: number
	/** If this piece has a "buddy" piece in the preceeding part, then it's not neccessary to display it's left label */
	hasOriginInPreceedingPart?: boolean
}

export interface PieceUi extends PieceExtended {
	/** This item has already been linked to the parent item of the spanning item group */
	linked?: boolean
}
