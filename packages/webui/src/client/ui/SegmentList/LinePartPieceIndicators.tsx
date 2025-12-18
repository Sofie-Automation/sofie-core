import React from 'react'
import { ISourceLayerExtended, PieceExtended } from '../../lib/RundownResolver.js'
import { PartId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { LinePartAdLibIndicator } from './LinePartPieceIndicator/LinePartAdLibIndicator.js'
import { LinePartPieceIndicator } from './LinePartPieceIndicator/LinePartPieceIndicator.js'
import { LinePartScriptPiece } from './LinePartPieceIndicator/LinePartScriptPiece.js'
import { PieceUi } from '../SegmentContainer/withResolvedSegment.js'

interface IProps {
	partId: PartId
	pieces: PieceExtended[]
	indicatorColumns: Record<string, ISourceLayerExtended[]>
	adLibIndicatorColumns: Record<string, ISourceLayerExtended[]>
	onPieceClick?: (item: PieceUi, e: React.MouseEvent<HTMLDivElement>) => void
	onPieceDoubleClick?: (item: PieceUi, e: React.MouseEvent<HTMLDivElement>) => void
}

export const LinePartPieceIndicators: React.FC<Readonly<IProps>> = function LinePartPieceIndicators({
	partId,
	pieces,
	indicatorColumns,
	adLibIndicatorColumns,
	onPieceClick,
	onPieceDoubleClick,
}) {
	return (
		<div className="segment-opl__piece-indicators">
			<LinePartScriptPiece pieces={pieces} />
			{Object.entries<ISourceLayerExtended[]>(indicatorColumns).map(([label, sourceLayers]) => (
				<LinePartPieceIndicator
					key={label}
					label={label}
					sourceLayers={sourceLayers}
					pieces={pieces}
					partId={partId}
					onPieceClick={onPieceClick}
					onPieceDoubleClick={onPieceDoubleClick}
				/>
			))}
			{Object.entries<ISourceLayerExtended[]>(adLibIndicatorColumns).map(([label, sourceLayers]) => (
				<LinePartAdLibIndicator key={label} label={label} sourceLayers={sourceLayers} partId={partId} />
			))}
		</div>
	)
}
