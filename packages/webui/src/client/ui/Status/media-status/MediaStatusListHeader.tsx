import { JSX } from 'react'
import classNames from 'classnames'
import { useTranslation } from 'react-i18next'
import { SortOrderButton } from '../../MediaStatus/SortOrderButton.js'

export function MediaStatusListHeader({
	sortOrder,
	sortBy,
	onChange,
}: Readonly<{
	sortBy: SortBy
	sortOrder: SortOrder
	onChange?: (sortBy: SortBy, sortOrder: SortOrder) => void
}>): JSX.Element | null {
	const { t } = useTranslation()

	function changeSortOrder(newSortBy: SortBy, newSortOrder: SortOrder) {
		if (sortBy !== newSortBy) {
			onChange?.(newSortBy, newSortOrder)
			return
		}
		onChange?.(sortBy, newSortOrder)
	}

	return (
		<thead className="media-status-list-header">
			<tr>
				<th className="media-status-item__rundown">
					<button
						className={classNames('media-status-list-header__sort-button', { disabled: sortBy !== 'rundown' })}
						onClick={() => changeSortOrder('rundown', 'asc')}
					>
						{t('Rundown')}
					</button>
				</th>
				<th className="media-status-item__identifiers"></th>
				<th className="media-status-item__status">
					<SortOrderButton
						className="media-status-list-header__sort-button"
						order={matchSortKey('status', sortBy, sortOrder)}
						onChange={(order) => changeSortOrder('status', order)}
					/>
				</th>
				<th className="media-status-item__source-layer">
					<SortOrderButton
						className="media-status-list-header__sort-button"
						order={matchSortKey('sourceLayer', sortBy, sortOrder)}
						onChange={(order) => changeSortOrder('sourceLayer', order)}
					/>
				</th>
				<th>
					<SortOrderButton
						className="media-status-list-header__sort-button"
						order={matchSortKey('name', sortBy, sortOrder)}
						onChange={(order) => changeSortOrder('name', order)}
					/>
				</th>
				<th className="media-status-item__duration"></th>
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
