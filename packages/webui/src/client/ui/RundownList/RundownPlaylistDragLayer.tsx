import * as React from 'react'
import { DragLayerMonitor, useDragLayer, XYCoord } from 'react-dnd'
import { IRundownDragObject, RundownListDragDropTypes } from './DragAndDropTypes'
import { Rundowns } from '../../collections'
import RundownListItemView from './RundownListItemView'
import { getElementWidth } from '../../utils/dimensions'
import { HTML_ID_PREFIX } from './RundownListItem'
import { UIShowStyleBases } from '../Collections'

export default function RundownPlaylistDragLayer({
	draggedClassNames,
}: Readonly<{
	draggedClassNames?: string[]
}>): JSX.Element | null {
	const { isDragging, item, itemType, currentOffset, draggedWidth } = useDragLayer(collect)

	if (!isDragging) {
		return null
	}

	function renderItem(type: RundownListDragDropTypes, item: IRundownDragObject) {
		switch (type) {
			case RundownListDragDropTypes.RUNDOWN: {
				const rundown = Rundowns.findOne(item.id)
				const showStyle = rundown ? UIShowStyleBases.findOne(rundown.showStyleBaseId) : undefined
				return (
					<RundownListItemView
						isActive={false}
						renderTooltips={false}
						rundown={rundown!}
						rundownLayouts={item.rundownLayouts}
						className={`drag-preview ${draggedClassNames ?? ''}`}
						connectDragSource={(props) => props}
						connectDropTarget={(props) => props}
						htmlElementId="drag-preview"
						isDragLayer={true}
						showStyleName={showStyle?.name ?? ''}
					/>
				)
			}
		}
	}

	return (
		<div style={layerStyles} className="rundown-list">
			<div style={getItemStyles(currentOffset, draggedWidth)}>{renderItem(itemType, item)}</div>
		</div>
	)
}

function collect(monitor: DragLayerMonitor) {
	let draggedWidth: number | null = null
	let draggedClassNames: string[] | undefined

	const dragging = monitor.getItem()
	if (dragging) {
		const { id } = dragging
		const htmlElementId = `${HTML_ID_PREFIX}${id}`
		const el = document.querySelector(`#${htmlElementId}`)
		if (el instanceof HTMLElement) {
			draggedWidth = getElementWidth(el)
			draggedClassNames = Array.from(el.classList)
		}
	}

	return {
		item: monitor.getItem() as IRundownDragObject,
		itemType: monitor.getItemType() as RundownListDragDropTypes,
		currentOffset: monitor.getSourceClientOffset(),
		isDragging: monitor.isDragging(),
		draggedWidth,
		draggedClassNames,
	}
}

function getItemStyles(currentOffset: XYCoord | null, draggedWidth: number | null) {
	if (!currentOffset) {
		return {
			display: 'none',
		}
	}

	const { x, y } = currentOffset
	const transform = `translate3d(${x}px, ${y}px, 1px)`
	return {
		transform: transform,
		WebkitTransform: transform,
		width: draggedWidth ? `${draggedWidth}px` : undefined,
	}
}

const layerStyles: React.CSSProperties = {
	position: 'fixed',
	pointerEvents: 'none',
	zIndex: 100,
	left: 0,
	top: 0,
	width: '100%',
	height: '100%',
}
