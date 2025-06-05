import ClassNames from 'classnames'
import { PieceUi } from '../../../SegmentTimeline/SegmentTimelineContainer'
import { BucketAdLibUi, BucketAdLibActionUi } from '../../RundownViewBuckets'
import { RundownUtils } from '../../../../lib/rundown'
import { Piece } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { useContentStatusForItem } from '../../../SegmentTimeline/withMediaObjectStatus'
import { IAdLibListItem } from '../../AdLibListItem'
import { AdLibPieceUi } from '../../../../lib/shelf'
import { UIShowStyleBase } from '@sofie-automation/meteor-lib/dist/api/showStyles'
import { UIStudio } from '@sofie-automation/meteor-lib/dist/api/studios'

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
