import type { PropsWithChildren } from 'react'
import type { IDashboardButtonProps } from './DashboardPieceButton/types'
import { DashboardPieceButton } from './DashboardPieceButton/DashboardPieceButton.js'

import { useDrop, useDrag } from 'react-dnd'
import { DragDropItemTypes } from '../DragDropItemTypes.js'
import type { BucketAdLib } from '@sofie-automation/corelib/dist/dataModel/BucketAdLibPiece'
import type { BucketAdLibActionUi, BucketAdLibItem } from './RundownViewBuckets.js'
import type { IBlueprintActionTriggerMode } from '@sofie-automation/blueprints-integration'
import type { BucketId, PieceId } from '@sofie-automation/corelib/dist/dataModel/Ids'

interface IBucketPieceDragObject {
	id: PieceId
	bucketId: BucketId
	originalIndex: number
}

export interface IBucketPieceDropResult {
	index: number
	bucketId: BucketId
	action: 'reorder' | 'move' | undefined
}

export interface BucketPieceButtonBaseProps {
	moveAdLib: (id: PieceId, atIndex: number) => void
	findAdLib: (id: PieceId) => { piece: BucketAdLib | BucketAdLibActionUi | undefined; index: number }
	onAdLibReorder: (draggedId: PieceId, newIndex: number, oldIndex: number) => void
	onAdLibMove: (id: PieceId, newBucketId: BucketId) => void
	bucketId: BucketId
	onToggleAdLib: (piece: BucketAdLibItem, queue: boolean, e: any, mode?: IBlueprintActionTriggerMode) => void
}

export function BucketPieceButton(
	props: PropsWithChildren<IDashboardButtonProps> & BucketPieceButtonBaseProps
): JSX.Element {
	const [, connectDropTarget] = useDrop<IBucketPieceDragObject, {}, {}>({
		accept: DragDropItemTypes.BUCKET_ADLIB_PIECE,
		canDrop(_props, _monitor) {
			return true
		},

		hover(item, _monitor) {
			const { id: draggedId } = item
			const overId = props.piece._id

			if (draggedId !== overId) {
				const { index: overIndex } = props.findAdLib(overId)
				props.moveAdLib(draggedId, overIndex)
			}
		},

		drop(item, _monitor) {
			const { index } = props.findAdLib(item.id)

			return {
				index,
				action: 'reorder',
			}
		},
	})

	const [, connectDragSource] = useDrag<IBucketPieceDragObject, IBucketPieceDropResult, { isDragging: boolean }>({
		type: DragDropItemTypes.BUCKET_ADLIB_PIECE,
		item: () => {
			return {
				id: props.piece._id,
				originalIndex: props.findAdLib(props.piece._id).index,
				bucketId: props.bucketId,
			}
		},

		end: (item, monitor) => {
			const { id: droppedId, originalIndex } = item
			const didDrop = monitor.didDrop()

			if (!didDrop) {
				props.moveAdLib(droppedId, originalIndex)
			} else {
				const dropResult = monitor.getDropResult()
				if (!dropResult) return

				const { action } = dropResult
				if (action === 'reorder') {
					const { index: newIndex } = props.findAdLib(droppedId)
					props.onAdLibReorder(droppedId, newIndex, originalIndex)
				} else if (action === 'move') {
					const { bucketId } = dropResult
					props.onAdLibMove(droppedId, bucketId)
				}
			}
		},

		collect: (monitor) => ({
			isDragging: monitor.isDragging(),
		}),
	})

	return (
		<DashboardPieceButton
			{...props}
			showHotkey={false}
			ref={(node) => {
				connectDragSource(connectDropTarget(node))
			}}
		/>
	)
}
