import {
	DashboardLayoutShowStyleDisplay,
	RundownLayoutBase,
	RundownLayoutShowStyleDisplay,
} from '@sofie-automation/meteor-lib/dist/collections/RundownLayouts'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { dashboardElementStyle } from './DashboardPanel.js'
import { RundownLayoutsAPI } from '../../lib/rundownLayouts.js'
import { DBShowStyleVariant } from '@sofie-automation/corelib/dist/dataModel/ShowStyleVariant'
import { useTranslation } from 'react-i18next'
import { UIShowStyleBase } from '@sofie-automation/meteor-lib/dist/api/showStyles'

interface IShowStylePanelProps {
	visible?: boolean
	layout: RundownLayoutBase
	panel: RundownLayoutShowStyleDisplay
	playlist: DBRundownPlaylist
	showStyleBase: UIShowStyleBase
	showStyleVariant: DBShowStyleVariant
}

export function ShowStylePanel(props: Readonly<IShowStylePanelProps>): JSX.Element {
	const { t } = useTranslation()

	const isDashboardLayout = RundownLayoutsAPI.isDashboardLayout(props.layout)

	return (
		<div
			className="show-style-panel"
			style={isDashboardLayout ? dashboardElementStyle(props.panel as DashboardLayoutShowStyleDisplay) : {}}
		>
			<div className="show-style-subpanel">
				<div className="show-style-subpanel__label">{t('Show Style')}</div>
				<div className="show-style-subpanel__name" title={props.showStyleBase.name}>
					{props.showStyleBase.name}
				</div>
			</div>
			<div className="show-style-subpanel">
				<div className="show-style-subpanel__label">{t('Show Style Variant')}</div>
				<div className="show-style-subpanel__name" title={props.showStyleVariant.name}>
					{props.showStyleVariant.name}
				</div>
			</div>
		</div>
	)
}
