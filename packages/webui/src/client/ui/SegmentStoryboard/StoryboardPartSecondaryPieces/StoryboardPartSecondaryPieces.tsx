import { SourceLayerType } from '@sofie-automation/blueprints-integration'
import React from 'react'
import { ISourceLayerExtended, PartExtended } from '../../../lib/RundownResolver'
import { getShowHiddenSourceLayers } from '../../../lib/localStorage'
import { IOutputLayerUi } from '../../SegmentContainer/withResolvedSegment'
import { StoryboardSourceLayer } from './StoryboardSourceLayer'

interface IProps {
	part: PartExtended
	outputLayers: Record<string, IOutputLayerUi>
}

const showHiddenSourceLayers = getShowHiddenSourceLayers()

export function filterSecondaryOutputLayers(outputLayers: IOutputLayerUi[]): IOutputLayerUi[] {
	return outputLayers.filter((outputLayer) => outputLayer.used).sort((a, b) => a._rank - b._rank)
}

export function filterSecondarySourceLayers(sourceLayers: ISourceLayerExtended[]): ISourceLayerExtended[] {
	return sourceLayers
		.filter(
			(sourceLayer) =>
				(showHiddenSourceLayers || !sourceLayer.isHidden) &&
				!sourceLayer.onPresenterScreen &&
				sourceLayer.type !== SourceLayerType.TRANSITION
		)
		.sort((a, b) => a._rank - b._rank)
}

export const StoryboardPartSecondaryPieces = React.memo(function StoryboardPartSecondaryPieces({
	part,
	outputLayers,
}: IProps) {
	return (
		<div className="segment-storyboard__part__secondary-pieces">
			{filterSecondaryOutputLayers(Object.values<IOutputLayerUi>(outputLayers)).map((outputLayer) => {
				const sourceLayers = filterSecondarySourceLayers(Object.values<ISourceLayerExtended>(outputLayer.sourceLayers))

				if (sourceLayers.length === 0) return null

				return (
					<div
						key={outputLayer._id}
						className="segment-storyboard__part__output-group"
						data-obj-id={outputLayer._id}
						role="log"
						aria-live="assertive"
					>
						{sourceLayers.map((sourceLayer) => (
							<StoryboardSourceLayer key={sourceLayer._id} sourceLayer={sourceLayer} pieces={part.pieces} part={part} />
						))}
					</div>
				)
			})}
		</div>
	)
})
