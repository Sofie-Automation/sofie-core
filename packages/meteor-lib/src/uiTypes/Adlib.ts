import type { IOutputLayer, ISourceLayer } from '@sofie-automation/shared-lib/dist/core/model/ShowStyle'
import type { AdLibPiece } from '@sofie-automation/corelib/dist/dataModel/AdLibPiece.js'
import type { SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids.js'
import type { AdLibAction } from '@sofie-automation/corelib/dist/dataModel/AdlibAction.js'
import type { RundownBaselineAdLibAction } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineAdLibAction.js'

export interface AdLibPieceUi extends Omit<AdLibPiece, 'timelineObjectsString'> {
	hotkey?: string
	sourceLayer?: ISourceLayer
	outputLayer?: IOutputLayer
	isGlobal?: boolean
	isSticky?: boolean
	isAction?: boolean
	isClearSourceLayer?: boolean
	disabled?: boolean
	adlibAction?: AdLibAction | RundownBaselineAdLibAction
	segmentId?: SegmentId
}

export interface IAdLibListItem extends AdLibPieceUi {
	sourceLayer?: ISourceLayer
	outputLayer?: IOutputLayer
	invalid?: boolean
	floated?: boolean
}
