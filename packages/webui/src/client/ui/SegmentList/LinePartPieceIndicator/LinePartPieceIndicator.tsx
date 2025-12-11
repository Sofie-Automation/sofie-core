import React, { useMemo } from 'react'
import { ISourceLayerExtended, PieceExtended } from '../../../lib/RundownResolver.js'
import { PartId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import StudioContext from '../../RundownView/StudioContext.js'
import { LinePartIndicator } from './LinePartIndicator.js'
import { PieceIndicatorMenu } from './PieceIndicatorMenu.js'
import { PieceUi } from '../../SegmentContainer/withResolvedSegment.js'

interface IProps {
	partId: PartId
	label: string
	sourceLayers: ISourceLayerExtended[]
	pieces: PieceExtended[]
	onPieceClick?: (item: PieceUi, e: React.MouseEvent<HTMLDivElement>) => void
	onPieceDoubleClick?: (item: PieceUi, e: React.MouseEvent<HTMLDivElement>) => void
}

export const LinePartPieceIndicator: React.FC<IProps> = function LinePartPieceIndicator({
	label,
	pieces,
	sourceLayers,
	partId,
	onPieceClick,
	onPieceDoubleClick,
}) {
	const sourceLayerIds = useMemo(() => sourceLayers.map((layer) => layer._id), [sourceLayers])
	const thisPieces = useMemo(
		() =>
			pieces
				.filter(
					(piece) =>
						piece.sourceLayer &&
						sourceLayerIds.includes(piece.sourceLayer._id) &&
						(piece.renderedDuration === null || piece.renderedDuration > 0)
				)
				.sort((a, b) => (b.instance.dynamicallyInserted ?? 0) - (a.instance.dynamicallyInserted ?? 0)), // TODO: This is a quick & dirty way to handle someone switching a Backscreen from a graphic to a clip
		[pieces, sourceLayerIds]
	)

	const topPiece = thisPieces[0]

	const hasOriginInPreceedingPart = topPiece?.hasOriginInPreceedingPart || false

	return (
		<StudioContext.Consumer>
			{(studio) => {
				if (!studio) return null
				return (
					<>
						<LinePartIndicator
							allSourceLayers={sourceLayers}
							count={thisPieces.length}
							label={label.substring(0, 1)}
							thisSourceLayer={topPiece?.sourceLayer}
							hasOriginInPreceedingPart={hasOriginInPreceedingPart}
							piece={topPiece}
							studio={studio}
							overlay={(ref, setIsOver) => (
								<PieceIndicatorMenu
									pieces={thisPieces}
									parentEl={ref}
									partId={partId}
									setIsOver={setIsOver}
									onPieceClick={onPieceClick}
									onPieceDoubleClick={onPieceDoubleClick}
								/>
							)}
						/>
					</>
				)
			}}
		</StudioContext.Consumer>
	)
}
