import { VTContent } from '@sofie-automation/blueprints-integration'
import { VTFloatingInspector } from '../../../FloatingInspectors/VTFloatingInspector'
import { IDefaultRendererProps } from './DefaultRenderer'
import { getNoticeLevelForPieceStatus } from '../../../../lib/notifications/notifications'
import { PieceStatusCode } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { LoopingPieceIcon } from '../../../../lib/ui/icons/looping'
import { useContentStatusForPieceInstance } from '../../../SegmentTimeline/withMediaObjectStatus'

export function VTRenderer({
	piece: pieceInstance,
	hovering,
	elementOffset,
	studio,
	typeClass,
}: Readonly<IDefaultRendererProps>): JSX.Element {
	const contentStatus = useContentStatusForPieceInstance(pieceInstance.instance)

	const vtContent = pieceInstance.instance.piece.content as VTContent

	const timePosition = ((hovering?.pageX ?? 0) - (elementOffset?.left ?? 0)) / (elementOffset?.width ?? 1)

	return (
		<>
			<VTFloatingInspector
				status={contentStatus?.status || PieceStatusCode.UNKNOWN}
				showMiniInspector={!!hovering}
				timePosition={timePosition}
				content={vtContent}
				position={{
					top: elementOffset?.top ?? 0,
					left: elementOffset?.left ?? 0,
					anchor: 'start',
					position: 'top-start',
				}}
				typeClass={typeClass}
				itemElement={null}
				noticeMessages={contentStatus?.messages || null}
				noticeLevel={getNoticeLevelForPieceStatus(contentStatus?.status)}
				studio={studio}
				previewUrl={contentStatus?.previewUrl}
			/>
			{pieceInstance.instance.piece.name}
			{pieceInstance.instance.piece.content?.loop && (
				<LoopingPieceIcon className="segment-storyboard__part__piece-icon" playing={!!hovering} />
			)}
		</>
	)
}
