import Tooltip from 'rc-tooltip'
import { CompactViewIcon, LargeViewIcon } from '../../lib/ui/icons/shelf'

export interface RundownViewShelfAdlibSizeToggleProps {
	value: 'compact' | 'large'
	onChange: (value: 'compact' | 'large') => void
	ariaLabel: string
	compactLabel: string
	largeLabel: string
}

export function RundownViewShelfAdlibSizeToggle({
	value,
	onChange,
	ariaLabel,
	compactLabel,
	largeLabel,
}: RundownViewShelfAdlibSizeToggleProps): JSX.Element {
	return (
		<div className="rundown-view-shelf__size-toggle" role="group" aria-label={ariaLabel}>
			<Tooltip overlay={largeLabel} destroyTooltipOnHide placement="left" mouseEnterDelay={0.5}>
				<button
					type="button"
					className={value === 'large' ? 'active' : undefined}
					onClick={() => onChange('large')}
					aria-pressed={value === 'large'}
					aria-label={largeLabel}
				>
					<LargeViewIcon />
				</button>
			</Tooltip>
			<Tooltip overlay={compactLabel} destroyTooltipOnHide placement="left" mouseEnterDelay={0.5}>
				<button
					type="button"
					className={value === 'compact' ? 'active' : undefined}
					onClick={() => onChange('compact')}
					aria-pressed={value === 'compact'}
					aria-label={compactLabel}
				>
					<CompactViewIcon />
				</button>
			</Tooltip>
		</div>
	)
}
