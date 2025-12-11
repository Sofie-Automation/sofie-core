import React, { useContext } from 'react'
import { IDashboardButtonProps, DashboardPieceButtonBase } from './DashboardPieceButton.js'

import {
	ConnectDragSource,
	ConnectDropTarget,
	DragSourceMonitor,
	ConnectDragPreview,
	ConnectableElement,
	useDrop,
	useDrag,
} from 'react-dnd'
import { DragDropItemTypes } from '../DragDropItemTypes.js'
import { BucketAdLib } from '@sofie-automation/corelib/dist/dataModel/BucketAdLibPiece'
import { useContentStatusForItem } from '../SegmentTimeline/withMediaObjectStatus.js'
import { BucketAdLibActionUi, BucketAdLibItem } from './RundownViewBuckets.js'
import { IBlueprintActionTriggerMode } from '@sofie-automation/blueprints-integration'
import { BucketId, PieceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { PreviewPopUpContext } from '../PreviewPopUp/PreviewPopUpContext.js'

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

interface ButtonSourceCollectedProps {
	connectDragSource: ConnectDragSource
	connectDragPreview: ConnectDragPreview
	isDragging: boolean
}

interface ButtonTargetCollectedProps {
	connectDropTarget: ConnectDropTarget
}

class BucketPieceButtonBase extends DashboardPieceButtonBase<ButtonSourceCollectedProps & ButtonTargetCollectedProps> {
	inBucket = true
	render(): JSX.Element {
		const { connectDragSource, connectDropTarget } = this.props

		return connectDropTarget(connectDragSource(super.render() as ConnectableElement)) as JSX.Element
	}
}

export function BucketPieceButton(
	props: React.PropsWithChildren<IDashboardButtonProps> & BucketPieceButtonBaseProps
): JSX.Element {
	const contentStatus = useContentStatusForItem(props.piece)

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

	const [collectedProps, connectDragSource, connectDragPreview] = useDrag<
		IBucketPieceDragObject,
		{},
		{ isDragging: boolean }
	>({
		type: DragDropItemTypes.BUCKET_ADLIB_PIECE,
		item: (_monitor: DragSourceMonitor) => {
			return {
				id: props.piece._id,
				originalIndex: props.findAdLib(props.piece._id).index,
				bucketId: props.bucketId,
			}
		},

		end: (item, monitor: DragSourceMonitor<IBucketPieceDragObject, IBucketPieceDropResult>) => {
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

	const previewContext = useContext(PreviewPopUpContext)

	return (
		<BucketPieceButtonBase
			{...props}
			previewContext={previewContext}
			contentStatus={contentStatus}
			connectDropTarget={connectDropTarget}
			connectDragPreview={connectDragPreview}
			connectDragSource={connectDragSource}
			isDragging={collectedProps.isDragging}
		/>
	)
}
