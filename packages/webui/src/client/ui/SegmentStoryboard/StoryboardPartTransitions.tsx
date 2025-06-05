import React from 'react'
import { SourceLayerType } from '@sofie-automation/blueprints-integration'
import { ISourceLayerExtended, PartExtended } from '../../lib/RundownResolver'
import { IOutputLayerUi } from '../SegmentContainer/withResolvedSegment'
import { StoryboardSourceLayer } from './StoryboardPartSecondaryPieces/StoryboardSourceLayer'

interface IProps {
	part: PartExtended
	outputLayers: Record<string, IOutputLayerUi>
}

function filterSourceLayers(sourceLayers: ISourceLayerExtended[]) {
	return sourceLayers.filter(
		(sourceLayer) =>
			!sourceLayer.isHidden && sourceLayer.type === SourceLayerType.TRANSITION && sourceLayer.pieces.length > 0
	)
}

export const StoryboardPartTransitions = React.memo(function StoryboardPartTransitions({ part, outputLayers }: IProps) {
	return (
		<div className="segment-storyboard__part__transitions">
			{filterSourceLayers(
				Object.values<IOutputLayerUi>(outputLayers)
					.map((outputLayer) => outputLayer.sourceLayers)
					.flat()
			).map((sourceLayer) => {
				return (
					<StoryboardSourceLayer key={sourceLayer._id} sourceLayer={sourceLayer} pieces={part.pieces} part={part} />
				)
			})}
		</div>
	)
})
