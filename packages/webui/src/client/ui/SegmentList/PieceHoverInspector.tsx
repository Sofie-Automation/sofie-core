import {
	GraphicsContent,
	ISourceLayer,
	SourceLayerType,
	TransitionContent,
	VTContent,
} from '@sofie-automation/blueprints-integration'
import { PieceStatusCode } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { UIStudio } from '@sofie-automation/meteor-lib/dist/api/studios'
import { getNoticeLevelForPieceStatus } from '../../lib/notifications/notifications'
import { RundownUtils } from '../../lib/rundown'
import { OffsetPosition } from '../../utils/positions'
import { FloatingInspector } from '../FloatingInspector'
import { L3rdFloatingInspector } from '../FloatingInspectors/L3rdFloatingInspector'
import { VTFloatingInspector } from '../FloatingInspectors/VTFloatingInspector'
import { PieceUi } from '../SegmentContainer/withResolvedSegment'
import { ReadonlyDeep } from 'type-fest'
import { PieceContentStatusObj } from '@sofie-automation/meteor-lib/dist/api/pieceContentStatus'

export function PieceHoverInspector({
	studio,
	pieceInstance,
	contentStatus,
	hovering,
	hoverScrubTimePosition,
	originPosition,
	mousePosition,
	layer,
}: Readonly<{
	studio: UIStudio
	pieceInstance: PieceUi
	contentStatus: ReadonlyDeep<PieceContentStatusObj> | undefined
	hovering: boolean
	hoverScrubTimePosition: number
	originPosition: OffsetPosition
	mousePosition: number
	layer: ISourceLayer | undefined
}>): JSX.Element | null {
	const vtContent = pieceInstance.instance.piece.content as VTContent
	const graphicsContent = pieceInstance.instance.piece.content as GraphicsContent
	const transitionContent = pieceInstance.instance.piece.content as TransitionContent

	const noticeLevel = getNoticeLevelForPieceStatus(contentStatus?.status)

	switch (layer?.type) {
		case SourceLayerType.TRANSITION:
			// TODO: Move this code to a shared TransitionFloatingInspector
			return (
				<FloatingInspector shown={hovering}>
					{transitionContent?.preview && (
						<div
							className="segment-timeline__mini-inspector segment-timeline__mini-inspector--video"
							style={{
								top: originPosition.top + 'px',
								left: originPosition.left + mousePosition + 'px',
								transform: 'translate(0, -100%)',
							}}
						>
							<img src={'/api/private/blueprints/assets/' + transitionContent.preview} className="thumbnail" />
						</div>
					)}
				</FloatingInspector>
			)
		case SourceLayerType.GRAPHICS:
		case SourceLayerType.LOWER_THIRD:
		case SourceLayerType.STUDIO_SCREEN:
			return (
				<L3rdFloatingInspector
					showMiniInspector={hovering}
					content={graphicsContent}
					position={{
						top: originPosition.top,
						left: originPosition.left + mousePosition,
						anchor: 'start',
						position: 'top-start',
					}}
					typeClass={layer && RundownUtils.getSourceLayerClassName(layer.type)}
					itemElement={null}
					piece={pieceInstance.instance.piece}
					pieceRenderedDuration={pieceInstance.renderedDuration}
					pieceRenderedIn={pieceInstance.renderedInPoint}
					displayOn="document"
				/>
			)
		case SourceLayerType.VT:
		case SourceLayerType.LIVE_SPEAK:
			return (
				<VTFloatingInspector
					status={contentStatus?.status ?? PieceStatusCode.UNKNOWN}
					showMiniInspector={hovering}
					timePosition={hoverScrubTimePosition}
					content={vtContent}
					position={{
						top: originPosition.top,
						left: originPosition.left + mousePosition,
						anchor: 'start',
						position: 'top-start',
					}}
					typeClass={layer && RundownUtils.getSourceLayerClassName(layer.type)}
					itemElement={null}
					noticeMessages={contentStatus?.messages ?? null}
					noticeLevel={noticeLevel}
					studio={studio}
					previewUrl={contentStatus?.previewUrl}
				/>
			)
	}

	return null
}
