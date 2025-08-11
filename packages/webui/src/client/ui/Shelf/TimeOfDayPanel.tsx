import {
	DashboardLayoutTimeOfDay,
	RundownLayoutBase,
	RundownLayoutTimeOfDay,
} from '@sofie-automation/meteor-lib/dist/collections/RundownLayouts'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { dashboardElementStyle } from './DashboardPanel.js'
import { RundownLayoutsAPI } from '../../lib/rundownLayouts.js'
import { useTranslation } from 'react-i18next'
import { TimeOfDay } from '../RundownView/RundownTiming/TimeOfDay.js'

interface ITimeOfDayPanelProps {
	visible?: boolean
	layout: RundownLayoutBase
	panel: RundownLayoutTimeOfDay
	playlist: DBRundownPlaylist
}

export function TimeOfDayPanel({ panel, layout }: Readonly<ITimeOfDayPanelProps>): JSX.Element {
	const { t } = useTranslation()

	const isDashboardLayout = RundownLayoutsAPI.isDashboardLayout(layout)

	return (
		<div
			className="time-of-day-panel timing"
			style={isDashboardLayout ? dashboardElementStyle(panel as DashboardLayoutTimeOfDay) : {}}
		>
			<span className="timing-clock left">
				{!panel.hideLabel && <span className="timing-clock-label">{t('Local Time')}</span>}
				<TimeOfDay />
			</span>
		</div>
	)
}
