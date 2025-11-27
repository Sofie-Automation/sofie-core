import { useMemo } from 'react'
import classNames from 'classnames'

export interface ColumnPackedGridGroup {
	/** Group identifier (e.g., source layer type) */
	id: string
	/** Display title for the group */
	title: string
	/** Item keys that belong to this group (for lookup) */
	itemKeys: string[]
	/** Whether the entire group is selected */
	isGroupSelected: boolean
	/** Callback when group checkbox is toggled */
	onGroupToggle: (groupId: string, checked: boolean) => void
}

export interface ColumnPackedGridItem<TItem> {
	/** The actual item data */
	data: TItem
	/** Unique key for React rendering */
	key: string
	/** Display label for the item */
	label: string
	/** Whether this item is individually selected */
	isSelected: boolean
	/** Whether this item is selected via its group (for visual state) */
	isGroupSelected: boolean
	/** Callback when item checkbox is toggled */
	onToggle: (item: TItem, checked: boolean) => void
}

export interface ColumnPackedGridProps<TItem> {
	/** Groups to display. If provided, items should contain all items including those in groups */
	groups?: ColumnPackedGridGroup[]
	/** All items to display. Required regardless of whether using groups or standalone mode */
	items?: ColumnPackedGridItem<TItem>[]
	/** Message to show when no groups or items exist */
	emptyMessage: string
	/** Render function for calculating item height (in pixels) */
	getItemHeight: (item: TItem) => number
	/** Optional CSS class name for the container */
	className?: string
	/** Target number of columns (default: 3) */
	targetColumns?: number
}

interface PackedColumn<TItem> {
	items: Array<{
		type: 'group' | 'item'
		group?: ColumnPackedGridGroup
		groupItems?: ColumnPackedGridItem<TItem>[]
		item?: ColumnPackedGridItem<TItem>
	}>
	height: number
}

/**
 * Bin-packing algorithm: greedily assign groups/items to the column with minimum height
 */
function packIntoColumns<TItem>(
	groups: ColumnPackedGridGroup[] | undefined,
	items: ColumnPackedGridItem<TItem>[] | undefined,
	getItemHeight: (item: TItem) => number,
	targetColumns: number
): PackedColumn<TItem>[] {
	const columns: PackedColumn<TItem>[] = Array.from({ length: targetColumns }, () => ({
		items: [],
		height: 0,
	}))

	const GROUP_HEADER_HEIGHT = 40 // Height for group checkbox + label
	const ITEM_HEIGHT_BASE = 30 // Base height for checkbox + label
	const GROUP_SPACING = 10 // Extra spacing after group

	// Helper to find column with minimum height
	const getMinHeightColumn = () => columns.reduce((min, col) => (col.height < min.height ? col : min))

	// Create a map of items by key for quick lookup
	const itemsByKey = new Map<string, ColumnPackedGridItem<TItem>>()
	if (items) {
		items.forEach((item) => itemsByKey.set(item.key, item))
	}

	// Process groups if provided
	if (groups && groups.length > 0 && items) {
		// Sort groups by total height (descending) for better packing
		const sortedGroups = [...groups].sort((a, b) => {
			const heightA =
				GROUP_HEADER_HEIGHT +
				a.itemKeys.reduce((sum, key) => {
					const item = itemsByKey.get(key)
					return sum + (item ? getItemHeight(item.data) || ITEM_HEIGHT_BASE : ITEM_HEIGHT_BASE)
				}, 0)
			const heightB =
				GROUP_HEADER_HEIGHT +
				b.itemKeys.reduce((sum, key) => {
					const item = itemsByKey.get(key)
					return sum + (item ? getItemHeight(item.data) || ITEM_HEIGHT_BASE : ITEM_HEIGHT_BASE)
				}, 0)
			return heightB - heightA
		})

		for (const group of sortedGroups) {
			const column = getMinHeightColumn()
			const groupItems = group.itemKeys
				.map((key) => itemsByKey.get(key))
				.filter(Boolean) as ColumnPackedGridItem<TItem>[]
			const groupHeight =
				GROUP_HEADER_HEIGHT +
				groupItems.reduce((sum, item) => sum + (getItemHeight(item.data) || ITEM_HEIGHT_BASE), 0) +
				GROUP_SPACING
			column.items.push({ type: 'group', group, groupItems })
			column.height += groupHeight
		}
	}
	// Process standalone items if provided (no groups)
	else if (items && items.length > 0) {
		// Sort items by height (descending) for better packing
		const sortedItems = [...items].sort((a, b) => {
			const heightA = getItemHeight(a.data) || ITEM_HEIGHT_BASE
			const heightB = getItemHeight(b.data) || ITEM_HEIGHT_BASE
			return heightB - heightA
		})

		for (const item of sortedItems) {
			const column = getMinHeightColumn()
			const itemHeight = getItemHeight(item.data) || ITEM_HEIGHT_BASE
			column.items.push({ type: 'item', item })
			column.height += itemHeight
		}
	}

	return columns
}

