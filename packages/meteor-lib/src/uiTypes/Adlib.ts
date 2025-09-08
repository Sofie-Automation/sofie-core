import type { IOutputLayer, ISourceLayer } from '@sofie-automation/shared-lib/dist/core/model/ShowStyle'
import type { AdLibPiece } from '@sofie-automation/corelib/dist/dataModel/AdLibPiece'
import type { SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import type { AdLibAction } from '@sofie-automation/corelib/dist/dataModel/AdlibAction'
import type { RundownBaselineAdLibAction } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineAdLibAction'

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
