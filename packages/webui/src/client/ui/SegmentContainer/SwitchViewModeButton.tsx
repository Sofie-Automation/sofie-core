import Tooltip from 'rc-tooltip'
import { useTranslation } from 'react-i18next'
import { SegmentViewMode as SegmentViewModeIcon } from '../../lib/ui/icons/listView.js'

import { SegmentViewMode } from './SegmentViewModes.js'

export function getNextMode(currentMode: SegmentViewMode | undefined): SegmentViewMode {
	switch (currentMode) {
		case undefined:
		case SegmentViewMode.Timeline:
			return SegmentViewMode.Storyboard
		case SegmentViewMode.Storyboard:
			return SegmentViewMode.List
		case SegmentViewMode.List:
			return SegmentViewMode.Timeline
	}
}

export function SwitchViewModeButton({
	currentMode,
	onSwitchViewMode,
}: Readonly<{
	currentMode: SegmentViewMode
	onSwitchViewMode?: (viewMode: SegmentViewMode) => void
}>): JSX.Element {
	const { t } = useTranslation()

	const nextMode = getNextMode(currentMode)
	let label = t('Switch Segment View Mode')

	switch (nextMode) {
		case SegmentViewMode.Timeline:
			label = t('Switch to Timeline View')
			break
		case SegmentViewMode.Storyboard:
			label = t('Switch to Storyboard View')
			break
		case SegmentViewMode.List:
			label = t('Switch to List View')
			break
	}

	return (
		<Tooltip overlay={label} destroyTooltipOnHide>
			<button
				className="segment-timeline__switch-view-mode-button"
				aria-label={label}
				onClick={() => onSwitchViewMode?.(nextMode)}
			>
				<SegmentViewModeIcon />
			</button>
		</Tooltip>
	)
}