/**
 * Reusable component for displaying items in a bin-packed multi-column grid layout.
 * Supports two modes:
 * 1. Groups with items (e.g., source layers grouped by type)
 * 2. Standalone items (e.g., output layers with no grouping)
 */
export function ColumnPackedGrid<TItem>({
	groups,
	items,
	emptyMessage,
	getItemHeight,
	className,
	targetColumns = 3,
}: ColumnPackedGridProps<TItem>): JSX.Element {
	const hasGroups = groups && groups.length > 0
	const hasItems = items && items.length > 0

	const columns = useMemo(() => {
		if (!hasGroups && !hasItems) return []
		return packIntoColumns(groups, items, getItemHeight, targetColumns)
	}, [groups, items, getItemHeight, targetColumns, hasGroups, hasItems])

	// Show empty message if no groups or items
	if (!hasGroups && !hasItems) {
		return <div className={classNames('column-packed-grid-empty', className)}>{emptyMessage}</div>
	}

	return (
		<div className={classNames('column-packed-grid', className)}>
			{columns.map((column, colIndex) => (
				<div key={colIndex} className="column-packed-grid__column">
					{column.items.map((entry) => {
						if (entry.type === 'group' && entry.group && entry.groupItems) {
							return (
								<ColumnPackedGridGroupComponent
									key={entry.group.id}
									group={entry.group}
									groupItems={entry.groupItems}
								/>
							)
						} else if (entry.type === 'item' && entry.item) {
							return <ColumnPackedGridItemComponent key={entry.item.key} item={entry.item} standalone={true} />
						}
						return null
					})}
				</div>
			))}
		</div>
	)
}

interface ColumnPackedGridGroupComponentProps<TItem> {
	group: ColumnPackedGridGroup
	groupItems: ColumnPackedGridItem<TItem>[]
}

function ColumnPackedGridGroupComponent<TItem>({
	group,
	groupItems,
}: ColumnPackedGridGroupComponentProps<TItem>): JSX.Element {
	return (
		<div className="column-packed-grid__group">
			<label className="column-packed-grid__group-header">
				<input
					type="checkbox"
					checked={group.isGroupSelected}
					onChange={(e) => group.onGroupToggle(group.id, e.target.checked)}
				/>
				<span className="column-packed-grid__group-title">{group.title}</span>
			</label>
			<div className="column-packed-grid__group-items">
				{groupItems.map((item) => (
					<ColumnPackedGridItemComponent key={item.key} item={item} standalone={false} />
				))}
			</div>
		</div>
	)
}

interface ColumnPackedGridItemComponentProps<TItem> {
	item: ColumnPackedGridItem<TItem>
	standalone: boolean
}

function ColumnPackedGridItemComponent<TItem>({
	item,
	standalone,
}: ColumnPackedGridItemComponentProps<TItem>): JSX.Element {
	const isVisuallySelected = item.isSelected || item.isGroupSelected

	return (
		<label
			className={classNames('column-packed-grid__item', {
				'column-packed-grid__item--selected': isVisuallySelected,
				'column-packed-grid__item--standalone': standalone,
			})}
		>
			<input type="checkbox" checked={item.isSelected} onChange={(e) => item.onToggle(item.data, e.target.checked)} />
			<span className="column-packed-grid__item-label">{item.label}</span>
		</label>
	)
}
