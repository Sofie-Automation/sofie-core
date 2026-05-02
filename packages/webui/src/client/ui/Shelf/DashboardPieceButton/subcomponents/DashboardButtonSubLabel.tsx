import type { UIStudio } from '@sofie-automation/corelib/src/dataModel/Studio.js'
import { StyledTimecode } from '../../../../lib/StyledTimecode'

export function DashboardButtonSubLabel(props: {
	sourceDuration: number
	studioSettings: UIStudio['settings']
}): JSX.Element {
	return (
		<span className="dashboard-panel__panel__button__sub-label">
			<StyledTimecode time={props.sourceDuration || 0} studioSettings={props.studioSettings} />
		</span>
	)
}
