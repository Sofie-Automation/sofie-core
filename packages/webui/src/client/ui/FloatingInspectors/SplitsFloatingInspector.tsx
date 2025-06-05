import React, { useMemo, useRef } from 'react'
import { FloatingInspector } from '../FloatingInspector'
import { SplitsContent } from '@sofie-automation/blueprints-integration'
import { getSplitPreview } from '../../lib/ui/splitPreview'
import { RenderSplitPreview } from '../../lib/SplitPreviewBox'
import { IFloatingInspectorPosition, useInspectorPosition } from './IFloatingInspectorPosition'

interface IProps {
	typeClass?: string
	showMiniInspector: boolean
	itemElement: HTMLDivElement | null
	position: IFloatingInspectorPosition
	content: Partial<SplitsContent>
	displayOn?: 'document' | 'viewport'
}

export const SplitsFloatingInspector: React.FunctionComponent<IProps> = (props) => {
	const ref = useRef(null)

	const splitItems = useMemo(() => {
		if (props.content.boxSourceConfiguration) {
			return getSplitPreview(props.content.boxSourceConfiguration)
		} else {
			return []
		}
	}, [props.content.boxSourceConfiguration])

	const shown = props.showMiniInspector && props.itemElement !== undefined

	const { style: floatingInspectorStyle } = useInspectorPosition(props.position, ref, shown)

	return (
		<FloatingInspector shown={shown} displayOn="viewport">
			<div
				className="segment-timeline__mini-inspector segment-timeline__mini-inspector--video"
				style={floatingInspectorStyle}
				ref={ref}
			>
				<RenderSplitPreview subItems={splitItems} showLabels={true} />
			</div>
		</FloatingInspector>
	)
}
