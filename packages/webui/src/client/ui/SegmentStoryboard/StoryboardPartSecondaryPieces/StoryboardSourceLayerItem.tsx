import { PartId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { PieceExtended } from '@sofie-automation/meteor-lib/dist/uiTypes/Piece'
import { ISourceLayerExtended } from '@sofie-automation/meteor-lib/dist/uiTypes/SourceLayer'
import StudioContext from '../../RundownView/StudioContext.js'
import { StoryboardSecondaryPiece } from './StoryboardSecondaryPiece.js'
import classNames from 'classnames'
import { useMemo } from 'react'

export function StoryboardSourceLayerItem({
	piece,
	layer,
	partId,
	isFinished,
	isPlaying,
	index,
	hoverIndex,
	topmostPieceIndex,
	totalSiblings,
	onPointerEnter,
}: {
	piece: PieceExtended
	layer: ISourceLayerExtended
	partId: PartId
	isFinished: boolean
	isPlaying: boolean
	index: number
	hoverIndex: number | null
	topmostPieceIndex: number
	totalSiblings: number
	onPointerEnter?: (event: React.PointerEvent<HTMLDivElement>) => void
}): React.JSX.Element {
	const style = useMemo<React.CSSProperties>(
		() => ({
			'--piece-index': index,
			'--piece-playback-duration': `${piece.renderedDuration}ms`,
			zIndex: hoverIndex !== null ? (index <= hoverIndex ? totalSiblings + index : totalSiblings - index) : undefined,
		}),
		[index, piece.renderedDuration, hoverIndex, index, totalSiblings]
	)

	return (
		<StudioContext.Consumer>
			{(studio) => (
				<StoryboardSecondaryPiece
					piece={piece}
					studio={studio}
					isLiveLine={false}
					layer={layer}
					partId={partId}
					className={classNames({
						'segment-storyboard__part__piece--frontmost':
							hoverIndex !== null ? hoverIndex === index : topmostPieceIndex === index,
						'segment-storyboard__part__piece--playing': piece.renderedDuration !== null && isPlaying,
						'segment-storyboard__part__piece--finished': isFinished,
						hover: index === hoverIndex,
					})}
					style={style}
					onPointerEnter={onPointerEnter}
				/>
			)}
		</StudioContext.Consumer>
	)
}
