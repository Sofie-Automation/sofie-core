import {
	DashboardLayoutColoredBox,
	RundownLayoutBase,
	RundownLayoutColoredBox,
} from '@sofie-automation/meteor-lib/dist/collections/RundownLayouts'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { dashboardElementStyle } from './DashboardPanel'
import { RundownLayoutsAPI } from '../../lib/rundownLayouts'

interface IColoredBoxPanelProps {
	visible?: boolean
	layout: RundownLayoutBase
	panel: RundownLayoutColoredBox
	playlist: DBRundownPlaylist
}

export function ColoredBoxPanel(props: Readonly<IColoredBoxPanelProps>): JSX.Element {
	const isDashboardLayout = RundownLayoutsAPI.isDashboardLayout(props.layout)

	return (
		<div
			className="colored-box-panel"
			style={{
				backgroundColor: props.panel.iconColor ?? 'transparent',
				...(isDashboardLayout ? dashboardElementStyle(props.panel as DashboardLayoutColoredBox) : {}),
			}}
		>
			<div className="wrapper"></div>
		</div>
	)
}
