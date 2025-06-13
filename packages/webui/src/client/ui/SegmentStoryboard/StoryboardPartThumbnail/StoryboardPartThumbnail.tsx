import { SourceLayerType } from '@sofie-automation/blueprints-integration'
import classNames from 'classnames'
import React, { useMemo, useState } from 'react'
import { PartExtended, PieceExtended } from '../../../lib/RundownResolver.js'
import { findPieceExtendedToShowFromOrderedResolvedInstances } from '../../PieceIcons/utils.js'
import StudioContext from '../../RundownView/StudioContext.js'
import { StoryboardPartThumbnailInner } from './StoryboardPartThumbnailInner.js'

interface IProps {
	part: PartExtended
	isLive: boolean
	isNext: boolean
}

const supportedSourceLayerTypes = new Set(
	Object.values<SourceLayerType>(SourceLayerType as any).filter(
		// Support all types, apart from TRANSITION and also filter out the inverse-enum strings
		(val) => typeof val !== 'string' && val !== SourceLayerType.TRANSITION
	)
)

function findMainPiece(pieces: PieceExtended[]) {
	return findPieceExtendedToShowFromOrderedResolvedInstances(
		pieces.filter((piece) => piece.outputLayer?.isPGM && piece.sourceLayer?.onPresenterScreen),
		supportedSourceLayerTypes
	)
}

export const StoryboardPartThumbnail = React.memo(function StoryboardPartThumbnail({
	part,
	isLive,
	isNext,
}: Readonly<IProps>) {
	const mainPiece = useMemo<PieceExtended | undefined>(() => findMainPiece(part.pieces), [part.pieces])
	const [highlight] = useState(false)

	return mainPiece ? (
		<StudioContext.Consumer>
			{(studio) =>
				studio ? (
					<StoryboardPartThumbnailInner
						piece={mainPiece}
						isLive={isLive}
						isNext={isNext}
						layer={mainPiece?.sourceLayer}
						studio={studio}
						partId={part.partId}
						partInstanceId={part.instance._id}
						highlight={highlight}
						partAutoNext={part.instance.part.autoNext ?? false}
						partPlannedStoppedPlayback={part.instance.timings?.plannedStoppedPlayback}
					/>
				) : null
			}
		</StudioContext.Consumer>
	) : (
		<div
			className={classNames('segment-storyboard__part__thumbnail segment-storyboard__part__thumbnail--placeholder', {
				'invert-flash': highlight,
			})}
		></div>
	)
})
