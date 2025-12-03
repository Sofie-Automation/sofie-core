import { JSX } from 'react'
import { assertNever } from '@sofie-automation/corelib/dist/lib'
import { SortAscending, SortDescending, SortDisabled } from '../../lib/ui/icons/sorting.js'

export function SortOrderButton({
	className,
	order,
	onChange,
}: Readonly<{
	className?: string
	order: Order
	onChange?: (nextOrder: Order) => void
}>): JSX.Element | null {
	function onClick() {
		switch (order) {
			case 'asc':
				onChange?.('desc')
				return
			case 'inactive':
			case 'desc':
				onChange?.('asc')
				return
			default:
				assertNever(order)
				return
		}
	}

	return (
		<button onClick={onClick} className={className}>
			{order === 'asc' ? <SortAscending /> : null}
			{order === 'desc' ? <SortDescending /> : null}
			{order === 'inactive' ? <SortDisabled /> : null}
		</button>
	)
}

type Order = 'asc' | 'desc' | 'inactive'
