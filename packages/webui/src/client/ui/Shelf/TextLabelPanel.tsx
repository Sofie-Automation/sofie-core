import ClassNames from 'classnames'
import {
	DashboardLayoutTextLabel,
	RundownLayoutBase,
	RundownLayoutTextLabel,
} from '@sofie-automation/meteor-lib/dist/collections/RundownLayouts'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { dashboardElementStyle } from './DashboardPanel.js'
import { RundownLayoutsAPI } from '../../lib/rundownLayouts.js'

interface ITextLabelPanelProps {
	visible?: boolean
	layout: RundownLayoutBase
	panel: RundownLayoutTextLabel
	playlist: DBRundownPlaylist
}

export function TextLabelPanel({ panel, layout }: Readonly<ITextLabelPanelProps>): JSX.Element {
	const isDashboardLayout = RundownLayoutsAPI.isDashboardLayout(layout)

	return (
		<div
			className={ClassNames(
				'text-label-panel',
				isDashboardLayout ? (panel as DashboardLayoutTextLabel).customClasses : undefined
			)}
			style={isDashboardLayout ? dashboardElementStyle(panel as DashboardLayoutTextLabel) : {}}
		>
			<div className="wrapper">
				<span className="text">{panel.text}</span>
			</div>
		</div>
	)
}
