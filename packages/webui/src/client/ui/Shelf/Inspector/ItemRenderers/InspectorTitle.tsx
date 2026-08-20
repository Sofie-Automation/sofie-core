import ClassNames from 'classnames'
import type { BucketAdLibUi, BucketAdLibActionUi } from '../../RundownViewBuckets.js'
import { RundownUtils } from '../../../../lib/rundown.js'
import type { Piece, PieceUi } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { useContentStatusForItem } from '../../../SegmentTimeline/withMediaObjectStatus.js'
import type { IAdLibListItem } from '../../AdLibListItem.js'
import type { AdLibPieceUi } from '../../../../lib/shelf.js'
import type { UIShowStyleBase } from '@sofie-automation/corelib/src/dataModel/ShowStyleBase.js'
import type { UIStudio } from '@sofie-automation/corelib/src/dataModel/Studio.js'

interface IProps {
	piece: PieceUi | IAdLibListItem | BucketAdLibUi | BucketAdLibActionUi
	showStyleBase: UIShowStyleBase
	studio: UIStudio
}

function InspectorTitle(props: IProps): JSX.Element {
	const contentStatus = useContentStatusForItem(props.piece)

	const piece = RundownUtils.isPieceInstance(props.piece)
		? (props.piece.instance.piece as Piece)
		: (props.piece as AdLibPieceUi)

	const layer = props.showStyleBase.sourceLayers[piece.sourceLayerId]

	return (
		<h2 className="shelf-inspector__title">
			<div
				className={ClassNames(
					'shelf-inspector__title__icon',
					layer && RundownUtils.getSourceLayerClassName(layer.type),
					RundownUtils.getPieceStatusClassName(contentStatus?.status)
				)}
			>
				<div className="shelf-inspector__title__layer">{layer && (layer.abbreviation || layer.name)}</div>
			</div>
			<span className="shelf-inspector__title__label">{piece.name}</span>
		</h2>
	)
}

export default InspectorTitle
