import React, { ChangeEvent, useCallback, JSX } from 'react'
import { useTranslation } from 'react-i18next'
import { SortOrderButton } from '../../MediaStatus/SortOrderButton'
import classNames from 'classnames'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTimes } from '@fortawesome/free-solid-svg-icons'

export function MediaStatusPopUpHeader({
	sortOrder,
	sortBy,
	onChange,
	filter,
	onFilterChange,
}: Readonly<{
	sortBy: SortBy
	sortOrder: SortOrder
	onChange?: (sortBy: SortBy, sortOrder: SortOrder) => void
	filter: string
	onFilterChange?: (filter: string) => void
}>): JSX.Element | null {
	const { t } = useTranslation()

	function changeSortOrder(newSortBy: SortBy, newSortOrder: SortOrder) {
		if (sortBy !== newSortBy) {
			onChange?.(newSortBy, newSortOrder)
			return
		}
		onChange?.(sortBy, newSortOrder)
	}

	const onFilterChangeCallback = useCallback(
		(e: ChangeEvent<HTMLInputElement>) => {
			onFilterChange?.(e.target.value)
		},
		[onFilterChange]
	)

	const onFilterInputKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === 'Escape' || e.key === 'Enter') {
			if (!(document.activeElement instanceof HTMLElement)) return
			document.activeElement.blur()
		} else if (RegExp(/^F\d+$/).exec(e.key)) {
			e.preventDefault()
		}
	}, [])

	return (
		<thead className="media-status-panel-header">
			<tr>
				<th className="media-status-popup-item__playout-indicator"></th>
				<th className="media-status-popup-item__countdown" onClick={() => changeSortOrder('rundown', 'asc')}>
					<button
						className={classNames('media-status-popup-item__sort-button', {
							inactive: sortBy !== 'rundown',
						})}
					>
						{t('On Air In')}
					</button>
				</th>
				<th className="media-status-item__identifiers"></th>
				<th className="media-status-popup-item__status">
					<SortOrderButton
						className="media-status-popup-item__sort-button"
						order={matchSortKey('status', sortBy, sortOrder)}
						onChange={(order) => changeSortOrder('status', order)}
					/>
				</th>
				<th className="media-status-item__source-layer">
					<SortOrderButton
						className="media-status-popup-item__sort-button"
						order={matchSortKey('sourceLayer', sortBy, sortOrder)}
						onChange={(order) => changeSortOrder('sourceLayer', order)}
					/>
				</th>
				<th className="media-status-item__label">
					<SortOrderButton
						className="media-status-popup-item__sort-button"
						order={matchSortKey('name', sortBy, sortOrder)}
						onChange={(order) => changeSortOrder('name', order)}
					/>
					<input
						type="search"
						className="media-status-panel-header__filter-input"
						value={filter ?? ''}
						onChange={onFilterChangeCallback}
						onKeyDown={onFilterInputKeyDown}
						placeholder={t('Filter...')}
					/>
					{filter && (
						<button
							className="media-status-panel-header__clear-search-input"
							aria-label={t('Clear filter')}
							onClick={() => onFilterChange?.('')}
						>
							<FontAwesomeIcon icon={faTimes} />
						</button>
					)}
				</th>
			</tr>
		</thead>
	)
}

type SortBy = 'rundown' | 'status' | 'sourceLayer' | 'name'
type SortOrder = 'asc' | 'desc' | 'inactive'

function matchSortKey(sortKey: SortBy, matchSortKey: SortBy, order: SortOrder): SortOrder {
	if (matchSortKey === sortKey) return order
	return 'inactive'
}
