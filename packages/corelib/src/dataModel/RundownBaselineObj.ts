import { RundownBaselineObjId, RundownId } from './Ids.js'
import { PieceTimelineObjectsBlob } from './Piece.js'

export interface RundownBaselineObj {
	_id: RundownBaselineObjId
	/** The rundown this timeline-object belongs to */
	rundownId: RundownId

	/** Stringified timelineObjects */
	timelineObjectsString: PieceTimelineObjectsBlob
}
