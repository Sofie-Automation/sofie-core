import React from 'react'
import { ISourceLayer } from '@sofie-automation/blueprints-integration'
import { PieceIconContainerNoSub } from '../../PieceIcons/PieceIcon'
import { PartUi } from './../SegmentTimelineContainer'
import classNames from 'classnames'

const noop = (e: React.MouseEvent) => {
	e.preventDefault()
	e.stopPropagation()
}

export const SegmentTimelineSmallPartFlagIcon = (props: {
	partInstance: PartUi
	isNext: boolean
	isLive: boolean
	sourceLayers: {
		[key: string]: ISourceLayer
	}
	onClick?: (e: React.MouseEvent<HTMLDivElement>) => void
	data?: Record<`data-${string}`, string>
}): JSX.Element => {
	return (
		<div
			className={classNames('segment-timeline__small-parts-flag__part', {
				next: props.isNext,
				live: props.isLive,
				invalid: props.partInstance.instance.part.invalid,
			})}
			onMouseDownCapture={noop}
			onMouseUpCapture={props.onClick}
			{...props.data}
		>
			<PieceIconContainerNoSub
				pieceInstances={props.partInstance.pieces.map((piece) => piece.instance)}
				sourceLayers={props.sourceLayers}
				renderUnknown={true}
			/>
		</div>
	)
}
