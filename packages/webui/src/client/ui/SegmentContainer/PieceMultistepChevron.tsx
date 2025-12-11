import { NoraContent, SourceLayerType } from '@sofie-automation/blueprints-integration'
import React from 'react'
import { PieceExtended } from '../../lib/RundownResolver.js'

export const PieceMultistepChevron = React.forwardRef<
	HTMLSpanElement,
	{
		className: string
		piece: PieceExtended
		style?: React.CSSProperties
	}
>(function PieceMultistepChevron({ className, piece, style }, ref): JSX.Element | null {
	const hasStepChevron = getPieceSteps(piece)

	if (!hasStepChevron) return null

	const { currentStep, allSteps } = hasStepChevron

	return (
		<span className={className} style={style} ref={ref}>
			{currentStep}/{allSteps}
		</span>
	)
})

export function getPieceSteps(piece: PieceExtended): { currentStep: number; allSteps: number } | null {
	const noraContent = piece.instance.piece.content as NoraContent | undefined

	const hasStepChevron =
		(piece.sourceLayer?.type === SourceLayerType.GRAPHICS ||
			piece.sourceLayer?.type === SourceLayerType.LOWER_THIRD ||
			piece.sourceLayer?.type === SourceLayerType.STUDIO_SCREEN) &&
		!!noraContent?.step

	if (!noraContent || !hasStepChevron) return null

	return getNoraContentSteps(noraContent)
}

export function getNoraContentSteps(
	noraContent: NoraContent | undefined
): { currentStep: number; allSteps: number } | null {
	if (!noraContent?.step) return null

	const currentStep = noraContent.step.current || 1

	const allSteps = noraContent.step.count

	return { currentStep, allSteps }
}
