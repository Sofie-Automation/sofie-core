import ClassNames from 'classnames'
import {
	DashboardLayoutStudioName,
	RundownLayoutBase,
	RundownLayoutStudioName,
} from '@sofie-automation/meteor-lib/dist/collections/RundownLayouts'
import { dashboardElementStyle } from './DashboardPanel.js'
import { RundownLayoutsAPI } from '../../lib/rundownLayouts.js'
import { useTranslation } from 'react-i18next'
import { UIStudio } from '@sofie-automation/meteor-lib/dist/api/studios'

interface IStudioNamePanelProps {
	layout: RundownLayoutBase
	panel: RundownLayoutStudioName
	studio: UIStudio
}

export function StudioNamePanel({ layout, panel, studio }: Readonly<IStudioNamePanelProps>): JSX.Element {
	const isDashboardLayout = RundownLayoutsAPI.isDashboardLayout(layout)
	const { t } = useTranslation()

	return (
		<div
			className={ClassNames(
				'studio-name-panel',
				isDashboardLayout ? (panel as DashboardLayoutStudioName).customClasses : undefined
			)}
			style={isDashboardLayout ? dashboardElementStyle(panel as DashboardLayoutStudioName) : {}}
		>
			<div className="wrapper">
				<span className="studio-name-title">{t('Studio Name')}</span>
				<span className="studio-name">{studio.name}</span>
			</div>
		</div>
	)
}
