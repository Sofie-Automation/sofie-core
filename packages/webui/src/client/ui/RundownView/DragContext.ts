import { PartInstanceId, PieceInstanceId, SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { createContext } from 'react'
import { PieceUi } from '../SegmentContainer/withResolvedSegment'

export interface IDragContext {
	/**
	 * Indicate a drag operation on a piece has started
	 * @param piece The piece that is being dragged
	 * @param timeScale The current TimeScale of the segment
	 * @param position The position of the mouse
	 * @param elementOffset The x-coordinate of the element relative to the mouse position
	 * @param limitToSegment Whether the piece can be dragged to other segments (note: if the other segment does not have the right source layer the piece will look to have disappeared... consider omitting this is a todo)
	 */
	startDrag: (
		piece: PieceUi,
		timeScale: number,
		position: { x: number; y: number },
		elementOffset?: number,
		limitToSegment?: SegmentId
	) => void
	/**
	 * Indicate the part the mouse is on has changed
	 * @param partId The part id that the mouse is currently hovering on
	 * @param segmentId The segment the part currenly hover is in
	 * @param position The position of the part in absolute coords to the screen
	 */
	setHoveredPart: (partId: PartInstanceId, segmentId: SegmentId, position: { x: number; y: number }) => void

	/**
	 * Whether dragging is enabled
	 */
	enabled: boolean

	/**
	 * PieceId of the piece that is being dragged
	 */
	pieceId: undefined | PieceInstanceId
	/**
	 * The piece with any local overrides coming from dragging it around (i.e. changed renderedInPoint)
	 */
	piece: undefined | PieceUi
}

export const dragContext = createContext<IDragContext | undefined>(undefined) // slay.
