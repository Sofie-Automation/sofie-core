import { IBlueprintPieceGeneric } from './pieceGeneric.js'

/**
 * A variant of a Piece, that is owned by the Rundown.
 */
export interface IBlueprintRundownPiece<TPrivateData = unknown, TPublicData = unknown> extends Omit<
	IBlueprintPieceGeneric<TPrivateData, TPublicData>,
	'lifespan'
> {
	/** When the piece should be active on the timeline. */
	enable: {
		start: number
		duration?: number

		// For now, these pieces are always absolute (using wall time) rather than relative to the rundown
		isAbsolute: true
	}

	/** Whether the piece is a real piece, or exists as a marker to stop an infinite piece. If virtual, it does not add any contents to the timeline */
	virtual?: boolean

	/** Whether the piece affects the output of the Studio or is describing an invisible state within the Studio */
	notInVision?: boolean
}

/** The Rundown piece sent from Core */
export interface IBlueprintRundownPieceDB<TPrivateData = unknown, TPublicData = unknown> extends IBlueprintRundownPiece<
	TPrivateData,
	TPublicData
> {
	_id: string
}
