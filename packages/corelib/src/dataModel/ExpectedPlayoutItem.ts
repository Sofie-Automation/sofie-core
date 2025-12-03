import { ExpectedPlayoutItemGeneric } from '@sofie-automation/blueprints-integration'
import { ExpectedPlayoutItemId, StudioId, RundownId, PartId } from './Ids.js'

export interface ExpectedPlayoutItemBase extends ExpectedPlayoutItemGeneric {
	/** Globally unique id of the item */
	_id: ExpectedPlayoutItemId

	/** The studio installation this ExpectedPlayoutItem was generated in */
	studioId: StudioId
}
export interface ExpectedPlayoutItemRundown extends ExpectedPlayoutItemBase {
	/** The rundown id that is the source of this PlayoutItem */
	rundownId: RundownId
	/** The part id that is the source of this Playout Item */
	partId?: PartId
	// /** The piece id that is the source of this Playout Item */
	// pieceId: PieceId
	/** Is created for studio/rundown baseline */
	baseline?: 'rundown'
}
export interface ExpectedPlayoutItemStudio extends ExpectedPlayoutItemBase {
	baseline: 'studio'
}
export type ExpectedPlayoutItem = ExpectedPlayoutItemStudio | ExpectedPlayoutItemRundown
